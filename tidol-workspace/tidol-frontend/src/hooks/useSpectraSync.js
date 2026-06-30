// src/hooks/useSpectraSync.js
import { useEffect, useRef, useCallback } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { io } from 'socket.io-client';
import api from '../api/axiosConfig';
import axios from 'axios';

const SPECTRA_BASE_URL = '/spectra';

// Debug: ver en consola las peticiones Demucs+Whisper al abrir el fullscreen player
const SPECTRA_DEBUG = true;

/**
 * Custom hook for integrating Spectra analytics backend
 * Handles metadata fetching, lazy caching, and lyrics generation
 */
export function useSpectraSync() {
    const { currentSong, spectraData, updateSpectraData, resetSpectraData, engine } = usePlayer();

    const lastTrackIdRef = useRef(null);
    const abortControllerRef = useRef(null);

    // Helper: Check if song is from Internet Archive
    const isInternetArchiveSong = useCallback((song) => {
        if (!song) return false;
        return song.source === 'internet_archive' ||
            song.identifier ||
            (song.url && song.url.includes('archive.org'));
    }, []);

    // Effect 1: Reset Spectra data when song changes
    useEffect(() => {
        if (currentSong?.id !== lastTrackIdRef.current) {
            resetSpectraData();
        }
    }, [currentSong?.id, resetSpectraData]);

    // Helper: Get query params for current song
    const getQueryParams = useCallback(() => {
        if (!currentSong) return '';
        if (isInternetArchiveSong(currentSong)) {
            const raw = currentSong.identifier || currentSong.id || '';
            const normalized = String(raw).split('/')[0]; // strip filename if present
            return `?ia_id=${encodeURIComponent(normalized)}`;
        } else {
            return `?tidol_id=${encodeURIComponent(currentSong.id)}`;
        }
    }, [currentSong, isInternetArchiveSong]);

    // Effect 2: Fetch analysis metadata when song changes
    useEffect(() => {
        if (!currentSong?.id || currentSong.id === lastTrackIdRef.current) {
            return; // Skip if no song or same song
        }

        lastTrackIdRef.current = currentSong.id;

        // Cancel any pending request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        abortControllerRef.current = new AbortController();

        const fetchAnalysis = async () => {
            try {
                updateSpectraData({ status: 'loading' });

                const query = getQueryParams();
                const response = await api.get(`${SPECTRA_BASE_URL}/analysis${query}`, {
                    signal: abortControllerRef.current.signal
                });

                const data = response.data;

                updateSpectraData({
                    bpm: data.bpm || null,
                    key: data.key || null,
                    waveform: Array.isArray(data.waveform_data) ? data.waveform_data : [],
                    stems: data.stems || null,
                    status: 'success'
                });

                // Inyectar al motor de audio
                if (data.stems) {
                    engine.loadMetadata(currentSong.id, { stems: data.stems });
                }

                console.log(`[Spectra] Analysis loaded for: ${currentSong.titulo}`, data);
            } catch (error) {
                if (error.name === 'AbortError') {
                    return; // Request was cancelled, ignore
                }

                // Silent error handling - app continues to work without Spectra
                // console.warn(`[Spectra] Could not load analysis (offline?):`, error.message);
                updateSpectraData({ status: 'error' });
            }
        };

        fetchAnalysis();

        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [currentSong, updateSpectraData, getQueryParams]);

    // Effect 3: Socket.io Real-time Analysis Integration
    useEffect(() => {
        const socket = io('/', { path: '/socket.io' }); // backend is on same origin in production or proxied

        socket.on('analysis_status', (data) => {
            console.log('[Spectra Socket] Real-time status update:', data);

            // Si el análisis está listo, inyectamos al engine
            if (data.status === 'ready' && data.data) {
                // Sincronizar con el motor de audio de Tidol
                engine.loadMetadata(data.cancionId, data.data);

                // Si la canción activa es la que se analizó, actualizamos spectraData
                if (currentSong && (currentSong.id === data.cancionId || currentSong.id === data.iaId)) {
                    updateSpectraData({
                        bpm: data.data.bpm,
                        key: data.data.key,
                        status: 'success'
                    });
                }
            } else if (data.status === 'processing') {
                if (currentSong && (currentSong.id === data.cancionId)) {
                    updateSpectraData({ status: 'loading' });
                }
            }
        });

        return () => {
            socket.disconnect();
        };
    }, [engine, currentSong, updateSpectraData]);

    // ... (Effect 3 remains unchanged) ...

    // Function: Fetch lyrics on demand
    // songOverride: usa esta canción en lugar de currentSong (evita race cuando el efecto dispara y el contexto aún no tiene canción)
    const fetchLyrics = useCallback(async (skipGeneration = false, songOverride = null) => {
        const song = songOverride ?? currentSong;
        if (!song || !song.id) {
            if (SPECTRA_DEBUG) console.warn('[Spectra Debug] fetchLyrics skipped: no song or song.id');
            return;
        }

        if (SPECTRA_DEBUG) {
            console.log('[Spectra Debug] fetchLyrics called', {
                song: song.titulo || song.title || song.attributes?.name,
                id: song.id,
                skipGeneration
            });
        }

        try {
            updateSpectraData({ status: 'loading' });

            const isIA = isInternetArchiveSong(song);

            // Step 0: Ensure song is in Spectra database (only if not skipped)
            if (!skipGeneration) {
                try {
                    if (isIA) {
                        // Ingest Internet Archive song using original URL when possible
                        const audioUrlToSend = song.originalUrl || song.url || '';
                        console.log('[Spectra] Ingest request for IA track:', {
                            ia_id: song.identifier || song.id,
                            audioUrl: audioUrlToSend
                        });

                        // Try once, retry on transient network error
                        let ingestOk = false;
                        for (let attempt = 1; attempt <= 2; attempt++) {
                            try {
                                const resp = await api.post(`${SPECTRA_BASE_URL}/ingest-remote`, {
                                    audioUrl: audioUrlToSend,
                                    metadata: {
                                        title: song.titulo || song.title,
                                        artist: song.artista || song.artist,
                                        ia_id: song.identifier || song.id
                                    }
                                });

                                ingestOk = true;
                                break;
                            } catch (e) {
                                console.warn(`[Spectra] Ingest attempt ${attempt} failed:`, e.message);
                                if (attempt === 1) await new Promise(r => setTimeout(r, 800)); // small backoff
                                else throw e; // rethrow on second failure
                            }
                        }

                    } else {
                        // Sync local song (must exist in Spectra for generate-lyrics to find it by tidol_id)
                        const syncUrl = `${SPECTRA_BASE_URL}/sync-local-song`;
                        if (SPECTRA_DEBUG) {
                            console.log('[Spectra Debug] POST sync-local-song', { url: syncUrl, songId: song.id });
                        }
                        const syncRes = await axios.post(syncUrl, {
                            songId: song.id,
                            title: song.titulo || song.title || song.attributes?.name,
                            artist: song.artista || song.artist || song.attributes?.artistName,
                            album: song.album || song.attributes?.albumName,
                            filepath: song.archivo || song.url || song.playbackUrl,
                            duration: song.duracion || song.attributes?.durationInSeconds,
                            bitrate: song.bit_rate
                        });
                        if (syncRes.status !== 200 && SPECTRA_DEBUG) {
                            const errBody = syncRes.data;
                            console.warn('[Spectra Debug] sync-local-song failed', { status: syncRes.status, body: errBody });
                        }
                    }
                    console.log('[Spectra] Song ensured in database');
                } catch (ingestError) {
                    console.warn('[Spectra] Ingest warning (may already exist):', ingestError);
                    // Continue anyway - song might already exist
                }
            }

            // Step 1: Trigger lyrics generation (Demucs + Whisper) — only if not skipped
            if (!skipGeneration) {
                let generateUrl;
                if (isIA) {
                    const query = getQueryParams();
                    generateUrl = `${SPECTRA_BASE_URL}/generate-lyrics${query}`;
                } else {
                    generateUrl = `${SPECTRA_BASE_URL}/local/generate-lyrics/${song.id}`;
                }
                if (SPECTRA_DEBUG) {
                    console.log('[Spectra Debug] POST Demucs+Whisper (generate-lyrics)', { url: generateUrl });
                }
                const generateResponse = await axios.post(generateUrl);
                const generateData = generateResponse.data;

                if (SPECTRA_DEBUG) {
                    console.log('[Spectra Debug] generate-lyrics response', {
                        status: generateResponse.status,
                        ok: generateResponse.ok,
                        data: generateData
                    });
                }

                if (generateResponse.status !== 200) {
                    throw new Error(`Generate failed: HTTP ${generateResponse.status} ${generateData?.error || ''}`);
                }

                if (generateData.stems) {
                    updateSpectraData({ stems: generateData.stems });
                    engine.loadMetadata(song.id, { stems: generateData.stems });
                    console.log('[Spectra] Stems received from generation endpoint');
                }
            }

            // Step 2: Fetch the .lrc file
            let lyricsUrl;
            if (isIA) {
                const query = getQueryParams();
                lyricsUrl = `${SPECTRA_BASE_URL}/lyrics${query}`;
            } else {
                lyricsUrl = `${SPECTRA_BASE_URL}/local/lyrics/${song.id}`;
            }
            if (SPECTRA_DEBUG) {
                console.log('[Spectra Debug] GET lyrics', { url: lyricsUrl });
            }

            try {
                const lyricsResponse = await axios.get(lyricsUrl);
                const data = lyricsResponse.data;

                if (SPECTRA_DEBUG) {
                    console.log('[Spectra Debug] lyrics response', {
                        status: lyricsResponse.status,
                        dataStatus: data.status,
                        hasLyrics: !!data.lyrics
                    });
                }

                if (data.status === 'processing') {
                    const pendingErr = new Error('Lyrics processing');
                    pendingErr.isNotFound = true;
                    pendingErr.status = 202;
                    throw pendingErr;
                }

                const lrcText = data.lyrics || '';
                if (lrcText) {
                    const parsedLyrics = parseLRC(lrcText);
                    updateSpectraData({
                        lyrics: parsedLyrics,
                        status: 'success'
                    });
                    console.log(`[Spectra] Lyrics loaded for: ${song.titulo || song.title || song.attributes?.name}`);
                }
            } catch (lrcErr) {
                if (lrcErr.isNotFound) throw lrcErr;
                console.warn('[Spectra] Lyrics could not be fetched, but continuing for stems check', lrcErr.message);
            }

            // Step 4: Refresh analysis to check for generated stems (CRITICAL for Vox mode)
            const sQuery = getQueryParams();
            try {
                const res = await axios.get(`${SPECTRA_BASE_URL}/analysis${sQuery}`);
                const data = res.data;
                if (data.stems) {
                    updateSpectraData({ stems: data.stems });
                    engine.loadMetadata(song.id, { stems: data.stems });
                    console.log('[Spectra] Stems detected and updated in engine');
                }
            } catch (err) {
                console.warn('[Spectra] Failed to refresh stems:', err.message);
            }

            if (SPECTRA_DEBUG) {
                console.log('[Spectra Debug] fetchLyrics flow completed');
            }
            return true;
        } catch (error) {
            if (error?.response?.status === 404) {
                if (SPECTRA_DEBUG) console.warn('[Spectra] Lyrics not available (404), gracefully falling back to null');
                updateSpectraData({ status: 'not_available', lyrics: null });
                return false;
            }

            if (error && error.isNotFound) {
                if (SPECTRA_DEBUG) {
                    console.log('[Spectra Debug] Lyrics still processing (202), will retry via polling');
                }
                updateSpectraData({ status: 'loading' });
                return false;
            }

            console.error(`[Spectra] fetchLyrics failure:`, error.message);
            updateSpectraData({ status: 'error' });
            return false;
        }
    }, [currentSong, updateSpectraData, getQueryParams, isInternetArchiveSong]);

    return {
        spectraData,
        fetchLyrics,
        isSpectraAvailable: spectraData.status !== 'error'
    };
}

/**
 * Parse LRC format lyrics
 * Example: [00:12.00]Line of text
 */
function parseLRC(lrcText) {
    if (!lrcText) return [];

    const lines = lrcText.split('\n');
    const parsed = [];

    lines.forEach(line => {
        const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2})\](.*)/);
        if (match) {
            const minutes = parseInt(match[1], 10);
            const seconds = parseInt(match[2], 10);
            const centiseconds = parseInt(match[3], 10);
            const text = match[4].trim();

            const timeInSeconds = minutes * 60 + seconds + centiseconds / 100;

            parsed.push({
                time: timeInSeconds,
                text: text
            });
        }
    });

    return parsed;
}

export default useSpectraSync;
