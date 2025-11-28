// src/hooks/useSpectraSync.js
import { useEffect, useRef, useCallback } from 'react';
import { usePlayer } from '../context/PlayerContext';

const SPECTRA_BASE_URL = '/spectra';

/**
 * Custom hook for integrating Spectra analytics backend
 * Handles metadata fetching, lazy caching, and lyrics generation
 */
export function useSpectraSync() {
    const { currentSong, spectraData, updateSpectraData, resetSpectraData } = usePlayer();

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
            return `?ia_id=${encodeURIComponent(currentSong.identifier || currentSong.id)}`;
        } else {
            return `?tidol_id=${encodeURIComponent(currentSong.id)}`;
        }
    }, [currentSong, isInternetArchiveSong]);

    // Effect 2: Fetch analysis metadata when song changes
    useEffect(() => {
        if (!currentSong || currentSong.id === lastTrackIdRef.current) {
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
                const response = await fetch(
                    `${SPECTRA_BASE_URL}/analysis${query}`,
                    { signal: abortControllerRef.current.signal }
                );

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json();

                updateSpectraData({
                    bpm: data.bpm || null,
                    key: data.key || null,
                    waveform: Array.isArray(data.waveform_data) ? data.waveform_data : [],
                    stems: data.stems || null,
                    status: 'success'
                });

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

    // ... (Effect 3 remains unchanged) ...

    // Function: Fetch lyrics on demand
    const fetchLyrics = useCallback(async (skipGeneration = false) => {
        if (!currentSong) {
            throw new Error('No current song');
        }

        try {
            updateSpectraData({ status: 'loading' });

            const isIA = isInternetArchiveSong(currentSong);

            // Step 0: Ensure song is in Spectra database (only if not skipped)
            if (!skipGeneration) {
                try {
                    if (isIA) {
                        // Ingest Internet Archive song
                        await fetch(`${SPECTRA_BASE_URL}/ingest-remote`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                audioUrl: currentSong.url,
                                metadata: {
                                    title: currentSong.titulo || currentSong.title,
                                    artist: currentSong.artista || currentSong.artist,
                                    ia_id: currentSong.identifier || currentSong.id
                                }
                            })
                        });
                    } else {
                        // Sync local song
                        await fetch(`${SPECTRA_BASE_URL}/sync-local-song`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                songId: currentSong.id,
                                title: currentSong.titulo || currentSong.title,
                                artist: currentSong.artista || currentSong.artist,
                                album: currentSong.album,
                                filepath: currentSong.archivo || currentSong.url,
                                duration: currentSong.duracion,
                                bitrate: currentSong.bit_rate
                            })
                        });
                    }
                    console.log('[Spectra] Song ensured in database');
                } catch (ingestError) {
                    console.warn('[Spectra] Ingest warning (may already exist):', ingestError);
                    // Continue anyway - song might already exist
                }
            }

            // Step 1: Trigger lyrics generation (only if not skipped)
            if (!skipGeneration) {
                let generateResponse;
                if (isIA) {
                    // Internet Archive songs use query params
                    const query = getQueryParams();
                    generateResponse = await fetch(
                        `${SPECTRA_BASE_URL}/generate-lyrics${query}`,
                        { method: 'POST' }
                    );
                } else {
                    // Local songs use URL params
                    generateResponse = await fetch(
                        `${SPECTRA_BASE_URL}/local/generate-lyrics/${currentSong.id}`,
                        { method: 'POST' }
                    );
                }

                if (!generateResponse.ok) {
                    throw new Error(`Generate failed: HTTP ${generateResponse.status}`);
                }

                const generateData = await generateResponse.json();
                if (generateData.stems) {
                    updateSpectraData({ stems: generateData.stems });
                    console.log('[Spectra] Stems received from generation endpoint');
                }
            }

            // Step 2: Fetch the .lrc file
            let lyricsResponse;
            if (isIA) {
                const query = getQueryParams();
                lyricsResponse = await fetch(
                    `${SPECTRA_BASE_URL}/lyrics${query}`
                );
            } else {
                lyricsResponse = await fetch(
                    `${SPECTRA_BASE_URL}/local/lyrics/${currentSong.id}`
                );
            }

            if (!lyricsResponse.ok) {
                throw new Error(`Lyrics fetch failed: HTTP ${lyricsResponse.status}`);
            }

            const lrcText = await lyricsResponse.text();

            // Step 3: Parse .lrc format
            const parsedLyrics = parseLRC(lrcText);

            updateSpectraData({
                lyrics: parsedLyrics,
                status: 'success'
            });

            // Step 4: Refresh analysis to check for generated stems
            // We do this silently to update the stems availability
            const query = getQueryParams();
            fetch(`${SPECTRA_BASE_URL}/analysis${query}`)
                .then(res => res.json())
                .then(data => {
                    if (data.stems) {
                        updateSpectraData({ stems: data.stems });
                        console.log('[Spectra] Stems detected and updated');
                    }
                })
                .catch(err => console.warn('[Spectra] Failed to refresh stems:', err));

            console.log(`[Spectra] Lyrics loaded for: ${currentSong.titulo}`);
            return parsedLyrics;
        } catch (error) {
            console.error(`[Spectra] Lyrics fetch error:`, error);
            updateSpectraData({ status: 'error' });
            throw error;
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
