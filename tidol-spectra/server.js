const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const mm = require('music-metadata');
const { spawn } = require('child_process'); // Vital para llamar a Python

const app = express();
const PORT = 3001;

// --- CONFIGURACIÓN ---
app.use(cors());
app.use(express.json());

const MEDIA_DIR = path.join(__dirname, 'media');
const DB_PATH_SPECTRA = path.join(__dirname, 'spectra.db');

// Asegurar que exista carpeta media
if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR);

// --- DB SPECTRA (Local) ---
// AQUÍ ESTABA EL ERROR: Ahora se llama dbSpectra uniformemente
const dbSpectra = new Database(DB_PATH_SPECTRA);

// Tabla actualizada con todos los campos necesarios
dbSpectra.exec(`
  CREATE TABLE IF NOT EXISTS tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    artist TEXT,
    album TEXT,
    filepath TEXT UNIQUE,
    duration REAL,
    bitrate INTEGER,
    format TEXT,
    bpm REAL DEFAULT 0,
    key_signature TEXT,
    waveform_data TEXT, 
    original_ia_id TEXT,
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
    dbTidol = new Database(DB_PATH_TIDOL, { readonly: true });
    console.log(`💾 TIDOL LEGACY DB: Conectada.`);
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

// 3. Streaming
app.get('/stream/:id', (req, res) => {
    const track = dbSpectra.prepare('SELECT * FROM tracks WHERE id = ?').get(req.params.id);
    if (!track) return res.status(404).send('Not found');
    
    const filePath = path.join(MEDIA_DIR, track.filepath);
    if (!fs.existsSync(filePath)) return res.status(404).send('File missing');

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
    if(track && track.waveform_data) {
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

// --- PYTHON WORKER ---
function runPythonAnalysis(trackId, filePath) {
    console.log(`🐍 Iniciando Python para Track #${trackId}...`);
    const pythonProcess = spawn('python', ['analyzer.py', filePath]);

    let dataBuffer = '';
    pythonProcess.stdout.on('data', (data) => dataBuffer += data.toString());
    pythonProcess.stderr.on('data', (data) => console.error(`Python Debug: ${data}`));

    pythonProcess.on('close', (code) => {
        if (code !== 0) {
            console.log(`Python falló con código ${code}`);
            dbSpectra.prepare('UPDATE tracks SET analysis_status = "failed" WHERE id = ?').run(trackId);
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
                console.error("Lógica Python falló:", result.message);
            }
        } catch (e) {
            console.error("Error procesando respuesta de Python:", e);
        }
    });
}

app.listen(PORT, () => {
    console.log(`🚀 SPECTRA SERVER en http://localhost:${PORT}`);
});