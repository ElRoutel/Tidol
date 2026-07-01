// src/utils/coverArt.ts
// Resuelve la mejor URL de portada para una pista.
//
// FUENTE ÚNICA DE VERDAD: si la pista ya trae una portada real (la misma que ve
// la card del Home), esa portada se usa TAL CUAL en bar, fullscreen y MediaSession.
// Antes el reproductor forzaba una re-resolución en vivo contra /api/v1/covers/:mbid
// (MusicBrainz), que en compilaciones puntuaba OTRO álbum (portada errónea) y hacía
// varios round-trips secuenciales (caja gris ~6s al abrir el fullscreen). El endpoint
// same-origin /api/v1/covers ahora solo se usa cuando la pista NO tiene portada
// (enriquecimiento) o para extraer colores sin "tainting" del canvas (getColorSourceSrc).

function rawCover(track: any): string | null {
    const real = track?.coverArtUrl || track?.coverFull || track?.artworkUrl || track?.coverUrl
        || track?.cover_url || track?.portada || track?.image
        || track?.attributes?.artwork?.url
        // Miniatura resuelta (p.ej. YouTube). Solo como último recurso; se guarda
        // aparte de coverArtUrl para no alterar la URL de la portada ya mostrada.
        || track?.ytThumbnail;
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
 * URL de portada para MOSTRAR (bar, fullscreen, MediaSession, cards).
 * Prioridad: resolvedCover congelada → portada real de la pista → backend por mbid.
 * El parámetro `preferBackend` se conserva por compatibilidad con las llamadas
 * existentes pero YA NO fuerza el endpoint MusicBrainz: la portada real siempre gana
 * para garantizar consistencia card == bar == fullscreen y evitar la caja gris.
 */
export function getCoverSrc(track: any, _preferBackend = false): string {
    // Portada ya resuelta y congelada en el context (fuente única de verdad).
    if (track?.resolvedCover) return String(track.resolvedCover);

    const real = rawCover(track);
    if (real) return real;

    const mbid = mbidOf(track);
    if (mbid) return `/api/v1/covers/${encodeURIComponent(mbid)}`;

    return '/default-album.png';
}

/**
 * URL same-origin para EXTRAER COLORES en el cliente sin tainting del canvas.
 * Usa /api/v1/covers/:mbid (con la portada real como fallback) para que el canvas
 * sea legible aunque la portada real sea de otro dominio. Solo se usa para el
 * degradado de fondo; nunca para la portada visible.
 */
export function getColorSourceSrc(track: any): string | null {
    const mbid = mbidOf(track);
    const real = rawCover(track);
    if (mbid) {
        const fb = real && real.startsWith('http') ? `?fallback=${encodeURIComponent(real)}` : '';
        return `/api/v1/covers/${encodeURIComponent(mbid)}${fb}`;
    }
    return real; // sin mbid: intentamos con la real (puede quedar tainted → sin colores)
}
