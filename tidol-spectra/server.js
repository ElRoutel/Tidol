const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const mm = require('music-metadata');
const { spawn, execSync } = require('child_process');
const axios = require('axios');

const app = express();
const PORT = 3001;
const PYTHON_PORT = 8008; // Cambiado de 8000 a 8008 para evitar conflictos
const PYTHON_SERVER_URL = `http://127.0.0.1:${PYTHON_PORT}`;

// --- CONFIGURACIÓN DE LÍMITES ---
const MAX_DURATION_SECONDS = 30 * 60; // 30 minutos
const MAX_FILE_SIZE_MB = 250;         // 250MB

// --- SISTEMA DE LOGGING ESTRATÉGICO ---
const vLog = (module, msg, data = null) => {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = `[${timestamp}] [${module.toUpperCase()}]`;
    if (data) console.log(`${prefix} ${msg} ->`, data);
    else console.log(`${prefix} ${msg}`);
};

// --- MIDDLEWARES ---
app.use(cors({
    origin: true, // In production, replace with specific domain
    credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- DIRECTORIOS ---
const MEDIA_DIR = path.join(__dirname, 'media');
const UPLOADS_MUSIC_DIR = path.join(__dirname, '../backend/uploads/musica');
const UPLOADS_COVERS_DIR = path.join(__dirname, '../backend/uploads/covers');
const UPLOADS_STEMS_DIR = path.join(__dirname, 'uploads', 'stems');
const UPLOADS_LYRICS_DIR = path.join(__dirname, 'uploads', 'lyrics');
const DB_PATH_SPECTRA = path.join(__dirname, 'spectra.db');

[MEDIA_DIR, UPLOADS_MUSIC_DIR, UPLOADS_COVERS_DIR, UPLOADS_STEMS_DIR, UPLOADS_LYRICS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// --- BASE DE DATOS SPECTRA ---
const dbSpectra = new Database(DB_PATH_SPECTRA);
dbSpectra.pragma('journal_mode = WAL');
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

// --- CONEXIÓN BRIDGE (TIDOL DB) ---
let dbTidol = null;
const TIDOL_DB_PATH = path.resolve(__dirname, '../backend/models/database.sqlite');

try {
    if (fs.existsSync(TIDOL_DB_PATH)) {
        dbTidol = new Database(TIDOL_DB_PATH);
        dbTidol.pragma('journal_mode = WAL');
        vLog('Bridge', `Conectado a Tidol DB: ${path.basename(TIDOL_DB_PATH)}`);
    } else {
        vLog('Bridge', '⚠️ No se encontró database.sqlite en la ruta estándar.');
    }
} catch (err) {
    vLog('Bridge', `Error conectando a Tidol DB: ${err.message}`);
}

// --- SISTEMA DE COLAS ---
class JobQueue {
    constructor(concurrency = 1) {
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
        try { const res = await jobFn(); resolve(res); }
        catch (e) { reject(e); }
        finally { this.running--; this.process(); }
    }
}
const analysisQueue = new JobQueue(2);
const voxQueue = new JobQueue(1);
const lyricsQueue = new JobQueue(1);
const processingLyrics = new Set();

// --- UTILIDADES DE RUTA ---
function resolvePhysicalPath(filePath) {
    if (!filePath) return null;
    if (path.isAbsolute(filePath) && fs.existsSync(filePath)) return filePath;

    const basename = path.basename(filePath);
    const candidates = [
        path.join(__dirname, filePath),                                  // Relativo a spectra (ej: uploads/musica/...)
        path.join(__dirname, 'uploads', 'musica', basename),             // Local spectra music
        path.join(__dirname, 'media', basename),                         // Local spectra legacy (IA downloads)
        path.join(__dirname, '..', 'backend', 'uploads', 'musica', basename), // Solo como backup para archivos de Tidol original
    ];

    for (const cand of candidates) {
        if (fs.existsSync(cand)) return cand;
    }
    return null;
}

// --- SMART COVER ENGINE ---
async function ensureCover(trackId) {
    const track = dbSpectra.prepare('SELECT * FROM tracks WHERE id = ?').get(trackId);
    if (!track) return null;

    const musicPath = resolvePhysicalPath(track.filepath);
    if (!musicPath) return null;

    const musicDir = path.dirname(musicPath);
    const basename = path.basename(musicPath, path.extname(musicPath));

    // 1. Buscar en la carpeta local (cover.jpg, folder.jpg, etc)
    const localCandidates = ['cover.jpg', 'cover.png', 'folder.jpg', 'album.jpg', 'artwork.jpg', `${basename}.jpg`, `${basename}.png`];
    for (const cand of localCandidates) {
        const fullCand = path.join(musicDir, cand);
        if (fs.existsSync(fullCand)) {
            vLog('Cover', `Encontrada portada local para #${trackId}: ${cand}`);
            dbSpectra.prepare('UPDATE tracks SET coverpath = ? WHERE id = ?').run(fullCand, trackId);
            return fullCand;
        }
    }

    // 2. Extraer de metadatos (Embedded)
    try {
        const metadata = await mm.parseFile(musicPath);
        const picture = metadata.common.picture && metadata.common.picture[0];
        if (picture) {
            const ext = picture.format.split('/')[1] || 'jpg';
            const coverName = `cover_${trackId}_extracted.${ext}`;
            const coverPath = path.join(UPLOADS_COVERS_DIR, coverName);
            fs.writeFileSync(coverPath, picture.data);
            vLog('Cover', `Extraída portada embebida para #${trackId}`);
            dbSpectra.prepare('UPDATE tracks SET coverpath = ? WHERE id = ?').run(coverPath, trackId);
            return coverPath;
        }
    } catch (e) {
        vLog('Error', `Fallo al extraer metadatos para #${trackId}: ${e.message}`);
    }

    // 3. Buscar en Deezer (Fallback Externo)
    try {
        const cleanTitle = (track.title || '').replace(/\(.*\)|\[.*\]/g, '').trim();
        const cleanArtist = (track.artist || '').replace('Unknown', '').trim();
        if (cleanTitle && cleanArtist) {
            const query = encodeURIComponent(`${cleanArtist} ${cleanTitle}`);
            const res = await axios.get(`https://api.deezer.com/search?q=${query}&limit=1`);
            if (res.data && res.data.data && res.data.data[0]) {
                const albumCover = res.data.data[0].album.cover_xl || res.data.data[0].album.cover_big;
                if (albumCover) {
                    const coverName = `deezer_${trackId}.jpg`;
                    const coverPath = path.join(UPLOADS_COVERS_DIR, coverName);
                    await downloadFile(albumCover, coverPath);
                    vLog('Cover', `Descargada portada de Deezer para #${trackId}`);
                    dbSpectra.prepare('UPDATE tracks SET coverpath = ? WHERE id = ?').run(coverPath, trackId);
                    return coverPath;
                }
            }
        }
    } catch (e) {
        vLog('Error', `Fallo en búsqueda Deezer para #${trackId}: ${e.message}`);
    }

    return null;
}

function generatePlaceholderSVG(title, artist) {
    const initials = ((title?.[0] || 'T') + (artist?.[0] || 'A')).toUpperCase();
    const palettes = [
        ['#FF3CAC', '#784BA0', '#2B86C5'], ['#00DBDE', '#FC00FF'],
        ['#85FFBD', '#FFFB7D'], ['#8BC6EC', '#9599E2'], ['#FA8BFF', '#2BD2FF', '#2BFF88']
    ];
    const palette = palettes[Math.abs(initials.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % palettes.length];

    return `<svg width="500" height="500" viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                ${palette.map((c, i) => `<stop offset="${(i / (palette.length - 1)) * 100}%" style="stop-color:${c};stop-opacity:1" />`).join('')}
            </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad)" />
        <text x="50%" y="55%" font-family="system-ui, sans-serif" font-size="140" fill="white" text-anchor="middle" font-weight="900" style="filter: drop-shadow(0 4px 10px rgba(0,0,0,0.3))">${initials}</text>
    </svg>`;
}

function sanitizeFilename(name) {
    return name.replace(/[<>:"\/\\|?*\x00-\x1F]/g, '').trim().substring(0, 200);
}

async function downloadFile(url, dest) {
    const writer = fs.createWriteStream(dest);
    const response = await axios({ url, method: 'GET', responseType: 'stream', timeout: 90000 });
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

function getTrackByLookup(query) {
    if (!query) return null;
    const { id, tidol_id, ia_id } = query;
    if (id) return dbSpectra.prepare('SELECT * FROM tracks WHERE id = ?').get(id);
    if (tidol_id) return dbSpectra.prepare('SELECT * FROM tracks WHERE original_tidol_id = ?').get(tidol_id);
    if (ia_id) return dbSpectra.prepare('SELECT * FROM tracks WHERE original_ia_id = ?').get(ia_id);
    return null;
}

// --- PYTHON WORKER ---
function runPythonAnalysis(trackId, filePath) {
    analysisQueue.add(() => new Promise((resolve) => {
        const physicalPath = resolvePhysicalPath(filePath);
        if (!physicalPath) {
            vLog('Error', `No se encontró archivo para análisis #${trackId}: ${filePath}`);
            dbSpectra.prepare('UPDATE tracks SET analysis_status="failed" WHERE id=?').run(trackId);
            return resolve();
        }

        vLog('Python', `Iniciando análisis Track #${trackId}`);
        const py = spawn('python', ['analyzer.py', physicalPath]);
        let stdout = '';
        py.stdout.on('data', d => stdout += d.toString());
        py.on('close', code => {
            if (code === 0) {
                try {
                    const res = JSON.parse(stdout.trim());
                    if (res.status === 'success') {
                        dbSpectra.prepare('UPDATE tracks SET bpm=?, key_signature=?, waveform_data=?, analysis_status="analyzed" WHERE id=?')
                            .run(res.bpm, res.key, JSON.stringify(res.waveform), trackId);
                        vLog('Success', `Track #${trackId} analizado: ${res.bpm} BPM, ${res.key}`);
                    }
                } catch (e) { vLog('Error', `Error de parseo JSON Track #${trackId}`); }
            } else {
                vLog('Error', `Python salió con código ${code} para Track #${trackId}`);
                dbSpectra.prepare('UPDATE tracks SET analysis_status="failed" WHERE id=?').run(trackId);
            }
            resolve();
        });
    }));
}

// --- ENDPOINTS ---

// 1. INGEST REMOTE (Internet Archive)
app.post('/ingest-remote', async (req, res) => {
    const { audioUrl, coverUrl, metadata } = req.body;
    if (!audioUrl) return res.status(400).json({ error: 'audioUrl is required' });

    try {
        const title = metadata?.title || 'Unknown';
        const artist = metadata?.artist || 'Unknown';
        const ia_id = metadata?.ia_id;

        const existing = dbSpectra.prepare('SELECT id FROM tracks WHERE original_ia_id = ?').get(ia_id);
        if (existing) return res.json({ success: true, trackId: existing.id, msg: 'Already cached', alreadyExists: true });

        const audioFilename = sanitizeFilename(`${artist} - ${title}.mp3`);
        const audioPath = path.join(UPLOADS_MUSIC_DIR, audioFilename);

        vLog('Ingest', `Descargando: ${title} - ${artist}`);
        await downloadFile(audioUrl, audioPath);

        const fileMeta = await mm.parseFile(audioPath);
        const duration = fileMeta.format.duration || 0;

        const result = dbSpectra.prepare(`
            INSERT INTO tracks (title, artist, album, filepath, duration, bitrate, format, original_ia_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(title, artist, metadata?.album || 'Internet Archive', `uploads/musica/${audioFilename}`, duration, fileMeta.format.bitrate, 'mp3', ia_id);

        // Registro silencioso en Tidol
        axios.post('http://localhost:3000/api/music/register-external', {
            title, artist, filename: audioFilename, duration, ia_id
        }).catch(() => { });

        runPythonAnalysis(result.lastInsertRowid, audioPath);
        res.json({ success: true, trackId: result.lastInsertRowid });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 2. SYNC LOCAL SONG (Tidol)
app.post('/sync-local-song', async (req, res) => {
    const { songId, title, artist, filepath, duration } = req.body;
    try {
        const existing = dbSpectra.prepare('SELECT id FROM tracks WHERE original_tidol_id = ?').get(songId);
        if (existing) return res.json({ success: true, trackId: existing.id, alreadyExists: true });

        const result = dbSpectra.prepare(`
            INSERT INTO tracks (title, artist, filepath, duration, original_tidol_id)
            VALUES (?, ?, ?, ?, ?)
        `).run(title, artist || 'Unknown', filepath, duration || 0, songId);

        const physicalPath = resolvePhysicalPath(filepath);
        if (physicalPath) runPythonAnalysis(result.lastInsertRowid, physicalPath);

        res.json({ success: true, trackId: result.lastInsertRowid });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 3. ANALYSIS (Lookup metadata)
app.get('/analysis', (req, res) => {
    vLog('Analysis', `Buscando: ${JSON.stringify(req.query)}`);
    const track = getTrackByLookup(req.query);
    if (!track) return res.status(404).json({ error: 'Track not found' });

    const filenameNoExt = path.basename(track.filepath, path.extname(track.filepath));
    const stemsDir = path.join(UPLOADS_STEMS_DIR, filenameNoExt);
    const hasStems = fs.existsSync(path.join(stemsDir, 'vocals.wav'));

    res.json({
        id: track.id,
        bpm: track.bpm,
        key: track.key_signature,
        waveform_data: track.waveform_data ? JSON.parse(track.waveform_data) : [],
        status: track.analysis_status,
        stems: hasStems ? {
            vocals: `/vox/stream/${track.id}/vocals.wav`,
            accompaniment: `/vox/stream/${track.id}/accompaniment.wav`
        } : null
    });
});

// 4. LYRICS ENDPOINTS (Unified)
app.post(['/generate-lyrics', '/local/generate-lyrics/:tidol_id'], async (req, res) => {
    const tidol_id = req.params.tidol_id;
    const lookupQuery = tidol_id ? { tidol_id } : (req.query.tidol_id ? { tidol_id: req.query.tidol_id } : req.query);
    const track = getTrackByLookup(lookupQuery) || getTrackByLookup(req.body);

    if (!track) return res.status(404).json({ error: 'Track not found' });
    if (processingLyrics.has(track.id)) return res.json({ success: true, msg: 'Lyrics generation already in progress', status: 'processing' });

    const filenameNoExt = path.basename(track.filepath, path.extname(track.filepath));
    const lrcPath = path.join(UPLOADS_LYRICS_DIR, `${filenameNoExt}.lrc`);

    // Si ya existe, avisar
    if (fs.existsSync(lrcPath)) {
        return res.json({
            success: true,
            status: 'ready',
            msg: 'Lyrics already exist',
            stems: fs.existsSync(path.join(UPLOADS_STEMS_DIR, filenameNoExt, 'vocals.wav')) ? {
                vocals: `/vox/stream/${track.id}/vocals.wav`,
                accompaniment: `/vox/stream/${track.id}/accompaniment.wav`
            } : null
        });
    }

    const inputPath = resolvePhysicalPath(track.filepath);
    if (!inputPath) return res.status(404).json({ error: 'Audio file not found' });

    processingLyrics.add(track.id);
    lyricsQueue.add(async () => {
        try {
            vLog('Lyrics', `Soliictando transcripción para: ${track.title}`);
            await axios.post(`${PYTHON_SERVER_URL}/process_track`, {
                input_path: inputPath,
                output_dir_stems: UPLOADS_STEMS_DIR,
                output_path_lrc: lrcPath,
                skip_transcription: false
            }, { timeout: 600000 });
            vLog('Lyrics', `✅ Letras generadas para: ${track.title}`);
        } catch (e) { vLog('Error', `Fallo en letras (${track.title}): ${e.message}`); }
        finally { processingLyrics.delete(track.id); }
    });

    res.json({ success: true, msg: 'Lyrics generation started', status: 'processing' });
});

// 5. LYRICS (Fetch existing)
app.get(['/lyrics', '/local/lyrics/:tidol_id'], (req, res) => {
    const tidol_id = req.params.tidol_id;
    const query = tidol_id ? { tidol_id } : req.query;
    vLog('Lyrics', `Lookup letra: ${JSON.stringify(query)}`);
    const track = getTrackByLookup(query);
    if (!track) return res.status(404).json({ error: 'Track not found' });

    const filenameNoExt = path.basename(track.filepath, path.extname(track.filepath));
    const lrcPath = path.join(UPLOADS_LYRICS_DIR, `${filenameNoExt}.lrc`);

    if (fs.existsSync(lrcPath)) {
        const content = fs.readFileSync(lrcPath, 'utf8');
        vLog('Lyrics', `✅ Enviando: ${filenameNoExt}.lrc`);
        res.json({ status: 'ready', lyrics: content });
    } else {
        vLog('Lyrics', `❌ No encontrada: ${lrcPath}`);
        if (processingLyrics.has(track.id)) {
            return res.status(202).json({ status: 'processing', msg: 'Lyrics are currently being generated.' });
        }
        res.status(404).json({ status: 'not_found', msg: 'Lyrics not ready or not found.' });
    }
});

// 6. VOCAL SEPARATION (Karaoke/Vox)
app.post(['/vox/separate', '/local/vox/separate/:tidol_id'], async (req, res) => {
    const tidol_id = req.params.tidol_id;
    const query = tidol_id ? { tidol_id } : req.body;
    const track = getTrackByLookup(query);
    if (!track) return res.status(404).json({ error: 'Track not found' });

    const inputPath = resolvePhysicalPath(track.filepath);
    if (!inputPath) return res.status(404).json({ error: 'Audio file not found' });

    const filenameNoExt = path.basename(track.filepath, path.extname(track.filepath));
    const stemsDir = path.join(UPLOADS_STEMS_DIR, filenameNoExt);
    const hasStems = fs.existsSync(path.join(stemsDir, 'vocals.wav')) && fs.existsSync(path.join(stemsDir, 'accompaniment.wav'));

    if (hasStems) {
        return res.json({
            status: 'success',
            trackId: track.id,
            vocals: `/vox/stream/${track.id}/vocals.wav`,
            accompaniment: `/vox/stream/${track.id}/accompaniment.wav`
        });
    }

    voxQueue.add(async () => {
        try {
            vLog('Vox', `Separando voces: ${track.title}`);
            await axios.post(`${PYTHON_SERVER_URL}/process_track`, {
                input_path: inputPath,
                output_dir_stems: UPLOADS_STEMS_DIR,
                skip_transcription: true
            }, { timeout: 600000 });
            vLog('Vox', `✅ Voces separadas: ${track.title}`);
        } catch (e) { vLog('Error', `Fallo en Vox (${track.title}): ${e.message}`); }
    });

    res.json({ status: 'processing', trackId: track.id });
});

app.get('/vox/stream/:id/:type', (req, res) => {
    let { id, type } = req.params;
    type = type.replace('.wav', ''); // Quitar extensión si viene

    const track = dbSpectra.prepare('SELECT filepath FROM tracks WHERE id = ?').get(id);
    if (!track) return res.status(404).send('Not found');

    const filenameNoExt = path.basename(track.filepath, path.extname(track.filepath));
    const filePath = path.join(UPLOADS_STEMS_DIR, filenameNoExt, `${type}.wav`);
    if (!fs.existsSync(filePath)) return res.status(404).send('Stem not ready');
    res.sendFile(filePath);
});

// --- ENDPOINTS RESTORADOS ---

const getMymeType = (p) => {
    const ext = path.extname(p).toLowerCase();
    return { '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.flac': 'audio/flac', '.ogg': 'audio/ogg' }[ext] || 'audio/mpeg';
};

// 6. STREAMING (Soporta media/ y uploads/musica/)
app.get('/stream/:id', (req, res) => {
    const track = dbSpectra.prepare('SELECT filepath FROM tracks WHERE id = ?').get(req.params.id);
    if (!track) return res.status(404).send('Not found');

    const filePath = resolvePhysicalPath(track.filepath);
    if (!filePath) {
        vLog('Error', `Archivo no encontrado para stream #${req.params.id}: ${track.filepath}`);
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
            'Content-Type': getMymeType(filePath),
        };
        res.writeHead(206, head);
        file.pipe(res);
    } else {
        res.writeHead(200, { 'Content-Length': stat.size, 'Content-Type': getMymeType(filePath) });
        fs.createReadStream(filePath).pipe(res);
    }
});

// 7. COVERS (Con Smart Engine)
app.get('/cover/:id', async (req, res) => {
    const track = dbSpectra.prepare('SELECT title, artist, coverpath FROM tracks WHERE id = ?').get(req.params.id);
    if (!track) return res.status(404).send('Not found');

    let filePath = null;

    // A. Intentar ruta guardada
    if (track.coverpath) {
        const base = path.basename(track.coverpath);
        const candidates = [
            path.join(UPLOADS_COVERS_DIR, base),
            path.join(__dirname, track.coverpath),
            path.join(__dirname, '..', 'backend', track.coverpath),
            track.coverpath
        ];
        for (const c of candidates) { if (fs.existsSync(c)) { filePath = c; break; } }
    }

    // B. Si falla, ejecutar Smart Engine
    if (!filePath) {
        filePath = await ensureCover(req.params.id);
    }

    // C. Servir archivo o Placeholder
    if (filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const mime = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }[ext] || 'image/jpeg';
        res.setHeader('Content-Type', mime);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        fs.createReadStream(filePath).pipe(res);
    } else {
        // Fallback final: SVG Placeholder
        vLog('Cover', `Generando placeholder para #${req.params.id}`);
        res.setHeader('Content-Type', 'image/svg+xml');
        res.send(generatePlaceholderSVG(track.title, track.artist));
    }
});

// 8. DJ MODE (DJ Brain)
app.get('/recommendations/:id', (req, res) => {
    const requestedId = req.params.id;
    const track = dbSpectra.prepare(`
        SELECT id, title FROM tracks 
        WHERE id = ? OR original_tidol_id = ? OR original_ia_id = ?
    `).get(requestedId, requestedId, requestedId);

    if (!track) return res.status(404).json({ error: "Track not found in Spectra" });

    vLog('DJ', `Calculando recomendación para: ${track.title}`);
    const py = spawn('python', ['dj_brain.py', track.id]);
    let buffer = '';
    py.stdout.on('data', d => buffer += d.toString());
    py.on('close', code => {
        try {
            const lines = buffer.trim().split('\n');
            let result = null;
            for (let i = lines.length - 1; i >= 0; i--) {
                try {
                    const p = JSON.parse(lines[i]);
                    if (p.success || p.recommendation) { result = p; break; }
                } catch (e) { }
            }
            if (result && result.recommendation) res.json(result.recommendation);
            else if (result && result.success) res.json(result.recommendation); // Fallback
            else res.status(500).json({ error: "DJ Brain failed" });
        } catch (e) { res.status(500).json({ error: "Parse error DJ Brain" }); }
    });
});

// 9. SMART QUEUE (BPM Flow)
app.get('/smart-queue/bpm-flow', (req, res) => {
    try {
        const playlist = dbSpectra.prepare(`
            SELECT id, title, artist, bpm, key_signature, duration, filepath 
            FROM tracks 
            WHERE analysis_status = 'analyzed' AND bpm > 0 
            ORDER BY bpm ASC
        `).all();

        const smart = playlist.map((track, i) => {
            const next = playlist[i + 1];
            let transition = "Final";
            if (next) {
                const diff = Math.abs(next.bpm - track.bpm);
                if (diff < 5) transition = "Smooth 🟢";
                else if (diff < 15) transition = "Boost 🟡";
                else transition = "Hard Cut 🔴";
            }
            return { ...track, transition_prediction: transition };
        });
        res.json(smart);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 10. CACHED TRACKS
app.get('/tracks/cached', (req, res) => {
    try {
        const rows = dbSpectra.prepare('SELECT * FROM tracks ORDER BY id DESC').all();
        res.json({ success: true, count: rows.length, tracks: rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 11. TRACK INFO
app.get('/track/:id', (req, res) => {
    const track = dbSpectra.prepare('SELECT * FROM tracks WHERE id = ?').get(req.params.id);
    if (!track) return res.status(404).json({ error: 'Not found' });
    if (track.waveform_data) track.waveform_data = JSON.parse(track.waveform_data);
    res.json(track);
});

// 12. BRIDGE RECOMMENDATIONS (History)
app.get('/bridge/recommendations', (req, res) => {
    if (!dbTidol) return res.status(503).json({ error: 'Bridge deactivated' });
    try {
        const history = dbTidol.prepare(`
            SELECT ia_identifier, titulo, artista, url, played_at
            FROM ia_history ORDER BY played_at DESC LIMIT 50
        `).all();

        const results = history.map(item => {
            const local = dbSpectra.prepare('SELECT id FROM tracks WHERE title = ? OR original_ia_id = ?')
                .get(item.titulo, item.ia_identifier);
            return { ...item, status: local ? 'upgraded' : 'needs_upgrade', local_id: local ? local.id : null };
        });
        res.json(results);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- ENGINE MANAGEMENT ---
let pyProcess = null;
let isReady = false;

function startEngine() {
    vLog('Engine', '🚀 Iniciando Spectra Python Engine...');

    // ZOMBIE KILLER (Synchronous for safety)
    if (process.platform === 'win32') {
        try {
            const out = execSync(`netstat -ano | findstr :${PYTHON_PORT}`).toString();
            if (out) {
                const lines = out.trim().split('\n');
                lines.forEach(line => {
                    const parts = line.trim().split(/\s+/);
                    const pid = parts[parts.length - 1];
                    if (pid && pid !== '0' && !isNaN(pid)) {
                        vLog('Engine', `💀 Eliminando proceso fantasma PID: ${pid}`);
                        try { execSync(`taskkill /F /PID ${pid}`); } catch (e) { }
                    }
                });
            }
        } catch (e) { }
    }

    pyProcess = spawn('python', ['spectra_server.py'], { cwd: __dirname, stdio: 'inherit' });

    pyProcess.on('close', (code) => {
        vLog('Engine', `⚠️ Motor detenido (Código: ${code}). Reiniciando en 5s...`);
        isReady = false;
        setTimeout(startEngine, 5000);
    });

    checkHealth();
}

function checkHealth() {
    let attempts = 0;
    const interval = setInterval(async () => {
        try {
            const res = await axios.get(`${PYTHON_SERVER_URL}/health`, { timeout: 1000 });
            if (res.data.status === 'ready') {
                vLog('Engine', '✅ Spectra Engine CONECTADO y LISTO.');
                isReady = true;
                clearInterval(interval);
            }
        } catch (e) { }
        if (++attempts > 60) {
            vLog('Error', '❌ Timeout esperando al motor de Python.');
            clearInterval(interval);
        }
    }, 1000);
}

// Iniciar al arrancar
startEngine();

// Limpieza al cerrar
process.on('SIGINT', () => {
    if (pyProcess) pyProcess.kill();
    process.exit();
});

app.listen(PORT, () => {
    vLog('System', `🎵 SPECTRA SERVICE running on http://localhost:${PORT}`);
    vLog('System', `🔗 Engine port: ${PYTHON_PORT}`);
});