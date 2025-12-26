
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../models/db.js';
import { getProxyStream } from './iaProxy.service.js';
import { promisify } from 'util';
import stream from 'stream';

const pipeline = promisify(stream.pipeline);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_DIR = path.join(__dirname, '..', 'uploads', 'cache');

// Asegurar directorio de caché
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

/**
 * Servicio de Caché Respetuoso
 * Descarga contenido de IA una sola vez y lo convierte en local.
 */
class MediaCacheService {

    constructor() {
        this.pendingDownloads = new Set(); // Evitar descargas duplicadas simultáneas
    }

    /**
     * Inicia el proceso de cacheo en segundo plano.
     * @param {string} identifier - El identificador de Internet Archive (o ia_ID)
     * @param {object} meta - Metadatos opcionales { titulo, artista, album, year, url, coverUrl, duration }
     */
    async cacheSong(identifier, meta) {
        // Limpieza de ID
        const cleanId = identifier.replace('ia_', '');

        // 1. Evitar duplicados en vuelo
        if (this.pendingDownloads.has(cleanId)) {
            console.log(`⏳ Cache para ${cleanId} ya está en proceso.`);
            return;
        }

        // 2. Verificar si ya existe localmente
        const existing = await db.get("SELECT id FROM canciones WHERE ia_id = ?", [cleanId]);
        if (existing) {
            // console.log(`✅ ${cleanId} ya está en DB local.`);
            return;
        }

        this.pendingDownloads.add(cleanId);
        console.log(`📥 Iniciando caché respetuoso para: ${meta.titulo || cleanId}`);

        try {
            const songDir = path.join(CACHE_DIR, cleanId);
            if (!fs.existsSync(songDir)) fs.mkdirSync(songDir, { recursive: true });

            // 3. Descargar Audio
            let audioFileName = `audio.mp3`; // Default
            if (meta.url.endsWith('.flac')) audioFileName = `audio.flac`;

            const audioPath = path.join(songDir, audioFileName);

            // Solo descargar si no existe el archivo (resume capabilities basicas)
            if (!fs.existsSync(audioPath) || fs.statSync(audioPath).size < 1000) {
                await this.downloadFile(meta.url, audioPath);
            }

            // 4. Descargar Cover
            const coverPath = path.join(songDir, 'cover.jpg');
            // Intentar descargar cover si tenemos URL y no existe
            if (meta.portada && (!fs.existsSync(coverPath) || fs.statSync(coverPath).size < 1000)) {
                // Si la portada es un servicio de IA (redirect), intentar resolverla o descargarla
                // Por simplicidad, intentamos descargarla directamente.
                try {
                    await this.downloadFile(meta.portada, coverPath);
                } catch (e) {
                    console.warn(`⚠️ No se pudo cachear portada para ${cleanId}: ${e.message}`);
                    // No fallamos toda la operación, usamos un placeholder o la URL remota temporalmente
                }
            }

            // 5. Registrar en DB como canción LOCAL
            const relativeAudioPath = `uploads/cache/${cleanId}/${audioFileName}`;
            const relativeCoverPath = fs.existsSync(coverPath) ? `uploads/cache/${cleanId}/cover.jpg` : meta.portada;

            await this.registerLocalSong({
                ia_id: cleanId,
                titulo: meta.titulo || cleanId,
                artista: meta.artista || "Desconocido",
                album: meta.album || "Internet Archive",
                duracion: meta.duration || 0,
                archivo: relativeAudioPath,
                portada: relativeCoverPath,
                year: meta.year
            });

            console.log(`✨ Caché completado para: ${cleanId}`);

        } catch (error) {
            console.error(`❌ Error cacheando ${cleanId}:`, error.message);
            // Limpiar archivos corruptos parciales si es necesario
        } finally {
            this.pendingDownloads.delete(cleanId);
        }
    }

    async downloadFile(url, destPath) {
        // console.log(`⬇️ Descargando: ${url}`);
        const { stream: dataStream } = await getProxyStream(url);
        const fileWriter = fs.createWriteStream(destPath);
        await pipeline(dataStream, fileWriter);
    }

    async registerLocalSong(data) {
        // Buscar o Crear Artista
        let artistaId = null;
        const artistaRow = await db.get("SELECT id FROM artistas WHERE nombre = ?", [data.artista]);
        if (artistaRow) {
            artistaId = artistaRow.id;
        } else {
            const res = await db.run("INSERT INTO artistas (nombre, imagen) VALUES (?, ?)", [data.artista, '/img/default-artist.png']);
            artistaId = res.lastID;
        }

        // Buscar o Crear Álbum
        let albumId = null;
        const albumRow = await db.get("SELECT id FROM albumes WHERE titulo = ? AND artista_id = ?", [data.album, artistaId]);
        if (albumRow) {
            albumId = albumRow.id;
        } else {
            const res = await db.run("INSERT INTO albumes (titulo, artista_id, portada) VALUES (?, ?, ?)", [data.album, artistaId, data.portada]);
            albumId = res.lastID;
        }

        // Insertar Canción
        await db.run(`
            INSERT INTO canciones (
                titulo, archivo, artista_id, album_id, duracion, portada, ia_id, fecha_subida
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            data.titulo,
            data.archivo,
            artistaId,
            albumId,
            data.duracion,
            data.portada,
            data.ia_id,
            Date.now()
        ]);
    }
}

export const mediaCacheService = new MediaCacheService();
