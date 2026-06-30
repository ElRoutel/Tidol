// src/utils/coverArt.ts
// Resuelve la mejor URL de portada para una pista. El endpoint same-origin
// /api/v1/covers/:mbid resuelve, en orden: Cover Art Archive → MusicBrainz →
// iTunes → (fallback) la URL cruda que pasemos. Ser same-origin permite además
// extraer los colores en el cliente sin "tainting" del canvas.

function rawCover(track: any): string | null {
    const real = track?.coverArtUrl || track?.coverFull || track?.artworkUrl || track?.coverUrl
        || track?.cover_url || track?.portada || track?.image
        || track?.attributes?.artwork?.url;
    if (!real) return null;
    const s = String(real);
    if (s.includes('default') || s.startsWith('blob:')) return null;
    return s;
}

function mbidOf(track: any): string | null {
    const id = track?.trackId || track?.id || track?.mbid;
    if (!id) return null;
    const s = String(id);
    return s.startsWith('blob') ? null : s;
}

/**
 * URL de portada para una pista.
 * @param preferBackend si true, usa siempre /api/v1/covers (MusicBrainz primero +
 *        colores same-origin). Úsalo en el reproductor. En tarjetas (bulk) déjalo
 *        en false para no disparar una búsqueda MB por cada tarjeta con portada.
 */
export function getCoverSrc(track: any, preferBackend = false): string {
    const real = rawCover(track);
    const mbid = mbidOf(track);

    if (mbid && (preferBackend || !real)) {
        const fb = real && real.startsWith('http') ? `?fallback=${encodeURIComponent(real)}` : '';
        return `/api/v1/covers/${encodeURIComponent(mbid)}${fb}`;
    }
    return real || '/default-album.png';
}
