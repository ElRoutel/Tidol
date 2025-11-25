// src/hooks/useLazyCaching.js
import { useCallback } from 'react';
import { usePlayer } from '../context/PlayerContext';

/**
 * Hook personalizado para manejar Lazy Caching de canciones de Internet Archive
 * 
 * Uso:
 * ```js
 * const { handlePlayTrack } = useLazyCaching();
 * 
 * // Al hacer click en una canción de IA:
 * handlePlayTrack(iaSongData);
 * ```
 */
export function useLazyCaching() {
    const { playSongList } = usePlayer();

    /**
     * Reproduce una canción de Internet Archive inmediatamente
     * y dispara la descarga en segundo plano al backend Spectra
     * 
     * @param {Object} song - Objeto de canción con estructura de Internet Archive
     * @param {string} song.url - URL del archivo de audio remoto
     * @param {string} song.portada - URL de la imagen de portada
     * @param {string} song.titulo - Título de la canción
     * @param {string} song.artista - Artista
     * @param {string} song.identifier - ID de Internet Archive
     * @param {number} song.duracion - Duración en segundos
     * @param {string} song.album - Álbum (opcional)
     */
    const handlePlayTrack = useCallback(async (song) => {
        if (!song || !song.url) {
            console.error('❌ useLazyCaching: Canción inválida o sin URL');
            return;
        }

        try {
            // 1. REPRODUCCIÓN INMEDIATA (UI optimista)
            // Reproduce desde la URL remota para que no haya lag  
            playSongList([song], 0);
            console.log('▶️  Reproducción iniciada:', song.titulo);

            // 2. DESCARGA SILENCIOSA EN SEGUNDO PLANO
            // Disparar petición al backend para cachear la canción
            triggerBackgroundDownload(song);

        } catch (error) {
            console.error('❌ Error en handlePlayTrack:', error);
        }
    }, [playSongList]);

    /**
     * Dispara la descarga en segundo plano sin bloquear la UI
     * Usa fire-and-forget pattern (no esperamos la respuesta)
     * 
     * @param {Object} song - Objeto de canción
     */
    const triggerBackgroundDownload = useCallback((song) => {
        // Validar que tenga una URL válida
        if (!song.url) {
            console.warn('⚠️  Canción sin URL, saltando descarga:', song.titulo);
            return;
        }

        // NO intentar descargar si la URL es local (ya está cacheada)
        if (song.url.startsWith('/uploads/') || song.url.startsWith('http://localhost') || song.url.startsWith('https://localhost')) {
            console.log('💾 Canción ya está en caché local:', song.titulo);
            return;
        }

        // Validar que sea una URL remota válida
        if (!song.url.startsWith('http://') && !song.url.startsWith('https://')) {
            console.warn('⚠️  URL inválida, saltando descarga:', song.url);
            return;
        }

        // Preferiblemente de Internet Archive
        if (!song.url.includes('archive.org')) {
            console.warn('⚠️  URL no es de Internet Archive:', song.url);
            // Continuamos de todas formas
        }

        // No usamos await aquí - fire and forget
        // La descarga ocurre en segundo plano sin bloquear
        const SPECTRA_URL = 'http://localhost:3001';

        fetch(`${SPECTRA_URL}/ingest-remote`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                audioUrl: song.url,
                coverUrl: song.portada || null,
                metadata: {
                    title: song.titulo || song.title,
                    artist: song.artista || song.artist || 'Unknown',
                    album: song.album || 'Internet Archive',
                    ia_id: song.identifier || song.id,
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
                // No mostramos error al usuario, solo logging
                console.warn('⚠️  No se pudo cachear la canción:', error.message);
                console.log('   (Esto no afecta la reproducción, seguirá usando la URL remota)');
            });
    }, []);

    /**
     * Reproduce una lista de canciones de IA y dispara descarga de todas
     * @param {Array} songs - Array de canciones de IA
     * @param {number} startIndex - Índice de inicio (default: 0)
     */
    const handlePlayList = useCallback((songs, startIndex = 0) => {
        if (!songs || songs.length === 0) return;

        // Reproducir lista inmediatamente
        playSongList(songs, startIndex);

        // Descargar todas las canciones en segundo plano
        songs.forEach((song, index) => {
            // Pequeño delay entre cada descarga para no saturar el backend
            setTimeout(() => {
                triggerBackgroundDownload(song);
            }, index * 1000); // 1 segundo entre cada una
        });
    }, [playSongList, triggerBackgroundDownload]);

    return {
        handlePlayTrack,
        handlePlayList,
    };
}

export default useLazyCaching;
