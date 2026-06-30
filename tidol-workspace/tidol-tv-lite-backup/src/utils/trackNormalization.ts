import { UnifiedTrack, SourceType } from '../types/music';

/**
 * Normaliza cualquier objeto de canción (de API local o Internet Archive)
 * al contrato UnifiedTrack de Tidol.
 */
export function normalizeTrack(song: any, source?: SourceType): UnifiedTrack {
    if (!song) return null as any;

    // Si ya parece ser un UnifiedTrack, lo devolvemos tal cual (o con retoques)
    if (song.attributes && song.sourceType) {
        return song as UnifiedTrack;
    }

    const sourceType: SourceType = source || (song.identifier ? 'internet-archive' : 'local');

    // Mapeo para Internet Archive
    if (sourceType === 'internet-archive' || song.identifier) {
        return {
            trackId: song.trackId || song.id || song.identifier,
            sourceType: 'internet-archive',
            playbackUrl: song.url || song.playbackUrl,
            // Main DTO Properties
            trackName: song.trackName || song.titulo || song.name || 'Unknown Track',
            artistName: song.artistName || song.artista || 'Unknown Artist',
            albumName: song.albumName || song.album || 'Internet Archive',
            coverArtUrl: song.coverArtUrl || song.coverFull || song.portada || song.artwork?.url || '/default_cover.png',
            
            // Flat properties for UI legacy compatibility
            id: song.trackId || song.id || song.identifier,
            title: song.trackName || song.titulo || song.name || 'Unknown Track',
            artist: song.artistName || song.artista || 'Unknown Artist',
            album: song.albumName || song.album || 'Internet Archive',
            artworkUrl: song.coverArtUrl || song.coverFull || song.portada || song.artwork?.url || '/default_cover.png',
            image: song.coverThumb || song.coverArtUrl || song.portada || song.artwork?.url || '/default_cover.png',
            // Legacy compatibility
            titulo: song.titulo || song.name || 'Unknown Track',
            artista: song.artista || song.artistName || 'Unknown Artist',
            portada: song.coverFull || song.portada || song.artwork?.url || '/default_cover.png',

            attributes: {
                name: song.titulo || song.name || 'Unknown Track',
                artistName: song.artista || song.artistName || 'Unknown Artist',
                albumName: song.album || song.albumName || 'Internet Archive',
                artwork: {
                    url: song.coverFull || song.portada || song.artwork?.url || '/default_cover.png'
                },
                durationInSeconds: song.duracion || song.duration || 0,
                trackNumber: song.trackNumber || undefined,
            },
            rawMetadata: song
        };
    }

    // Mapeo para Local (Backend API)
    return {
        trackId: song.trackId ? String(song.trackId) : String(song.id),
        sourceType: 'local',
        playbackUrl: song.url || song.filepath || song.playbackUrl,
        // Main DTO Properties
        trackName: song.trackName || song.titulo || song.name || 'Unknown Track',
        artistName: song.artistName || song.artista || 'Unknown Artist',
        albumName: song.albumName || song.album || 'Local Album',
        coverArtUrl: song.coverArtUrl || song.coverFull || song.portada || song.artwork?.url || '/default_cover.png',

        // Flat properties for UI legacy compatibility
        id: song.trackId ? String(song.trackId) : String(song.id),
        title: song.trackName || song.titulo || song.name || 'Unknown Track',
        artist: song.artistName || song.artista || 'Unknown Artist',
        album: song.albumName || song.album || 'Local Album',
        artworkUrl: song.coverArtUrl || song.coverFull || song.portada || song.artwork?.url || '/default_cover.png',
        image: song.coverThumb || song.coverArtUrl || song.portada || song.artwork?.url || '/default_cover.png',
        // Legacy compatibility
        titulo: song.titulo || song.name || 'Unknown Track',
        artista: song.artista || song.artistName || 'Unknown Artist',
        portada: song.coverFull || song.portada || song.artwork?.url || '/default_cover.png',

        attributes: {
            name: song.titulo || song.name || 'Unknown Track',
            artistName: song.artista || song.artistName || 'Unknown Artist',
            albumName: song.album || song.albumName || 'Local Album',
            artwork: {
                url: song.coverFull || song.portada || song.artwork?.url || '/default_cover.png'
            },
            durationInSeconds: song.duracion || song.duration || 0,
            trackNumber: song.track_number || song.trackNumber || undefined,
            releaseDate: song.fecha_publicacion || song.releaseDate,
        },
        rawMetadata: song
    };
}

/**
 * Normaliza una lista de canciones.
 */
export function normalizeTrackList(songs: any[], source?: SourceType): UnifiedTrack[] {
    if (!songs || !Array.isArray(songs)) return [];
    return songs.map(s => normalizeTrack(s, source)).filter(Boolean);
}
