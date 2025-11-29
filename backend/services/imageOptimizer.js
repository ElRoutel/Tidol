import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directorio de caché
const CACHE_DIR = path.join(__dirname, '..', 'cache', 'images');
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

// Asegurar que el directorio de caché existe
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

/**
 * Genera un hash único para los parámetros de la imagen
 */
function getCacheKey(filePath, width, height, quality) {
    const data = `${filePath}-${width}-${height}-${quality}`;
    return crypto.createHash('md5').update(data).digest('hex');
}

/**
 * Optimiza una imagen local
 * @param {string} relativePath - Ruta relativa desde 'uploads' (ej: 'covers/album1.jpg')
 * @param {object} options - { width, height, quality }
 * @returns {Promise<string>} - Ruta absoluta al archivo optimizado en caché
 */
export async function optimizeImage(relativePath, options = {}) {
    const { width, height, quality = 80 } = options;

    // 1. Validar ruta de entrada
    // Permitir rutas que empiecen con /uploads/ o sin él
    const cleanPath = relativePath.replace(/^\/?uploads\//, '').replace(/^\//, '');
    const inputPath = path.join(UPLOADS_DIR, cleanPath);

    if (!fs.existsSync(inputPath)) {
        throw new Error('Image not found');
    }

    // 2. Generar clave de caché
    const cacheKey = getCacheKey(cleanPath, width, height, quality);
    const ext = path.extname(cleanPath).toLowerCase() || '.jpg';
    const cacheFilename = `${cacheKey}${ext}`;
    const cachePath = path.join(CACHE_DIR, cacheFilename);

    // 3. Verificar si ya existe en caché
    if (fs.existsSync(cachePath)) {
        // Opcional: Verificar fecha de modificación para invalidar caché si el original cambió
        const inputStats = fs.statSync(inputPath);
        const cacheStats = fs.statSync(cachePath);

        if (cacheStats.mtime > inputStats.mtime) {
            return cachePath;
        }
    }

    // 4. Procesar imagen con Sharp
    try {
        let pipeline = sharp(inputPath);

        if (width || height) {
            pipeline = pipeline.resize({
                width: width ? parseInt(width) : null,
                height: height ? parseInt(height) : null,
                fit: 'cover',
                withoutEnlargement: true
            });
        }

        // Comprimir según formato
        if (ext === '.png') {
            pipeline = pipeline.png({ quality: parseInt(quality), compressionLevel: 8 });
        } else if (ext === '.webp') {
            pipeline = pipeline.webp({ quality: parseInt(quality) });
        } else {
            // Default jpeg
            pipeline = pipeline.jpeg({ quality: parseInt(quality), mozjpeg: true });
        }

        await pipeline.toFile(cachePath);
        return cachePath;

    } catch (err) {
        console.error('Error optimizing image:', err);
        // Si falla la optimización, devolver el original como fallback (o lanzar error)
        return inputPath;
    }
}

/**
 * Limpia el caché de imágenes (opcional, para mantenimiento)
 */
export async function clearImageCache() {
    if (fs.existsSync(CACHE_DIR)) {
        fs.rmSync(CACHE_DIR, { recursive: true, force: true });
        fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
}
