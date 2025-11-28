const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const mm = require('music-metadata');
const { spawn } = require('child_process'); // Vital para llamar a Python
const axios = require('axios');

const app = express();
const PORT = 3001;

// --- CONFIGURACIÓN ---
app.use(cors());
app.use(express.json());

const MEDIA_DIR = path.join(__dirname, 'media');
const UPLOADS_MUSIC_DIR = path.join(__dirname, 'uploads', 'musica');
const UPLOADS_COVERS_DIR = path.join(__dirname, 'uploads', 'covers');
const DB_PATH_SPECTRA = path.join(__dirname, 'spectra.db');

// Asegurar que existan las carpetas
if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR);
if (!fs.existsSync(UPLOADS_MUSIC_DIR)) fs.mkdirSync(UPLOADS_MUSIC_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_COVERS_DIR)) fs.mkdirSync(UPLOADS_COVERS_DIR, { recursive: true });

// --- DB SPECTRA (Local) ---
const dbSpectra = new Database(DB_PATH_SPECTRA);
dbSpectra.pragma('journal_mode = WAL'); // Enable WAL for concurrency

// --- JOB QUEUE SYSTEM ---
class JobQueue {
    constructor(concurrency = 2) {
        this.concurrency = concurrency;
        this.running = 0;
        this.queue = [];
    }

    add(jobFn) {
        return new Promise((resolve, reject) => {
            this.queue.push({ jobFn, resolve, reject });
            this.process();
        });
    }

    async process() {
        if (this.running >= this.concurrency || this.queue.length === 0) return;

        this.running++;
        const { jobFn, resolve, reject } = this.queue.shift();

        try {
            const result = await jobFn();
            resolve(result);
        } catch (error) {
            reject(error);
        } finally {
            this.running--;
            this.process();
        }
    }
}

// Separate queues for different task types to prevent starvation
const analysisQueue = new JobQueue(2); // Lightweight analysis
const voxQueue = new JobQueue(1);      // Heavy VOX separation (Spleeter is RAM hungry)
const lyricsQueue = new JobQueue(1);   // Lyrics generation (Future Whisper)

// Tabla actualizada con todos los campos necesarios
dbSpectra.exec(`
  CREATE TABLE IF NOT EXISTS tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    artist TEXT,
    album TEXT,
    filepath TEXT UNIQUE,
    coverpath TEXT,
    duration REAL,
    bitrate INTEGER,
    format TEXT,
    bpm REAL DEFAULT 0,
    key_signature TEXT,
    waveform_data TEXT, 
    original_ia_id TEXT,
    original_tidol_id INTEGER,
    analysis_status TEXT DEFAULT 'pending'
  );
`);

console.log('💿 SPECTRA Database: Ready');

// --- DB TIDOL (CONEXIÓN BLINDADA) ---
let dbTidol;
const PATH_OPCION_A = path.join(__dirname, '../backend/models/database.sqlite');
const PATH_OPCION_B = path.join(__dirname, '../Tidol/backend/models/database.sqlite');
// Elegimos la ruta que exista
let DB_PATH_TIDOL = fs.existsSync(PATH_OPCION_A) ? PATH_OPCION_A : PATH_OPCION_B;

try {
    if (!fs.existsSync(DB_PATH_TIDOL)) {
        // Si no existe ninguna, lanzamos error controlado
        throw new Error("No se encuentra el archivo .sqlite en ninguna ruta estándar.");
    }
    // dbTidol = new Database(DB_PATH_TIDOL, { readonly: true });
    // console.log(`💾 TIDOL LEGACY DB: Conectada.`);
    throw new Error("Bridge deshabilitado temporalmente para evitar corrupción de DB.");
} catch (err) {
    console.warn(`⚠️  ADVERTENCIA: Bridge desactivado. (${err.message})`);
    dbTidol = null;
}

// --- RUTAS ---

// 1. Bridge: Recomendaciones
app.get('/bridge/recommendations', (req, res) => {
    if (!dbTidol) return res.status(503).json({ error: 'Bridge desactivado' });
    try {
        const history = dbTidol.prepare(`
            SELECT ia_identifier, titulo, artista, url, played_at
            FROM ia_history ORDER BY played_at DESC LIMIT 50
        `).all();

        const recommendations = history.map(item => {
            const localMatch = dbSpectra.prepare(`
                SELECT id FROM tracks WHERE title = ? OR original_ia_id = ?
            `).get(item.titulo, item.ia_identifier);
            return {
                ...item,
                status: localMatch ? 'upgraded' : 'needs_upgrade',
                local_id: localMatch ? localMatch.id : null
            };
        });
        res.json(recommendations);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 2. Ingesta Inteligente (Con protección de duplicados)
app.post('/ingest', async (req, res) => {
    const { filename, ia_id, metadata_override } = req.body;
    const filePath = path.join(MEDIA_DIR, filename);

    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });

    try {
        // Verificar si ya existe para no romper la DB
        const existingTrack = dbSpectra.prepare('SELECT id FROM tracks WHERE filepath = ?').get(filename);

        if (existingTrack) {
            // Si existe, solo re-analizamos y avisamos
            runPythonAnalysis(existingTrack.id, filePath);
            return res.json({ success: true, trackId: existingTrack.id, msg: "Re-analyzing existing track..." });
        }

        const fileMeta = await mm.parseFile(filePath);
        const info = {
            title: metadata_override?.title || fileMeta.common.title || filename,
            artist: metadata_override?.artist || fileMeta.common.artist || 'Unknown',
            album: fileMeta.common.album || 'Spectra Import',
            filepath: filename,
            duration: fileMeta.format.duration,
            bitrate: fileMeta.format.bitrate,
            format: fileMeta.format.container,
            original_ia_id: ia_id || null
        };

        const insert = dbSpectra.prepare(`
            INSERT INTO tracks (title, artist, album, filepath, duration, bitrate, format, original_ia_id)
            VALUES (@title, @artist, @album, @filepath, @duration, @bitrate, @format, @original_ia_id)
        `);
        const result = insert.run(info);

        res.json({ success: true, trackId: result.lastInsertRowid, msg: "Analysis started" });

        // Disparar Python
        runPythonAnalysis(result.lastInsertRowid, filePath);

    } catch (error) {
        console.error("Error Ingest:", error);
        res.status(500).json({ error: error.message });
    }
});

// 3. Streaming (Soporta media/ y uploads/musica/)
app.get('/stream/:id', (req, res) => {
    const track = dbSpectra.prepare('SELECT * FROM tracks WHERE id = ?').get(req.params.id);
    if (!track) return res.status(404).send('Not found');

    // Buscar archivo: primero en la ruta exacta, luego en MEDIA_DIR
    let filePath;
    if (track.filepath.startsWith('uploads/')) {
        // Archivo cacheado de Internet Archive
        filePath = path.join(__dirname, track.filepath);
    } else {
        // Archivo legacy en media/
        filePath = path.join(MEDIA_DIR, track.filepath);
    }

    if (!fs.existsSync(filePath)) {
        console.error(`❌ Archivo no encontrado: ${filePath}`);
        return res.status(404).send('File missing');
    }

    const stat = fs.statSync(filePath);
    const range = req.headers.range;

    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(filePath, { start, end });
        const head = {
            'Content-Range': `bytes ${start}-${end}/${stat.size}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'audio/mpeg',
        };
        res.writeHead(206, head);
        file.pipe(res);
    } else {
        res.writeHead(200, { 'Content-Length': stat.size, 'Content-Type': 'audio/mpeg' });
        fs.createReadStream(filePath).pipe(res);
    }
});

// 4. Datos de Análisis (Waveform, BPM)
app.get('/track/:id/analysis', (req, res) => {
    const track = dbSpectra.prepare('SELECT id, bpm, key_signature, waveform_data, analysis_status FROM tracks WHERE id = ?').get(req.params.id);
    if (track && track.waveform_data) {
        try { track.waveform_data = JSON.parse(track.waveform_data); }
        catch (e) { track.waveform_data = []; }
    }
    res.json(track);
});

// 5. Smart Flow (Playlist Automática por BPM)
app.get('/smart-queue/bpm-flow', (req, res) => {
    try {
        // Usamos dbSpectra aquí (antes fallaba porque decía 'db')
        const playlist = dbSpectra.prepare(`
            SELECT id, title, artist, bpm, key_signature, duration, filepath 
            FROM tracks 
            WHERE analysis_status = 'analyzed' AND bpm > 0 
            ORDER BY bpm ASC
        `).all();

        const smartPlaylist = playlist.map((track, index) => {
            const nextTrack = playlist[index + 1];
            let transitionType = "Final";
            if (nextTrack) {
                const bpmDiff = Math.abs(nextTrack.bpm - track.bpm);
                if (bpmDiff < 5) transitionType = "Smooth 🟢";
                else if (bpmDiff < 15) transitionType = "Boost 🟡";
                else transitionType = "Hard Cut 🔴";
            }
            return { ...track, transition_prediction: transitionType };
        });
        res.json(smartPlaylist);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// 6. Servir covers (imágenes de portada)
app.get('/cover/:id', (req, res) => {
    const track = dbSpectra.prepare('SELECT coverpath FROM tracks WHERE id = ?').get(req.params.id);

    if (!track || !track.coverpath) {
        return res.status(404).send('Cover not found');
    }

    const coverPath = path.join(__dirname, track.coverpath);

    if (!fs.existsSync(coverPath)) {
        console.error(`❌ Cover no encontrada: ${coverPath}`);
        return res.status(404).send('Cover file missing');
    }

    // Determinar tipo MIME basado en extensión
    const ext = path.extname(coverPath).toLowerCase();
    const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp'
    };
    const contentType = mimeTypes[ext] || 'image/jpeg';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache 24 horas
    fs.createReadStream(coverPath).pipe(res);
});

// 7. Listar canciones cacheadas de Internet Archive
app.get('/tracks/cached', (req, res) => {
    try {
        const cachedTracks = dbSpectra.prepare(`
            SELECT id, title, artist, album, filepath, coverpath, duration, bpm, 
                   key_signature, analysis_status, original_ia_id
            FROM tracks
            WHERE filepath LIKE 'uploads/musica/%'
            ORDER BY id DESC
        `).all();

        res.json({
            success: true,
            count: cachedTracks.length,
            tracks: cachedTracks
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 8. Obtener información completa de un track
app.get('/track/:id', (req, res) => {
    try {
        const track = dbSpectra.prepare(`
            SELECT * FROM tracks WHERE id = ?
        `).get(req.params.id);

        if (!track) {
            return res.status(404).json({ error: 'Track not found' });
        }

        // Parsear waveform_data si existe
        if (track.waveform_data) {
            try {
                track.waveform_data = JSON.parse(track.waveform_data);
            } catch (e) {
                track.waveform_data = [];
            }
        }

        res.json(track);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- UTILIDADES PARA LAZY CACHING ---
/**
 * Sanitiza nombres de archivo removiendo caracteres peligrosos
 */
function sanitizeFilename(filename) {
    return filename
        .replace(/[<>:"\/\\|?*\x00-\x1F]/g, '') // Caracteres ilegales
        .replace(/\s+/g, ' ') // Múltiples espacios a uno solo
        .trim()
        .substring(0, 200); // Limitar longitud
}

/**
 * Descarga un archivo remoto usando streams (eficiente en RAM)
 * @param {string} url - URL del archivo remoto
 * @param {string} destinationPath - Ruta completa donde guardar
 * @returns {Promise<void>}
 */
async function downloadFile(url, destinationPath) {
    const writer = fs.createWriteStream(destinationPath);

    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream',
        timeout: 60000, // 60 segundos timeout
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

// 6. LAZY CACHING ENDPOINT (Internet Archive → Local Storage)
app.post('/ingest-remote', async (req, res) => {
    const { audioUrl, coverUrl, metadata } = req.body;

    // Validaciones básicas
    if (!audioUrl) {
        return res.status(400).json({ error: 'audioUrl is required' });
    }

    // Validar que audioUrl sea una URL remota válida, no una ruta local
    if (!audioUrl.startsWith('http://') && !audioUrl.startsWith('https://')) {
        console.warn(`⚠️  URL inválida o local detectada: ${audioUrl}`);
        return res.status(400).json({
            error: 'Invalid audioUrl - must be a remote HTTP/HTTPS URL',
            details: 'Local file paths are not supported. Only remote URLs from Internet Archive are allowed.',
            receivedUrl: audioUrl
        });
    }

    // Validar que sea de Internet Archive (opcional pero recomendado)
    if (!audioUrl.includes('archive.org')) {
        console.warn(`⚠️  URL no es de Internet Archive: ${audioUrl}`);
        // No bloqueamos, pero advertimos
    }

    try {
        // 1. Generar nombres de archivo sanitizados
        const artist = metadata?.artist || 'Unknown';
        const title = metadata?.title || 'Unknown Track';
        const ia_id = metadata?.ia_id || null;

        const audioFilename = sanitizeFilename(`${artist} - ${title}.mp3`);
        const coverFilename = sanitizeFilename(`${artist} - ${title}.jpg`);

        const audioPath = path.join(UPLOADS_MUSIC_DIR, audioFilename);
        const coverPath = coverUrl ? path.join(UPLOADS_COVERS_DIR, coverFilename) : null;

        // 2. Verificar si ya existe en Spectra DB (evitar duplicados)
        // Solo verificamos en Spectra - las canciones_externas son índices, no archivos
        let existingTrack = null;

        if (ia_id) {
            existingTrack = dbSpectra.prepare(
                'SELECT id FROM tracks WHERE original_ia_id = ?'
            ).get(ia_id);
        }

        if (!existingTrack) {
            existingTrack = dbSpectra.prepare(
                'SELECT id FROM tracks WHERE title = ? AND artist = ?'
            ).get(title, artist);
        }

        if (existingTrack) {
            console.log(`💾 Canción ya cacheada en Spectra (ID: ${existingTrack.id})`);
            return res.json({
                success: true,
                trackId: existingTrack.id,
                msg: 'Track already cached in Spectra',
                alreadyExists: true
            });
        }

        // 3. Descargar audio (con manejo de errores)
        console.log(`📥 Descargando audio desde: ${audioUrl}`);
        await downloadFile(audioUrl, audioPath);
        console.log(`✅ Audio guardado en: ${audioPath}`);

        // 4. Descargar cover (opcional)
        if (coverUrl) {
            try {
                console.log(`🖼️  Descargando cover desde: ${coverUrl}`);
                await downloadFile(coverUrl, coverPath);
                console.log(`✅ Cover guardado en: ${coverPath}`);
            } catch (coverError) {
                console.warn(`⚠️  No se pudo descargar cover: ${coverError.message}`);
                // No es crítico, continuamos sin cover
            }
        }

        // 5. Extraer metadata del archivo descargado
        const fileMeta = await mm.parseFile(audioPath);
        const trackInfo = {
            title: title,
            artist: artist,
            album: metadata?.album || fileMeta.common.album || 'Internet Archive',
            filepath: `uploads/musica/${audioFilename}`, // Path relativo
            coverpath: coverPath ? `uploads/covers/${coverFilename}` : null,
            duration: fileMeta.format.duration || metadata?.duration || 0,
            bitrate: fileMeta.format.bitrate || 128000,
            format: fileMeta.format.container || 'mp3',
            original_ia_id: ia_id
        };

        // 6. Insertar en la base de datos
        const insert = dbSpectra.prepare(`
            INSERT INTO tracks (title, artist, album, filepath, coverpath, duration, bitrate, format, original_ia_id)
            VALUES (@title, @artist, @album, @filepath, @coverpath, @duration, @bitrate, @format, @original_ia_id)
        `);
        const result = insert.run(trackInfo);

        console.log(`💾 Track #${result.lastInsertRowid} guardado en DB`);

        // 7. Disparar análisis de Python en segundo plano
        runPythonAnalysis(result.lastInsertRowid, audioPath);

        // 8. Responder al frontend inmediatamente
        res.json({
            success: true,
            trackId: result.lastInsertRowid,
            msg: 'Download complete, analysis started',
            localPath: trackInfo.filepath
        });

    } catch (error) {
        console.error('❌ Error en /ingest-remote:', error);
        res.status(500).json({
            error: error.message,
            details: 'Failed to download or process remote track'
        });
    }
});

// --- ANÁLISIS DE CANCIONES LOCALES ---

// 9. Migrar canciones de Tidol DB a Spectra DB y analizarlas
app.post('/migrate-local-songs', async (req, res) => {
    try {
        if (!dbTidol) {
            return res.status(500).json({
                error: 'Tidol DB no está conectada',
                message: 'No se puede acceder a las canciones locales'
            });
        }

        // Obtener todas las canciones de Tidol con JOIN a artistas
        const localSongs = dbTidol.prepare(`
            SELECT 
                c.id as tidol_id,
                c.titulo,
                c.archivo,
                c.duracion,
                c.portada,
                c.bit_rate,
                a.nombre as artista,
                al.titulo as album
            FROM canciones c
            LEFT JOIN artistas a ON c.artista_id = a.id
            LEFT JOIN albumes al ON c.album_id = al.id
        `).all();

        if (localSongs.length === 0) {
            return res.json({
                success: true,
                message: 'No hay canciones locales para migrar',
                count: 0
            });
        }

        console.log(`📦 Migrando ${localSongs.length} canciones de Tidol a Spectra...`);

        let migrated = 0;
        let skipped = 0;
        let toAnalyze = [];

        // Procesar cada canción
        for (const song of localSongs) {
            try {
                // Verificar si ya existe en Spectra
                const existing = dbSpectra.prepare(
                    'SELECT id FROM tracks WHERE title = ? AND artist = ?'
                ).get(song.titulo, song.artista || 'Unknown');

                if (existing) {
                    console.log(`⏭️  Saltando "${song.titulo}" - ya existe en Spectra`);
                    skipped++;
                    continue;
                }

                // Insertar en Spectra con todos los metadatos de Tidol
                const insert = dbSpectra.prepare(`
                    INSERT INTO tracks (
                        title, artist, album, filepath, duration, bitrate, 
                        coverpath, analysis_status, original_tidol_id
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
                `);

                const result = insert.run(
                    song.titulo,
                    song.artista || 'Unknown',
                    song.album || 'Local Music',
                    song.archivo,
                    song.duracion,
                    song.bit_rate,
                    song.portada || null,  // Guardar portada de Tidol
                    song.tidol_id
                );

                migrated++;
                toAnalyze.push({
                    id: result.lastInsertRowid,
                    filepath: song.archivo
                });

                console.log(`✅ Migrado: "${song.titulo}" (ID: ${result.lastInsertRowid})`);

            } catch (err) {
                console.error(`❌ Error migrando "${song.titulo}":`, err.message);
            }
        }

        // Disparar análisis para las canciones migradas
        console.log(`🔬 Iniciando análisis de ${toAnalyze.length} canciones...`);

        toAnalyze.forEach((track, index) => {
            // Canciones de Tidol están en backend/uploads/musica
            const filePath = path.join(__dirname, '../backend/uploads/musica', path.basename(track.filepath));

            // Delay progresivo
            setTimeout(() => {
                console.log(`🔄 Analizando ${index + 1}/${toAnalyze.length} - ID: ${track.id}`);
                if (fs.existsSync(filePath)) {
                    runPythonAnalysis(track.id, filePath);
                } else {
                    console.warn(`⚠️  Archivo no encontrado: ${filePath}`);
                    dbSpectra.prepare('UPDATE tracks SET analysis_status = ? WHERE id = ?')
                        .run('failed', track.id);
                }
            }, index * 2000);
        });

        res.json({
            success: true,
            message: `Migración completada`,
            migrated,
            skipped,
            total: localSongs.length,
            analyzing: toAnalyze.length,
            estimatedTimeMinutes: Math.ceil((toAnalyze.length * 10) / 60)
        });

    } catch (error) {
        console.error('❌ Error en /migrate-local-songs:', error);
        res.status(500).json({ error: error.message });
    }
});

// 10. Sincronizar canción local individual (desde frontend on-demand)
app.post('/sync-local-song', async (req, res) => {
    try {
        const { songId, title, artist, album, filepath, coverpath, duration, bitrate } = req.body;

        if (!songId || !title) {
            return res.status(400).json({ error: 'songId and title are required' });
        }

        // Verificar si ya existe en Spectra
        const existing = dbSpectra.prepare(
            'SELECT id FROM tracks WHERE original_tidol_id = ? OR (title = ? AND artist = ?)'
        ).get(songId, title, artist || 'Unknown');

        if (existing) {
            return res.json({
                success: true,
                trackId: existing.id,
                message: 'Song already in Spectra',
                alreadyExists: true
            });
        }

        // Insertar en Spectra
        const insert = dbSpectra.prepare(`
            INSERT INTO tracks (
                title, artist, album, filepath, duration, bitrate,
                coverpath, analysis_status, original_tidol_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
        `);

        const result = insert.run(
            title,
            artist || 'Unknown',
            album || 'Local Music',
            filepath,
            duration || 0,
            bitrate || 0,
            coverpath || null,
            songId
        );

        console.log(`✅ Sincronizada: "${title}" (ID: ${Number(result.lastInsertRowid)})`);

        // Disparar análisis
        // tidol-spectra and backend are sibling directories
        const fullPath = path.join(__dirname, '..', 'backend', 'uploads', 'musica', path.basename(filepath));

        if (fs.existsSync(fullPath)) {
            runPythonAnalysis(Number(result.lastInsertRowid), fullPath);
        } else {
            console.warn(`⚠️  Archivo no encontrado: ${fullPath}`);
            dbSpectra.prepare('UPDATE tracks SET analysis_status = ? WHERE id = ?')
                .run('failed', Number(result.lastInsertRowid));
        }

        res.json({
            success: true,
            trackId: Number(result.lastInsertRowid),
            message: 'Song synced and analysis started',
            alreadyExists: false
        });

    } catch (error) {
        console.error('❌ Error en /sync-local-song:', error);
        res.status(500).json({ error: error.message });
    }
});

// 10b. Ingest Remote Song (Internet Archive)
app.post('/ingest-remote', async (req, res) => {
    try {
        const { audioUrl, coverUrl, metadata } = req.body;

        if (!audioUrl || !metadata) {
            return res.status(400).json({ error: 'Missing audioUrl or metadata' });
        }

        const { title, artist, album, ia_id, duration } = metadata;

        // Check if already exists
        const existing = dbSpectra.prepare(
            'SELECT id FROM tracks WHERE original_ia_id = ?'
        ).get(ia_id);

        if (existing) {
            return res.json({
                success: true,
                trackId: existing.id,
                message: 'Song already in Spectra',
                alreadyExists: true
            });
        }

        // For IA songs, we store the URL directly as filepath
        // The actual download/caching happens lazily if needed
        const insert = dbSpectra.prepare(`
            INSERT INTO tracks (
                title, artist, album, filepath, duration, 
                coverpath, analysis_status, original_ia_id
            )
            VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
        `);

        const result = insert.run(
            title || 'Unknown Title',
            artist || 'Unknown Artist',
            album || 'Internet Archive',
            audioUrl, // Store URL as filepath for remote songs
            duration || 0,
            coverUrl || null,
            ia_id
        );

        console.log(`✅ IA Song ingested: "${title}" (ID: ${Number(result.lastInsertRowid)})`);

        res.json({
            success: true,
            trackId: Number(result.lastInsertRowid),
            message: 'Remote song ingested',
            alreadyExists: false
        });

    } catch (error) {
        console.error('❌ Error en /ingest-remote:', error);
        res.status(500).json({ error: error.message });
    }
});

// 11. Analizar todas las canciones pendientes (ANTIGUAS Y NUEVAS)
app.post('/analyze-all', async (req, res) => {
    try {
        // Buscar canciones sin analizar o que fallaron
        const pending = dbSpectra.prepare(`
            SELECT id, filepath 
            FROM tracks 
            WHERE analysis_status IS NULL 
               OR analysis_status = 'pending' 
               OR analysis_status = 'failed'
        `).all();

        if (pending.length === 0) {
            return res.json({
                success: true,
                message: 'No hay canciones pendientes de análisis',
                count: 0
            });
        }

        console.log(`📊 Iniciando análisis masivo de ${pending.length} canciones...`);

        // Actualizar status a 'pending' para todas
        const updateStmt = dbSpectra.prepare('UPDATE tracks SET analysis_status = ? WHERE id = ?');
        pending.forEach(track => {
            updateStmt.run('pending', track.id);
        });

        // Disparar análisis para cada una con delay para no saturar CPU
        pending.forEach((track, index) => {
            const filePath = track.filepath.startsWith('uploads/')
                ? path.join(__dirname, track.filepath)
                : path.join(MEDIA_DIR, track.filepath);

            // Delay progresivo: 2 segundos entre cada canción
            setTimeout(() => {
                console.log(`🔄 Analizando ${index + 1}/${pending.length} - ID: ${track.id}`);
                runPythonAnalysis(track.id, filePath);
            }, index * 2000);
        });

        res.json({
            success: true,
            message: `Análisis iniciado para ${pending.length} canciones`,
            count: pending.length,
            estimatedTimeMinutes: Math.ceil((pending.length * 10) / 60)
        });

    } catch (error) {
        console.error('❌ Error en /analyze-all:', error);
        res.status(500).json({ error: error.message });
    }
});

// 12. Re-analizar una canción específica
app.post('/analyze/:id', async (req, res) => {
    try {
        const trackId = req.params.id;
        const track = dbSpectra.prepare('SELECT id, filepath FROM tracks WHERE id = ?').get(trackId);

        if (!track) {
            return res.status(404).json({ error: 'Track not found' });
        }

        const filePath = track.filepath.startsWith('uploads/')
            ? path.join(__dirname, track.filepath)
            : path.join(MEDIA_DIR, track.filepath);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Audio file not found on disk' });
        }

        // Marcar como pending y analizar
        dbSpectra.prepare('UPDATE tracks SET analysis_status = ? WHERE id = ?').run('pending', trackId);
        runPythonAnalysis(trackId, filePath);

        res.json({
            success: true,
            message: 'Analysis started',
            trackId: trackId
        });

    } catch (error) {
        console.error(`❌ Error en /analyze/${req.params.id}:`, error);
        res.status(500).json({ error: error.message });
    }
});

// 13. Estado del análisis (estadísticas)
app.get('/analysis-status', (req, res) => {
    try {
        const total = dbSpectra.prepare('SELECT COUNT(*) as count FROM tracks').get().count;
        const analyzed = dbSpectra.prepare('SELECT COUNT(*) as count FROM tracks WHERE analysis_status = ?').get('analyzed').count;
        const pending = dbSpectra.prepare('SELECT COUNT(*) as count FROM tracks WHERE analysis_status IS NULL OR analysis_status = ?').get('pending').count;
        const failed = dbSpectra.prepare('SELECT COUNT(*) as count FROM tracks WHERE analysis_status = ?').get('failed').count;

        const percentage = total > 0 ? Math.round((analyzed / total) * 100) : 0;

        res.json({
            total,
            analyzed,
            pending,
            failed,
            percentage,
            needsAnalysis: pending + failed
        });

    } catch (error) {
        console.error('❌ Error en /analysis-status:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- VOX MODULE (Vocal Separation) ---

const UPLOADS_VOX_DIR = path.join(__dirname, 'uploads', 'vox');
if (!fs.existsSync(UPLOADS_VOX_DIR)) fs.mkdirSync(UPLOADS_VOX_DIR, { recursive: true });

// 14. Trigger Vocal Separation
app.post('/vox/separate', async (req, res) => {
    try {
        // Support both direct ID and lookup params
        const track = getTrackByLookup(req.body) || (req.body.trackId ? dbSpectra.prepare('SELECT * FROM tracks WHERE id = ?').get(req.body.trackId) : null);

        if (!track) return res.status(404).json({ error: 'Track not found' });
        const trackId = track.id; // Ensure we use the internal ID for the rest of the logic

        // Determine input path
        let inputPath;
        if (track.filepath.startsWith('uploads/')) {
            inputPath = path.join(__dirname, track.filepath);
        } else {
            inputPath = path.join(MEDIA_DIR, track.filepath);
        }

        if (!fs.existsSync(inputPath)) return res.status(404).json({ error: 'Audio file not found' });

        // Determine output path (Spleeter creates a folder with the filename)
        const filenameNoExt = path.basename(track.filepath, path.extname(track.filepath));
        const outputDir = UPLOADS_VOX_DIR; // Spleeter will create subdir 'filenameNoExt' here

        const expectedVocals = path.join(outputDir, filenameNoExt, 'vocals.wav');
        const expectedInstr = path.join(outputDir, filenameNoExt, 'accompaniment.wav');

        // Check if already separated
        if (fs.existsSync(expectedVocals) && fs.existsSync(expectedInstr)) {
            return res.json({
                status: 'success',
                message: 'Already separated',
                vocals: `/vox/stream/${trackId}/vocals`,
                accompaniment: `/vox/stream/${trackId}/accompaniment`
            });
        }

        // Wrap in Queue
        try {
            await voxQueue.add(() => new Promise((resolve, reject) => {
                console.log(`🎤 [Queue] Iniciando VOX (Demucs) para Track #${trackId}...`);

                // Use vox_demucs.py instead of vox.py
                const pythonProcess = spawn('python', ['vox_demucs.py', inputPath, outputDir]);
                let dataBuffer = '';

                pythonProcess.stdout.on('data', (data) => dataBuffer += data.toString());
                pythonProcess.stderr.on('data', (data) => console.error(`VOX Debug: ${data}`));

                pythonProcess.on('close', (code) => {
                    if (code !== 0) {
                        reject(new Error(`VOX failed with code ${code}`));
                        return;
                    }
                    try {
                        const result = JSON.parse(dataBuffer);
                        if (result.status === 'success') {
                            resolve(result);
                        } else {
                            reject(new Error(result.message));
                        }
                    } catch (e) {
                        reject(new Error('Invalid JSON from VOX script'));
                    }
                });
            }));

            res.json({
                status: 'success',
                vocals: `/vox/stream/${trackId}/vocals`,
                accompaniment: `/vox/stream/${trackId}/accompaniment`
            });

        } catch (err) {
            console.error("VOX Job Failed:", err);
            res.status(500).json({ error: err.message });
        }

    } catch (error) {
        console.error("VOX Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// 15. Stream Separated Tracks
app.get('/vox/stream/:id/:type', (req, res) => {
    const { id, type } = req.params; // type: 'vocals' | 'accompaniment'
    if (type !== 'vocals' && type !== 'accompaniment') return res.status(400).send('Invalid type');

    const track = dbSpectra.prepare('SELECT filepath FROM tracks WHERE id = ?').get(id);
    if (!track) return res.status(404).send('Track not found');

    const filenameNoExt = path.basename(track.filepath, path.extname(track.filepath));
    const filePath = path.join(UPLOADS_VOX_DIR, filenameNoExt, `${type}.wav`);

    if (!fs.existsSync(filePath)) return res.status(404).send('Stem not found (Run separation first)');

    const stat = fs.statSync(filePath);
    res.writeHead(200, {
        'Content-Type': 'audio/wav',
        'Content-Length': stat.size
    });
    fs.createReadStream(filePath).pipe(res);
});

// --- LYRICS MODULE ---

// 16. Generate Lyrics (Mock/Placeholder for now)
app.post('/generate-lyrics/:id', async (req, res) => {
    // In a real implementation, this would call Whisper or similar
    // For now, we return success to allow the frontend to proceed
    res.json({ success: true, message: 'Lyrics generation started (mock)' });
});

// 17. Get Lyrics (Mock/Search)
app.get('/lyrics/:id', async (req, res) => {
    const trackId = req.params.id;
    const track = dbSpectra.prepare('SELECT title, artist FROM tracks WHERE id = ?').get(trackId);

    if (!track) return res.status(404).send('Track not found');

    // Try to find a local .lrc file if it exists (optional feature)
    // For now, return a dummy synced lyric for testing
    const dummyLrc = `
[00:00.00]🎵 (Instrumental Intro)
[00:05.00]${track.title} - ${track.artist}
[00:10.00]Lyrics provided by Spectra AI
[00:15.00]...
[00:20.00]This is a placeholder for real-time lyrics.
[00:25.00]Implement Whisper or an API to get real lyrics.
`;
    res.send(dummyLrc.trim());
});

// --- PYTHON WORKER (Queued) ---
function runPythonAnalysis(trackId, filePath) {
    analysisQueue.add(() => new Promise((resolve, reject) => {
        console.log(`🐍 [Queue] Iniciando Python para Track #${trackId}...`);
        const pythonProcess = spawn('python', ['analyzer.py', filePath]);

        let dataBuffer = '';
        pythonProcess.stdout.on('data', (data) => dataBuffer += data.toString());
        pythonProcess.stderr.on('data', (data) => console.error(`Python Debug: ${data}`));

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                console.log(`Python falló con código ${code}`);
                dbSpectra.prepare('UPDATE tracks SET analysis_status = "failed" WHERE id = ?').run(trackId);
                resolve(); // Resolve anyway to free up queue
                return;
            }
            try {
                const result = JSON.parse(dataBuffer);
                if (result.status === 'success') {
                    console.log(`✅ Análisis: ${result.bpm} BPM | ${result.key}`);
                    const update = dbSpectra.prepare(`
                        UPDATE tracks SET bpm = ?, key_signature = ?, waveform_data = ?, analysis_status = 'analyzed'
                        WHERE id = ?
                    `);
                    update.run(result.bpm, result.key, JSON.stringify(result.waveform), trackId);
                } else {
                    console.log(`⚠️ Python Warning: ${result.error}`);
                    dbSpectra.prepare('UPDATE tracks SET analysis_status = "failed" WHERE id = ?').run(trackId);
                }
            } catch (parseErr) {
                console.error(`❌ JSON Parse Error:`, parseErr);
                dbSpectra.prepare('UPDATE tracks SET analysis_status = "failed" WHERE id = ?').run(trackId);
            }
            resolve();
        });
    }));
}

// --- LOOKUP ENDPOINTS (Resolve by Tidol ID or IA ID) ---

function getTrackByLookup(query) {
    if (!query || typeof query !== 'object') return null;

    const { id, tidol_id, ia_id } = query;
    if (id) return dbSpectra.prepare('SELECT * FROM tracks WHERE id = ?').get(id);
    if (tidol_id) return dbSpectra.prepare('SELECT * FROM tracks WHERE original_tidol_id = ?').get(tidol_id);
    if (ia_id) return dbSpectra.prepare('SELECT * FROM tracks WHERE original_ia_id = ?').get(ia_id);
    return null;
}

// 18. Analysis Lookup
app.get('/analysis', (req, res) => {
    const track = getTrackByLookup(req.query);
    if (!track) return res.status(404).json({ error: 'Track not found' });

    if (track.waveform_data) {
        try { track.waveform_data = JSON.parse(track.waveform_data); }
        catch (e) { track.waveform_data = []; }
    }
    res.json({
        id: track.id,
        bpm: track.bpm,
        key: track.key_signature,
        waveform_data: track.waveform_data,
        status: track.analysis_status
    });
});

// 19. Lyrics Lookup
app.get('/lyrics', (req, res) => {
    const track = getTrackByLookup(req.query);
    if (!track) return res.status(404).send('Track not found');

    const UPLOADS_LYRICS_DIR = path.join(__dirname, 'uploads', 'lyrics');
    const filenameNoExt = path.basename(track.filepath, path.extname(track.filepath));
    const lrcPath = path.join(UPLOADS_LYRICS_DIR, `${filenameNoExt}.lrc`);

    if (fs.existsSync(lrcPath)) {
        res.sendFile(lrcPath);
    } else {
        // Return 404 so frontend knows to trigger generation or keep waiting
        res.status(404).send('Lyrics not generated yet');
    }
});

// 19b. LOCAL SONGS - Lyrics Lookup (dedicated endpoint)
app.get('/local/lyrics/:tidol_id', (req, res) => {
    const { tidol_id } = req.params;
    const track = dbSpectra.prepare('SELECT * FROM tracks WHERE original_tidol_id = ?').get(tidol_id);

    if (!track) return res.status(404).send('Track not found in Spectra');

    const UPLOADS_LYRICS_DIR = path.join(__dirname, 'uploads', 'lyrics');
    const filenameNoExt = path.basename(track.filepath, path.extname(track.filepath));
    const lrcPath = path.join(UPLOADS_LYRICS_DIR, `${filenameNoExt}.lrc`);

    if (fs.existsSync(lrcPath)) {
        res.sendFile(lrcPath);
    } else {
        res.status(404).send('Lyrics not generated yet');
    }
});

// 20. Generate Lyrics Lookup (Queued with VOXW)
app.post('/generate-lyrics', async (req, res) => {
    const track = getTrackByLookup(req.query) || getTrackByLookup(req.body);
    if (!track) return res.status(404).json({ error: 'Track not found' });

    const UPLOADS_LYRICS_DIR = path.join(__dirname, 'uploads', 'lyrics');
    if (!fs.existsSync(UPLOADS_LYRICS_DIR)) fs.mkdirSync(UPLOADS_LYRICS_DIR, { recursive: true });

    const filenameNoExt = path.basename(track.filepath, path.extname(track.filepath));
    const lrcPath = path.join(UPLOADS_LYRICS_DIR, `${filenameNoExt}.lrc`);

    // If lyrics already exist, return success immediately
    if (fs.existsSync(lrcPath)) {
        return res.json({ success: true, message: 'Lyrics already available', trackId: track.id });
    }

    // Determine input audio path
    let inputPath;
    if (track.filepath.startsWith('uploads/')) {
        inputPath = path.join(__dirname, track.filepath);
    } else {
        inputPath = path.join(MEDIA_DIR, track.filepath);
    }

    // Add to Lyrics Queue
    try {
        // We don't await the queue here to avoid blocking the HTTP response
        // The frontend will poll /lyrics or we can implement websockets later
        // For now, we return "started" and the frontend will retry fetching lyrics

        lyricsQueue.add(() => new Promise((resolve, reject) => {
            console.log(`📜 [Queue] Iniciando VOXW (Whisper) para Track #${track.id}...`);

            const pythonProcess = spawn('python', ['voxw.py', inputPath, lrcPath]);
            let dataBuffer = '';
            let errorBuffer = '';
            let processTimeout;

            // Set 5-minute timeout to prevent hung processes
            processTimeout = setTimeout(() => {
                console.error(`⏱️ VOXW timeout for Track #${track.id}`);
                pythonProcess.kill('SIGTERM');
                reject(new Error('VOXW process timeout (5 minutes)'));
            }, 5 * 60 * 1000);

            pythonProcess.stdout.on('data', (data) => {
                const str = data.toString();
                dataBuffer += str;
                console.log(`VOXW Progress: ${str.trim()}`);
            });

            pythonProcess.stderr.on('data', (data) => {
                const str = data.toString();
                errorBuffer += str;
                // Only log non-warning errors
                if (!str.includes('UserWarning') && !str.includes('pkg_resources')) {
                    console.error(`VOXW Error: ${str.trim()}`);
                }
            });

            pythonProcess.on('close', (code) => {
                clearTimeout(processTimeout);

                if (code !== 0) {
                    console.error(`❌ VOXW failed with code ${code}`);
                    if (errorBuffer) {
                        console.error(`Error details: ${errorBuffer.substring(0, 500)}`);
                    }

                    // Provide more helpful error messages
                    let errorMsg = `VOXW failed with code ${code}`;
                    if (code === 3221226505 || code === -1073741819) {
                        errorMsg = 'Memory error: Audio file may be too long or system is low on RAM';
                    } else if (errorBuffer.includes('MemoryError')) {
                        errorMsg = 'Out of memory: Try a shorter audio file';
                    } else if (errorBuffer.includes('No lyrics detected')) {
                        errorMsg = 'No vocals detected in audio';
                    }

                    reject(new Error(errorMsg));
                    return;
                }
                try {
                    // Parse the last line which should be the JSON result
                    const lines = dataBuffer.trim().split('\n');
                    const lastLine = lines[lines.length - 1];
                    const result = JSON.parse(lastLine);

                    if (result.status === 'success') {
                        console.log(`✅ Lyrics generadas: ${track.title} (${result.segments || 0} segments)`);
                        resolve(result);
                    } else {
                        reject(new Error(result.message));
                    }
                } catch (e) {
                    // If JSON parse fails, check if file exists anyway
                    if (fs.existsSync(lrcPath)) {
                        console.log(`✅ Lyrics file created: ${track.title}`);
                        resolve({ status: 'success' });
                    } else {
                        reject(new Error('Invalid JSON from VOXW script'));
                    }
                }
            });
        })).catch(err => console.error("Lyrics Job Failed:", err));

        res.json({ success: true, message: 'Lyrics generation started (VOXW)', trackId: track.id });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 20b. LOCAL SONGS - Generate Lyrics (dedicated endpoint)
app.post('/local/generate-lyrics/:tidol_id', async (req, res) => {
    const { tidol_id } = req.params;
    const track = dbSpectra.prepare('SELECT * FROM tracks WHERE original_tidol_id = ?').get(tidol_id);

    if (!track) return res.status(404).json({ error: 'Track not found in Spectra. Please sync the song first.' });

    const UPLOADS_LYRICS_DIR = path.join(__dirname, 'uploads', 'lyrics');
    if (!fs.existsSync(UPLOADS_LYRICS_DIR)) fs.mkdirSync(UPLOADS_LYRICS_DIR, { recursive: true });

    const filenameNoExt = path.basename(track.filepath, path.extname(track.filepath));
    const lrcPath = path.join(UPLOADS_LYRICS_DIR, `${filenameNoExt}.lrc`);

    // If lyrics already exist, return success immediately
    if (fs.existsSync(lrcPath)) {
        return res.json({ success: true, message: 'Lyrics already available', trackId: track.id });
    }

    // Determine input audio path (local songs are in backend/uploads/)
    const inputPath = path.join(__dirname, '..', 'backend', track.filepath);

    // Add to Lyrics Queue
    try {
        lyricsQueue.add(() => new Promise((resolve, reject) => {
            console.log(`📜 [Queue] Iniciando VOXW para canción local #${tidol_id} (Spectra Track #${track.id})...`);

            const pythonProcess = spawn('python', ['voxw.py', inputPath, lrcPath]);
            let dataBuffer = '';
            let errorBuffer = '';
            let processTimeout;

            processTimeout = setTimeout(() => {
                console.error(`⏱️ VOXW timeout for local song ${tidol_id}`);
                pythonProcess.kill('SIGTERM');
                reject(new Error('VOXW process timeout (5 minutes)'));
            }, 5 * 60 * 1000);

            pythonProcess.stdout.on('data', (data) => {
                const str = data.toString();
                dataBuffer += str;
                console.log(`VOXW Progress: ${str.trim()}`);
            });

            pythonProcess.stderr.on('data', (data) => {
                const str = data.toString();
                errorBuffer += str;
                if (!str.includes('UserWarning') && !str.includes('pkg_resources')) {
                    console.error(`VOXW Error: ${str.trim()}`);
                }
            });

            pythonProcess.on('close', (code) => {
                clearTimeout(processTimeout);

                if (code !== 0) {
                    console.error(`❌ VOXW failed with code ${code}`);
                    if (errorBuffer) {
                        console.error(`Error details: ${errorBuffer.substring(0, 500)}`);
                    }

                    let errorMsg = `VOXW failed with code ${code}`;
                    if (code === 3221226505 || code === -1073741819) {
                        errorMsg = 'Memory error: Audio file may be too long or system is low on RAM';
                    } else if (errorBuffer.includes('MemoryError')) {
                        errorMsg = 'Out of memory: Try a shorter audio file';
                    } else if (errorBuffer.includes('No lyrics detected')) {
                        errorMsg = 'No vocals detected in audio';
                    }

                    reject(new Error(errorMsg));
                    return;
                }
                try {
                    const lines = dataBuffer.trim().split('\n');
                    const lastLine = lines[lines.length - 1];
                    const result = JSON.parse(lastLine);

                    if (result.status === 'success') {
                        console.log(`✅ Lyrics generadas para canción local: ${track.title} (${result.segments || 0} segments)`);
                        resolve(result);
                    } else {
                        reject(new Error(result.message));
                    }
                } catch (e) {
                    if (fs.existsSync(lrcPath)) {
                        console.log(`✅ Lyrics file created: ${track.title}`);
                        resolve({ status: 'success' });
                    } else {
                        reject(new Error('Invalid JSON from VOXW script'));
                    }
                }
            });
        })).catch(err => console.error("Lyrics Job Failed (Local):", err));

        res.json({ success: true, message: 'Lyrics generation started (VOXW)', trackId: track.id, tidol_id });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- INICIAR SERVIDOR ---
app.listen(PORT, () => {
    console.log(`🎵 SPECTRA ENGINE running on http://localhost:${PORT}`);
});