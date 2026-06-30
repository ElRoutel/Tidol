/**
 * Resuelve una URL de arte reemplazando los placeholders de tamaño {w} y {h}.
 * Inspirado en la lógica de MusicKit JS.
 * 
 * @param url URL de la imagen con placeholders (ej: ".../{w}x{h}bb.jpg") o URL estática.
 * @param size El tamaño deseado para la imagen (se aplica a ancho y alto).
 * @returns La URL procesada o una imagen por defecto.
 */
export function resolveArtworkUrl(url: string | undefined, size: number = 600): string {
    if (!url) {
        return '/default_cover.png';
    }

    // Reemplazar placeholders de MusicKit / Apple Music
    let resolved = url
        .replace('{w}', size.toString())
        .replace('{h}', size.toString());

    // Mapeo legacy: si la URL contiene dimensiones fijas (ej: 600x600), intentar cambiarlas
    // Esto es útil para fuentes como Spotify o iTunes API que a veces no usan placeholders
    const dimensionRegex = /(\d+)x(\d+)/;
    if (dimensionRegex.test(resolved) && !url.includes('{w}')) {
        resolved = resolved.replace(dimensionRegex, `${size}x${size}`);
    }

    return resolved;
}
