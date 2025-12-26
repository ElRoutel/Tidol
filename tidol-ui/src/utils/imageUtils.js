/**
 * Generates an optimized image URL using the backend service.
 * @param {string} url - The original image URL (local path or external URL).
 * @param {number} width - Target width in pixels.
 * @param {number} [quality=80] - Image quality (1-100).
 * @returns {string} - The optimized URL or the original if optimization is not applicable.
 */
export const getOptimizedImageUrl = (url, width, quality = 80) => {
    if (!url) return '/img/default-album.png'; // Fallback placeholder

    // Si es una URL externa (http/https), por ahora la devolvemos tal cual
    if (url.startsWith('http')) {
        return url;
    }

    // Skip optimization for static assets that are not in uploads
    // Examples: /default_cover.png, /img/..., /default_artist.png
    if (url.startsWith('/img/') || url.includes('default_') || !url.startsWith('/uploads')) {
        return url;
    }

    // Construir la URL de optimización
    const params = new URLSearchParams();
    params.append('path', url);
    if (width) params.append('w', width);
    if (quality) params.append('q', quality);

    return `/api/images/optimize?${params.toString()}`;
};
