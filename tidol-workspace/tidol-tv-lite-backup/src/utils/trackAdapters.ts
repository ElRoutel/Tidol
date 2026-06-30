import { UnifiedTrack } from '../types/music';

/**
 * Adaptador para resultados de la API de YouTube (ejemplo conceptual).
 */
export function mapYouTubeToTrack(ytData: any): UnifiedTrack {
    return {
        id: `yt-${ytData.id.videoId || ytData.id}`,
        sourceType: 'youtube',
        playbackUrl: ytData.streamUrl || '', // Provisto por el backend/extractor
        attributes: {
            name: ytData.snippet.title,
            artistName: ytData.snippet.channelTitle,
            artwork: {
                // Convertimos el thumbnail de YT al formato dinámico si es posible, 
                // o lo dejamos estático.
                url: ytData.snippet.thumbnails.high.url,
            },
            durationInSeconds: 0, // YouTube requiere parsing adicional para la duración
        },
        rawMetadata: ytData
    };
}

/**
 * Adaptador para metadatos de archivos locales.
 */
export function mapLocalFileToTrack(localData: any): UnifiedTrack {
    return {
        id: `local-${localData.id}`,
        sourceType: 'local',
        playbackUrl: `/api/stream/local/${localData.id}`,
        attributes: {
            name: localData.title || localData.filename,
            artistName: localData.artist || 'Artista Desconocido',
            albumName: localData.album,
            artwork: {
                url: localData.coverUrl || '/default_cover.png',
                bgColor: localData.extractedColors?.vibrant || '#121212'
            },
            durationInSeconds: localData.duration || 0,
            isLiked: localData.isLiked
        }
    };
}

/**
 * Adaptador para resultados de Internet Archive.
 */
export function mapArchiveToTrack(item: any): UnifiedTrack {
    const identifier = item.identifier || (item.id && item.id.startsWith('ia_') ? item.id.replace('ia_', '') : item.id);
    return {
        id: item.id || `ia_${identifier}`,
        sourceType: 'internet-archive',
        playbackUrl: item.url || `https://archive.org/download/${identifier}/${item.filename || ''}`,
        attributes: {
            name: item.titulo || item.title || 'Sin título',
            artistName: item.artista || item.artist || item.creator || 'Autor desconocido',
            albumName: item.album || null,
            artwork: {
                url: item.portada || `https://archive.org/services/img/${identifier}`,
            },
            durationInSeconds: item.duracion || item.duration || 0,
            releaseDate: item.year || item.date || null,
        },
        rawMetadata: item
    };
}

/**
 * Adaptador para resultados de Torrents.
 */
export function mapTorrentToTrack(torrentData: any): UnifiedTrack {
    return {
        id: `torrent-${torrentData.infoHash}`,
        sourceType: 'torrent',
        playbackUrl: torrentData.streamUrl || '', // Resuelto por el backend/webseed
        attributes: {
            name: torrentData.name || torrentData.title,
            artistName: torrentData.artist || 'Fuente P2P',
            albumName: torrentData.album,
            artwork: {
                url: torrentData.poster || '/default_cover.png',
                bgColor: '#2c3e50' // Estilo industrial para torrents
            },
            durationInSeconds: torrentData.duration || 0,
        },
        rawMetadata: torrentData
    };
}
