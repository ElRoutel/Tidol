const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const mm = require('music-metadata'); // Para leer metadatos del archivo
const axios = require('axios'); // Necesario para buscar en la web
const ffmpeg = require('fluent-ffmpeg'); // La navaja suiza del audio

const app = express();
const PORT = 3001; // Correrá en puerto distinto a React (3000)

// --- CONFIGURACIÓN ---
app.use(cors());
app.use(express.json());

// Directorios para guardar la música y la DB
const MEDIA_DIR = path.join(__dirname, 'media');
const DB_PATH = path.join(__dirname, 'spectra.db');

// Asegurar que existan las carpetas
if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR);

// --- BASE DE DATOS (SQLite) ---
const db = new Database(DB_PATH);

// Inicializar tablas si no existen
db.exec(`
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
    analysis_status TEXT DEFAULT 'pending' -- 'pending', 'analyzed', 'failed'
  );
`);

console.log('💿 SPECTRA Database initialized');

// ⚠️ AJUSTA ESTA RUTA A DONDE TENGAS TU DB ANTIGUA DE TIDOL
const DB_PATH_TIDOL = path.join(__dirname, '../Tidol/backend/models/database.sqlite'); 

// --- CONEXIONES ---
// Abrimos la DB de Tidol en modo lectura para no romper nada allá
const dbTidol = new Database(DB_PATH_TIDOL, { readonly: true }); 

console.log('💾 TIDOL LEGACY DB: Connected');

// --- RUTAS ---

// 1. Endpoint de "Ingesta" (Simulación de descarga/procesamiento inicial)
// Aquí recibirías la orden de descargar algo de Internet Archive o guardar un archivo local
app.post('/ingest', async (req, res) => {
    const { filename, sourceUrl } = req.body;
    // NOTA: Aquí iría la lógica de descarga real (axios stream).
    // Por ahora, asumimos que el archivo ya apareció en la carpeta media.
    
    const filePath = path.join(MEDIA_DIR, filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Archivo no encontrado en media/' });
    }

    try {
        // A. Extracción rápida de Metadatos (Node puro)
        const metadata = await mm.parseFile(filePath);
        
        const info = {
            title: metadata.common.title || filename,
            artist: metadata.common.artist || 'Unknown Artist',
            album: metadata.common.album || 'Unknown Album',
            duration: metadata.format.duration,
            bitrate: metadata.format.bitrate,
            format: metadata.format.container,
            filepath: filename
        };

        // B. Guardar en DB
        const insert = db.prepare(`
            INSERT INTO tracks (title, artist, album, filepath, duration, bitrate, format)
            VALUES (@title, @artist, @album, @filepath, @duration, @bitrate, @format)
        `);
        const result = insert.run(info);

        res.json({ success: true, trackId: result.lastInsertRowid, metadata: info });

        // C. Disparar análisis profundo en segundo plano (FFT / BPM / Waveform)
        analyzeAudioBackground(result.lastInsertRowid, filePath);

    } catch (error) {
        console.error("Error ingesting:", error);
        res.status(500).json({ error: error.message });
    }
});

// 2. Streaming de Audio (Lo que usa tu <audio> tag en React)
app.get('/stream/:id', (req, res) => {
    const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(req.params.id);
    
    if (!track) return res.status(404).send('Track not found');

    const filePath = path.join(MEDIA_DIR, track.filepath);
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    // Lógica para permitir "seek" (saltar a un minuto específico)
    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(filePath, { start, end });
        const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'audio/mpeg', // O audio/flac según corresponda
        };
        res.writeHead(206, head); // 206 Partial Content
        file.pipe(res);
    } else {
        const head = {
            'Content-Length': fileSize,
            'Content-Type': 'audio/mpeg',
        };
        res.writeHead(200, head);
        fs.createReadStream(filePath).pipe(res);
    }
});

// 3. API para obtener la biblioteca
app.get('/library', (req, res) => {
    const tracks = db.prepare('SELECT * FROM tracks ORDER BY id DESC').all();
    res.json(tracks);
});

// --- NUEVO MÓDULO: EL "BRIDGE" (PUENTE) ---

// Ruta para ver qué canciones necesitan "Refinamiento" urgente
app.get('/bridge/recommendations', (req, res) => {
    try {
        // 1. Consultamos la DB vieja para ver lo más escuchado
        // Asumo que tienes una tabla 'history' o 'songs' con contador de clicks.
        // Ajusta 'song_name' y 'play_count' a tus nombres reales de columnas.
        const topSongs = dbTidol.prepare(`
            SELECT song_name, artist_name, play_count, original_url 
            FROM user_stats 
            ORDER BY play_count DESC 
            LIMIT 20
        `).all();

        // 2. Filtramos las que YA tenemos en Spectra para no repetir trabajo
        const recommendations = topSongs.map(song => {
            const exists = db.prepare('SELECT id FROM tracks WHERE title = ?').get(song.song_name);
            return {
                ...song,
                status: exists ? 'upgraded' : 'needs_upgrade' // 'upgraded' significa que ya está local y limpia
            };
        });

        res.json(recommendations);
    } catch (error) {
        res.status(500).json({ error: 'Error leyendo Tidol DB: ' + error.message });
    }
});

// Ruta que ejecuta el "Scout" para una canción específica de la lista anterior
app.post('/bridge/upgrade-track', async (req, res) => {
    const { rawTitle, rawArtist } = req.body;
    
    console.log(`🕵️ Scout activado para: ${rawTitle}`);

    try {
        // PASO 1: SANITIZACIÓN (WEB SCRAPING SIMULADO)
        // Aquí conectaríamos con MusicBrainz o Discogs API para corregir el nombre
        const cleanMetadata = await sanitizeMetadata(rawTitle, rawArtist);
        
        // PASO 2: BÚSQUEDA INTELIGENTE EN INTERNET ARCHIVE
        // Buscamos la mejor versión basada en los datos limpios
        const archiveMatch = await searchInternetArchive(cleanMetadata.query);

        if (!archiveMatch) {
            return res.status(404).json({ message: 'No se encontró mejora en alta calidad' });
        }

        // Si encontramos algo mejor, devolvemos los datos para que el frontend (o el user) confirme la descarga
        res.json({
            original: { rawTitle, rawArtist },
            upgrade: {
                title: cleanMetadata.title,
                artist: cleanMetadata.artist,
                source: 'Internet Archive',
                file_url: archiveMatch.downloadUrl,
                format: archiveMatch.format, // ej: FLAC o VBR MP3
                size: archiveMatch.size
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// --- FUNCIONES AUXILIARES (MOCKUPS POR AHORA) ---

async function sanitizeMetadata(title, artist) {
    // AQUÍ IRÁ TU LÓGICA DE SCRAPING
    // Por ahora simulamos que limpiamos el texto
    // Ej: "linkin_park_numb_official" -> "Numb" - "Linkin Park"
    return {
        title: title.replace(/_/g, ' ').trim(), // Limpieza básica
        artist: artist ? artist.replace(/_/g, ' ').trim() : 'Unknown',
        query: `${artist} ${title} flac OR 320kbps` // Query optimizada para IA
    };
}

async function searchInternetArchive(query) {
    // Aquí usamos axios para llamar a la Search API de Internet Archive
    const searchUrl = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}&fl[]=identifier&fl[]=title&output=json`;
    
    // Esto es un ejemplo real de llamada
    const response = await axios.get(searchUrl);
    const docs = response.data.response.docs;

    if (docs.length > 0) {
        const id = docs[0].identifier;
        return {
            id: id,
            downloadUrl: `https://archive.org/download/${id}/${id}_vbr.mp3`, // Simplificado
            format: 'mp3',
            size: '5MB'
        };
    }
    return null;
}

// --- FUNCIÓN DE ANÁLISIS EN BACKGROUND ---
function analyzeAudioBackground(trackId, filePath) {
    console.log(`🧪 Iniciando análisis SPECTRA para ID: ${trackId}...`);
    
    // Aquí es donde integraríamos Python más adelante para la FFT compleja.
    // Por ahora, usamos FFmpeg para normalizar o detectar volumen.
    
    ffmpeg(filePath)
        .audioFilters('volumedetect')
        .format('null') // No generamos archivo, solo analizamos
        .on('end', (stdout, stderr) => {
            // FFmpeg escribe el análisis en stderr
            if(stderr.includes('max_volume')) {
                console.log(`✅ Análisis completado para ID ${trackId}`);
                // Aquí parsearíamos el log para sacar el volumen y actualizar la DB
                // db.prepare('UPDATE tracks SET analysis_status = "analyzed" WHERE id = ?').run(trackId);
            }
        })
        .on('error', (err) => console.error("Error analizando:", err))
        .save('NUL'); // Salida a la nada (en windows usar 'NUL')
}

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`
    =========================================
      🔊 SPECTRA AUDIO SERVER | PORT ${PORT}
    =========================================
      - Media Folder: ${MEDIA_DIR}
      - Database: Connected
      - Mode: Local Refinery
    `);
});
