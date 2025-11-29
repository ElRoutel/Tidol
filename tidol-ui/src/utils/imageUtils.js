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
    // (A futuro podríamos hacer un proxy para optimizarlas también)
    if (url.startsWith('http')) {
        return url;
    }

    // Si es una ruta local (ej: /uploads/...)
    // Aseguramos que empiece con /uploads para que el backend la encuentre
    // (aunque el backend ya maneja la limpieza, es bueno ser consistente)

    // Construir la URL de optimización
    // Nota: Asumimos que la API está en el mismo host/puerto relativo '/api'
    // Si el frontend y backend están en puertos distintos en dev, esto podría necesitar ajuste (proxy en vite o URL completa)

    // En producción (mismo origen): /api/images/optimize
    // En desarrollo (vite proxy): /api/images/optimize

    const params = new URLSearchParams();
    params.append('path', url);
    if (width) params.append('w', width);
    if (quality) params.append('q', quality);

    return `/api/images/optimize?${params.toString()}`;
};
