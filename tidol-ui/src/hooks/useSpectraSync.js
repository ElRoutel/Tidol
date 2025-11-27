// src/hooks/useSpectraSync.js
import { useEffect, useRef, useCallback } from 'react';
import { usePlayer } from '../context/PlayerContext';

const SPECTRA_BASE_URL = 'http://localhost:3001';

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

                const response = await fetch(
                    `${SPECTRA_BASE_URL}/track/${encodeURIComponent(currentSong.id)}/analysis`,
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
                    status: 'success'
                });

                console.log(`[Spectra] Analysis loaded for: ${currentSong.titulo}`, data);
            } catch (error) {
                if (error.name === 'AbortError') {
                    return; // Request was cancelled, ignore
                }

                // Silent error handling - app continues to work without Spectra
                console.warn(`[Spectra] Could not load analysis (offline?):`, error.message);
                updateSpectraData({ status: 'error' });
            }
        };

        fetchAnalysis();

        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [currentSong, updateSpectraData]);

    // Effect 3: Trigger lazy caching for Internet Archive songs
    useEffect(() => {
        if (!currentSong || !isInternetArchiveSong(currentSong)) {
            return;
        }

        // Fire and forget - don't wait for response
        fetch(`${SPECTRA_BASE_URL}/ingest-remote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                audioUrl: currentSong.url,
                coverUrl: currentSong.portada || null,
                metadata: {
                    title: currentSong.titulo || currentSong.title,
                    artist: currentSong.artista || currentSong.artist || 'Unknown',
                    album: currentSong.album || 'Internet Archive',
                    ia_id: currentSong.identifier || currentSong.id,
                    duration: currentSong.duracion || currentSong.duration || 0
                }
            })
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    if (data.alreadyExists) {
                        console.log(`[Spectra] Song already cached: ${currentSong.titulo}`);
                    } else {
                        console.log(`[Spectra] Download started: ${currentSong.titulo} (Track ID: ${data.trackId})`);
                    }
                }
            })
            .catch(error => {
                console.warn(`[Spectra] Caching failed (offline?):`, error.message);
            });
    }, [currentSong, isInternetArchiveSong]);

    // Function: Fetch lyrics on demand
    const fetchLyrics = useCallback(async () => {
        if (!currentSong) {
            throw new Error('No current song');
        }

        try {
            updateSpectraData({ status: 'loading' });

            // Step 1: Trigger VOX AI lyrics generation
            const generateResponse = await fetch(
                `${SPECTRA_BASE_URL}/generate-lyrics/${encodeURIComponent(currentSong.id)}`,
                { method: 'POST' }
            );

            if (!generateResponse.ok) {
                throw new Error(`Generate failed: HTTP ${generateResponse.status}`);
            }

            // Step 2: Fetch the .lrc file
            const lyricsResponse = await fetch(
                `${SPECTRA_BASE_URL}/lyrics/${encodeURIComponent(currentSong.id)}`
            );

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

            console.log(`[Spectra] Lyrics loaded for: ${currentSong.titulo}`);
            return parsedLyrics;
        } catch (error) {
            console.error(`[Spectra] Lyrics fetch error:`, error);
            updateSpectraData({ status: 'error' });
            throw error;
        }
    }, [currentSong, updateSpectraData]);

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
