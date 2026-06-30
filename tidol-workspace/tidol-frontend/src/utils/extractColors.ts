// src/utils/extractColors.ts
// Extracción de paleta de colores 100% en el cliente (canvas), sin librerías
// ni llamadas al backend. Reduce carga del servidor: el navegador ya tiene la
// imagen de la portada, así que muestreamos sus píxeles localmente.

export interface ExtractedColors {
    dominant: string;
    secondary: string;
    accent: string;
    lightVibrant: string;
    darkMuted: string;
}

const toHex = (r: number, g: number, b: number) =>
    '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

function luminance(r: number, g: number, b: number) {
    return 0.2126 * r + 0.7152 * g + 0.114 * b;
}
function saturation(r: number, g: number, b: number) {
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    return max === 0 ? 0 : (max - min) / max;
}

/**
 * Extrae una paleta a partir de una URL de imagen (idealmente del mismo origen,
 * p.ej. /api/v1/covers/:mbid, para evitar el "tainting" del canvas).
 * Devuelve null si la imagen no se puede leer (cross-origin sin CORS, error…).
 */
export function extractColorsFromUrl(url: string): Promise<ExtractedColors | null> {
    return new Promise((resolve) => {
        if (!url) return resolve(null);
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            try {
                const size = 48; // muestreo reducido = rápido
                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                if (!ctx) return resolve(null);
                ctx.drawImage(img, 0, 0, size, size);
                const { data } = ctx.getImageData(0, 0, size, size);

                // Histograma cuantizado (4 bits/canal) ignorando píxeles transparentes.
                const buckets = new Map<number, { r: number; g: number; b: number; n: number }>();
                for (let i = 0; i < data.length; i += 4) {
                    const a = data[i + 3];
                    if (a < 125) continue;
                    const r = data[i], g = data[i + 1], b = data[i + 2];
                    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
                    const e = buckets.get(key);
                    if (e) { e.r += r; e.g += g; e.b += b; e.n++; }
                    else buckets.set(key, { r, g, b, n: 1 });
                }
                if (buckets.size === 0) return resolve(null);

                const clusters = [...buckets.values()]
                    .map((c) => ({ r: c.r / c.n, g: c.g / c.n, b: c.b / c.n, n: c.n }))
                    .sort((a, b) => b.n - a.n);

                const dom = clusters[0];
                // Secundario: el siguiente cluster suficientemente distinto del dominante.
                const sec = clusters.find((c) =>
                    Math.abs(c.r - dom.r) + Math.abs(c.g - dom.g) + Math.abs(c.b - dom.b) > 60
                ) || dom;
                // Acento: el más saturado entre los más frecuentes.
                const accent = [...clusters].slice(0, 8).sort(
                    (a, b) => saturation(b.r, b.g, b.b) - saturation(a.r, a.g, a.b)
                )[0] || dom;
                const lightVibrant = [...clusters].slice(0, 12).sort(
                    (a, b) => (luminance(b.r, b.g, b.b) * (0.4 + saturation(b.r, b.g, b.b)))
                            - (luminance(a.r, a.g, a.b) * (0.4 + saturation(a.r, a.g, a.b)))
                )[0] || dom;
                const darkMuted = [...clusters].slice(0, 12).sort(
                    (a, b) => luminance(a.r, a.g, a.b) - luminance(b.r, b.g, b.b)
                )[0] || dom;

                resolve({
                    dominant: toHex(dom.r, dom.g, dom.b),
                    secondary: toHex(sec.r, sec.g, sec.b),
                    accent: toHex(accent.r, accent.g, accent.b),
                    lightVibrant: toHex(lightVibrant.r, lightVibrant.g, lightVibrant.b),
                    darkMuted: toHex(darkMuted.r, darkMuted.g, darkMuted.b),
                });
            } catch {
                resolve(null); // canvas tainted (cross-origin sin CORS) u otro error
            }
        };
        img.onerror = () => resolve(null);
        img.src = url;
    });
}
