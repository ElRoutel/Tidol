// src/hooks/useLazyCaching.ts
import { useCallback } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { UnifiedTrack } from '../types/music';
import api from '../api/axiosConfig';

export function useLazyCaching() {
    const { playSongList } = usePlayer();

    const triggerBackgroundDownload = useCallback((song: UnifiedTrack) => {
        if (!song || !song.attributes) {
            console.warn('⚠️ useLazyCaching: Song or attributes missing', song);
            return;
        }

        if (!song.playbackUrl) {
            console.warn('⚠️  Pista sin URL de reproducción, saltando descarga:', song.attributes?.name || 'Unknown');
            return;
        }

        // Si ya es local o localhost, no re-cachear
        if (song.playbackUrl.startsWith('/uploads/') || song.playbackUrl.startsWith('http://localhost') || song.sourceType === 'local') {
            console.log('💾 Pista ya está en caché o es local:', song.attributes?.name || 'Unknown');
            return;
        }

        const isRemote = song.playbackUrl.startsWith('http://') || song.playbackUrl.startsWith('https://');
        if (!isRemote) {
            console.warn('⚠️  URL no remota, saltando descarga:', song.playbackUrl);
            return;
        }

        const SPECTRA_URL = '/spectra';

        api.post(`${SPECTRA_URL}/ingest-remote`, {
            audioUrl: song.playbackUrl,
            coverUrl: song.attributes.artwork?.url || null,
            metadata: {
                title: song.attributes?.name || 'Unknown',
                artist: song.attributes?.artistName || 'Unknown',
                album: song.attributes?.albumName || 'Internet Archive',
                ia_id: song.id,
                duration: song.attributes?.durationInSeconds || 0
            }
        })
            .then(response => {
                const data = response.data;
                if (data.success) {
                    if (data.alreadyExists) {
                        console.log('💾 Pista ya estaba en caché:', song.attributes?.name || 'Unknown');
                    } else {
                        console.log('📥 Descarga iniciada:', song.attributes?.name || 'Unknown', `(Track ID: ${data.trackId})`);
                    }
                } else {
                    console.warn('⚠️  Backend respondió con error:', data.error);
                }
            })
            .catch(error => {
                console.warn('⚠️  No se pudo cachear la pista:', error.message);
            });
    }, []);

    const handlePlayTrack = useCallback(async (song: UnifiedTrack) => {
        if (!song || !song.playbackUrl) {
            console.error('❌ useLazyCaching: Pista inválida o sin URL');
            return;
        }

        playSongList([song], 0);
        console.log('▶️  Reproducción iniciada:', song.attributes?.name || 'Unknown');
        triggerBackgroundDownload(song);
    }, [playSongList, triggerBackgroundDownload]);

    const handlePlayList = useCallback((songs: UnifiedTrack[], startIndex = 0) => {
        if (!songs || songs.length === 0) return;

        playSongList(songs, startIndex);

        songs.forEach((song, index) => {
            setTimeout(() => {
                triggerBackgroundDownload(song);
            }, index * 1000);
        });
    }, [playSongList, triggerBackgroundDownload]);

    return {
        handlePlayTrack,
        handlePlayList,
    };
}

export default useLazyCaching;
