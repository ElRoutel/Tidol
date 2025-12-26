/**
 * Response Formatter - Zero Client-Side Processing
 * Pre-processes ALL data for optimal frontend performance.
 */

/**
 * Format duration in seconds to "M:SS" string
 * @param {number} seconds 
 * @returns {string}
 */
export function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/**
 * Generate optimized cover URL with target width
 * @param {string} coverPath 
 * @param {number} width - Target width (300 for thumbs, 1000 for full)
 * @returns {string}
 */
export function getOptimizedCoverUrl(coverPath, width = 300) {
    if (!coverPath) return '/default_cover.png';

    // If external URL (Internet Archive, etc), return as-is
    if (coverPath.startsWith('http')) return coverPath;

    // If local, use image optimizer endpoint
    if (coverPath.startsWith('/uploads') || coverPath.startsWith('/assets')) {
        const params = new URLSearchParams();
        params.append('path', coverPath);
        params.append('w', width);
        params.append('q', 85); // Quality
        return `/api/images/optimize?${params.toString()}`;
    }

    return coverPath;
}

/**
 * Format a song object for client consumption
 * PRE-FORMATS: duration, cover URLs, colors
 * MINIMIZES: payload size
 */
export function formatSongForClient(song) {
    const originalCover = song.portada || song.cover_url || '/default_cover.png';

    return {
        id: song.id,
        titulo: song.titulo,
        artista: song.artista,
        album: song.album,
        albumId: song.album_id || song.albumId,

        // PRE-FORMATTED
        durationFormatted: formatDuration(song.duracion || song.duration),

        // OPTIMIZED URLs (thumb for lists, full for player)
        coverThumb: getOptimizedCoverUrl(originalCover, 300),
        coverFull: getOptimizedCoverUrl(originalCover, 1000),

        // BACKWARD COMPATIBILITY: Keep original for components not yet updated
        portada: originalCover,

        // PRE-PARSED colors
        extractedColors: song.extracted_colors ? JSON.parse(song.extracted_colors) : null,

        // Audio metadata (no processing needed)
        url: song.url || song.archivo,
        bitRate: song.bit_rate,
        sampleRate: song.sample_rate,
        bitDepth: song.bit_depth,

        // Source tracking
        source: song.source || (song.identifier ? 'internet_archive' : 'local'),
        identifier: song.identifier
    };
}

/**
 * Format an album object for client
 */
export function formatAlbumForClient(album) {
    const originalCover = album.portada || '/default_cover.png';
    const author = album.autor || album.artist || 'Desconocido';
    const year = album.anio || album.year || null;

    // Build a friendly display title: "Artist - Album (Year)"
    const displayTitle = year ? `${author} - ${album.titulo} (${year})` : `${author} - ${album.titulo}`;

    return {
        id: album.id,
        // Keep raw titulo for internal use but expose a display-friendly title
        titulo: album.titulo,
        displayTitle,
        autor: author,
        year,

        // OPTIMIZED URLs
        coverThumb: getOptimizedCoverUrl(originalCover, 300),
        coverFull: getOptimizedCoverUrl(originalCover, 800),

        // BACKWARD COMPATIBILITY
        portada: originalCover,

        // PRE-PARSED colors
        extractedColors: album.extracted_colors ? JSON.parse(album.extracted_colors) : null
    };
}

/**
 * Format artist object
 */
export function formatArtistForClient(artist) {
    return {
        id: artist.id,
        nombre: artist.nombre,
        imagen: getOptimizedCoverUrl(artist.imagen, 500),
        albums: artist.albums,
        canciones: artist.canciones
    };
}

/**
 * Batch format songs
 */
export function formatSongsForClient(songs) {
    if (!Array.isArray(songs)) return [];
    return songs.map(formatSongForClient);
}

/**
 * Batch format albums
 */
export function formatAlbumsForClient(albums) {
    if (!Array.isArray(albums)) return [];
    return albums.map(formatAlbumForClient);
}

/**
 * Batch format artists
 */
export function formatArtistsForClient(artists) {
    if (!Array.isArray(artists)) return [];
    return artists.map(formatArtistForClient);
}
