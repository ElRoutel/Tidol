import multer from "multer";
import path from "path";
import fs from "fs";
import mm from "music-metadata";
import db from "../models/db.js";
import { fileURLToPath } from "url";
import readline from "readline";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOADS_DIR = path.join(__dirname, "..", "uploads");
const MUSIC_DIR = path.join(UPLOADS_DIR, "musica");
const COVER_DIR = path.join(UPLOADS_DIR, "covers");
const ARTIST_IMAGES_DIR = path.join(UPLOADS_DIR, "artists");
const LYRICS_DIR = path.join(UPLOADS_DIR, "lyrics");

[UPLOADS_DIR, MUSIC_DIR, COVER_DIR, ARTIST_IMAGES_DIR, LYRICS_DIR].forEach((d) => {
    try {
        if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    } catch (err) {
        console.error(`Error creating directory ${d}:`, err);
    }
});

function logStatus(name, success, info = "") {
    const icon = success ? "✅" : "❌";
    console.log(`${icon} ${name} ${info}`);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.fieldname === "song") cb(null, MUSIC_DIR);
        else if (file.fieldname === "coverFile") cb(null, COVER_DIR);
        else if (file.fieldname === "lyrics") cb(null, LYRICS_DIR);
        else cb(new Error("Campo inesperado"), null);
    },
    filename: (req, file, cb) => {
        const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + "-" + unique + path.extname(file.originalname));
    },
});

export const upload = multer({ storage });

export const uploadArtistImage = [
    multer({
        storage: multer.diskStorage({
            destination: (req, file, cb) => cb(null, ARTIST_IMAGES_DIR),
            filename: (req, file, cb) => {
                const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
                cb(null, `artist-${req.params.id}-${unique}${path.extname(file.originalname)}`);
            }
        })
    }).single('artistImage'),
    async (req, res) => {
        try {
            const artistId = req.params.id;
            if (!req.file) {
                return res.status(400).json({ error: "No se subió ninguna imagen." });
            }

            const imageUrl = `/uploads/artists/${req.file.filename}`;
            const artist = await db.get("SELECT * FROM artistas WHERE id = ?", [artistId]);

            if (!artist) {
                return res.status(404).json({ error: "Artista no encontrado." });
            }

            await db.run("UPDATE artistas SET imagen_url = ? WHERE id = ?", [imageUrl, artistId]);

            logStatus("Subida de imagen de artista", true, `Artista ID: ${artistId}`);
            res.json({ success: true, message: "Imagen de artista subida correctamente.", imageUrl });

        } catch (err) {
            logStatus("Subida de imagen de artista", false, err.message);
            res.status(500).json({ error: "Error interno al subir la imagen." });
        }
    }
];

// Función para importar LRC a DB
export async function importLyricsToDB(songId, filePath) {
    if (!fs.existsSync(filePath)) return;

    // Borrar letras previas si existen
    await db.run("DELETE FROM lyrics WHERE song_id = ?", [songId]);

    const rl = readline.createInterface({
        input: fs.createReadStream(filePath),
        crlfDelay: Infinity,
    });

    const insertStmt = await db.prepare("INSERT INTO lyrics(song_id, time_ms, line) VALUES (?, ?, ?)");

    for await (const line of rl) {
        const match = line.match(/\[(\d+):(\d+\.\d+)\](.*)/);
        if (!match) continue;
        const minutes = parseInt(match[1], 100);
        const seconds = parseFloat(match[2]);
        const text = match[3].trim();
        const timeMs = Math.round((minutes * 60 + seconds) * 1000);

        await insertStmt.run(songId, timeMs, text);
    }

    await insertStmt.finalize();
}

// Función para normalizar nombres de artistas (extraer artista principal)
function normalizarArtista(artistaCompleto) {
    if (!artistaCompleto) return "Desconocido";

    // Patrones comunes de colaboración
    const separadores = [
        ' & ',
        ' and ',
        ' feat. ',
        ' feat ',
        ' ft. ',
        ' ft ',
        ' featuring ',
    ];

    let artistaPrincipal = artistaCompleto.trim();

    // Buscar el primer separador y tomar solo lo que está antes
    for (const sep of separadores) {
        const index = artistaPrincipal.toLowerCase().indexOf(sep.toLowerCase());
        if (index !== -1) {
            artistaPrincipal = artistaPrincipal.substring(0, index).trim();
            break;
        }
    }

    return artistaPrincipal;
}

import { extractColors } from "../services/colorExtraction.service.js"; // Import service

// ... imports

// ... setup code ...

// Función principal de subida
export const uploadMusic = async (req, res) => {
    try {
        if (!req.files || !req.files.song || req.files.song.length === 0) {
            return res.status(400).json({ error: "No se subió ninguna canción" });
        }

        const albumName = req.body.albumName?.trim() || "Sin título";
        let uploadedCover = "/default_cover.jpg";
        let colorsJSON = null;

        if (req.files.coverFile?.[0]) {
            uploadedCover = `/uploads/covers/${req.files.coverFile[0].filename}`;
            // Extract colors from the physical file
            colorsJSON = await extractColors(req.files.coverFile[0].path);
        }

        const canciones = [];

        for (let i = 0; i < req.files.song.length; i++) {
            const file = req.files.song[i];
            const meta = await mm.parseFile(file.path).catch(() => null);
            const common = meta?.common || {};
            const format = meta?.format || {};
            const titulo = common.title || file.originalname.replace(/\.[^/.]+$/, "");
            const artistaNombreCompleto = common.artist?.trim() || "Desconocido";
            const artistaNombre = normalizarArtista(artistaNombreCompleto);

            let artista = await db.get("SELECT * FROM artistas WHERE nombre = ?", [artistaNombre]);
            if (!artista) {
                const result = await db.run("INSERT INTO artistas(nombre) VALUES (?)", [artistaNombre]);
                artista = await db.get("SELECT * FROM artistas WHERE id = ?", [result.lastID]);
            }

            let album = await db.get("SELECT * FROM albumes WHERE titulo = ? AND artista_id = ?", [albumName, artista.id]);
            if (!album) {
                // Insert New Album with Colors
                const result = await db.run(
                    "INSERT INTO albumes(titulo, artista_id, portada, extracted_colors) VALUES (?, ?, ?, ?)",
                    [albumName, artista.id, uploadedCover, colorsJSON]
                );
                album = await db.get("SELECT * FROM albumes WHERE id = ?", [result.lastID]);
            } else {
                // Optional: Update Album colors if they are missing and we have them now?
                // For now, let's keep it simple as per request.
            }

            // Insert Song with Colors
            // Note: If using same cover as album, use same colors.
            // If embedded cover (not implemented here fully), might be different. 
            // Current login uses album cover for song.
            const resultSong = await db.run(
                `INSERT INTO canciones(titulo, archivo, artista_id, album_id, duracion, portada, bit_rate, bit_depth, sample_rate, extracted_colors)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    titulo,
                    `/uploads/musica/${file.filename}`,
                    artista.id,
                    album.id,
                    Math.floor(format.duration || 0),
                    uploadedCover,
                    format.bitrate || 0,
                    format.bitsPerSample || 16,
                    format.sampleRate || 44100,
                    colorsJSON // Add extracted colors here
                ]
            );

            // Importar letras si existe archivo .lrc correspondiente
            if (req.files.lyrics && req.files.lyrics[i]) {
                const lyricsFile = req.files.lyrics[i];
                await importLyricsToDB(resultSong.lastID, lyricsFile.path);
                logStatus("Letras importadas", true, `Canción ID: ${resultSong.lastID}`);
            }

            canciones.push({
                id: resultSong.lastID,
                titulo,
                artista: artista.nombre,
                album: album.titulo,
                url: `/uploads/musica/${file.filename}`,
                portada: uploadedCover,
                duracion: Math.floor(format.duration || 0),
                bitDepth: format.bitsPerSample || 16,
                sampleRate: format.sampleRate || 44100,
                bitRate: format.bitrate || 0,
                extractedColors: JSON.parse(colorsJSON || 'null') // Return in response
            });
        }

        logStatus("Subida de canciones", true, `Álbum: ${albumName}, Canciones: ${canciones.length}`);
        res.json({ success: true, message: "Canción(es) y letras subidas correctamente", album: albumName, cover: uploadedCover, canciones });
    } catch (err) {
        logStatus("Subida de canciones", false, err.message);
        console.error(err);
        res.status(500).json({ error: "Error interno al subir canción" });
    }
};