// src/hooks/useLazyCaching.js
import { useCallback } from 'react';
import { usePlayer } from '../context/PlayerContext';

export function useLazyCaching() {
    const { playSongList } = usePlayer();

    const triggerBackgroundDownload = useCallback((song) => {
        if (!song.url) {
            console.warn('⚠️  Canción sin URL, saltando descarga:', song.titulo);
            return;
        }

        if (song.url.startsWith('/uploads/') || song.url.startsWith('http://localhost')) {
            console.log('💾 Canción ya está en caché local:', song.titulo);
            return;
        }

        if (!song.url.startsWith('http://') && !song.url.startsWith('https://')) {
            console.warn('⚠️  URL inválida, saltando descarga:', song.url);
            return;
        }

        if (!song.url.includes('archive.org')) {
            console.warn('⚠️  URL no es de Internet Archive:', song.url);
        }

        // Usar la ruta relativa (proxied vía backend) para mejor compatibilidad LAN
        const SPECTRA_URL = '/spectra';

        fetch(`${SPECTRA_URL}/ingest-remote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                audioUrl: song.url,
                coverUrl: song.portada || null,
                metadata: {
                    title: song.titulo || song.title,
                    artist: song.artista || song.artist || 'Unknown',
                    album: song.album || 'Internet Archive',
                    ia_id: song.identifier || (song.type === 'ia' ? song.id : song.id),
                    duration: song.duracion || song.duration || 0
                }
            })
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    if (data.alreadyExists) {
                        console.log('💾 Canción ya estaba en caché:', song.titulo);
                    } else {
                        console.log('📥 Descarga iniciada:', song.titulo, `(Track ID: ${data.trackId})`);
                    }
                } else {
                    console.warn('⚠️  Backend respondió con error:', data.error);
                }
            })
            .catch(error => {
                console.warn('⚠️  No se pudo cachear la canción:', error.message);
            });
    }, []);

    const handlePlayTrack = useCallback(async (song) => {
        if (!song || !song.url) {
            console.error('❌ useLazyCaching: Canción inválida o sin URL');
            return;
        }

        playSongList([song], 0);
        console.log('▶️  Reproducción iniciada:', song.titulo);
        triggerBackgroundDownload(song);
    }, [playSongList, triggerBackgroundDownload]);

    const handlePlayList = useCallback((songs, startIndex = 0) => {
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
