import multer from "multer";
import path from "path";
import fs from "fs";
import mm from "music-metadata";
import db from "../models/db.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOADS_DIR = path.join(__dirname, "..", "uploads");
const MUSIC_DIR = path.join(UPLOADS_DIR, "musica");
const COVER_DIR = path.join(UPLOADS_DIR, "covers");
const ARTIST_IMAGES_DIR = path.join(UPLOADS_DIR, "artists");

[UPLOADS_DIR, MUSIC_DIR, COVER_DIR, ARTIST_IMAGES_DIR].forEach((d) => {
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
        else cb(new Error("Campo inesperado"), null);
    },
    filename: (req, file, cb) => {
        const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + "-" + unique + path.extname(file.originalname));
    },
});

export const upload = multer({ storage });

export const uploadMusic = async (req, res) => {
    try {
        if (!req.files || !req.files.song || req.files.song.length === 0) {
            return res.status(400).json({ error: "No se subió ninguna canción" });
        }

        const albumName = req.body.albumName?.trim() || "Sin título";
        const uploadedCover = req.files.coverFile?.[0]
            ? `/uploads/covers/${req.files.coverFile[0].filename}`
            : "/default_cover.jpg";

        const canciones = [];

        for (const file of req.files.song) {
            const meta = await mm.parseFile(file.path).catch(() => null);
            const common = meta?.common || {};
            const format = meta?.format || {};
            const titulo = common.title || file.originalname.replace(/\.[^/.]+$/, "");
            const artistaNombre = common.artist?.trim() || "Desconocido";

            let artista = await db.get("SELECT * FROM artistas WHERE nombre = ?", [artistaNombre]);
            if (!artista) {
                const result = await db.run("INSERT INTO artistas(nombre) VALUES (?)", [artistaNombre]);
                artista = await db.get("SELECT * FROM artistas WHERE id = ?", [result.lastID]);
            }

            let album = await db.get("SELECT * FROM albumes WHERE titulo = ? AND artista_id = ?", [albumName, artista.id]);
            if (!album) {
                const result = await db.run(
                    "INSERT INTO albumes(titulo, artista_id, portada) VALUES (?, ?, ?)",
                    [albumName, artista.id, uploadedCover]
                );
                album = await db.get("SELECT * FROM albumes WHERE id = ?", [result.lastID]);
            }

            const resultSong = await db.run(
                `INSERT INTO canciones(titulo, archivo, artista_id, album_id, duracion, portada, bit_rate, bit_depth, sample_rate)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    titulo,
                    `/uploads/musica/${file.filename}`,
                    artista.id,
                    album.id,
                    Math.floor(format.duration || 0),
                    uploadedCover,
                    format.bitrate || 0,
                    format.bitsPerSample || 16,
                    format.sampleRate || 44100
                ]
            );

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
                bitRate: format.bitrate || 0
            });
        }

        logStatus("Subida de canciones", true, `Álbum: ${albumName}, Canciones: ${canciones.length}`);
        res.json({ success: true, message: "Canción(es) subida(s) correctamente", album: albumName, cover: uploadedCover, canciones });
    } catch (err) {
        logStatus("Subida de canciones", false, err.message);
        res.status(500).json({ error: "Error interno al subir canción" });
    }
};

const uploadArtist = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, ARTIST_IMAGES_DIR),
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname);
            cb(null, `artist-${req.params.id}-${Date.now()}${ext}`);
        },
    }),
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith("image/")) return cb(new Error("Solo imágenes"));
        cb(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

export const uploadArtistImage = [uploadArtist.single("image"), async (req, res) => {
    const { id } = req.params;
    try {
        if (!req.file) return res.status(400).json({ error: "No se subió ninguna imagen" });

        const imagePath = `/uploads/artists/${req.file.filename}`;

        await db.run("UPDATE artistas SET imagen = ? WHERE id = ?", [imagePath, id]);

        logStatus("Foto de artista", true, `ID: ${id}, Archivo: ${req.file.filename}`);
        res.json({ message: "Imagen actualizada", path: imagePath });
    } catch (err) {
        logStatus("Foto de artista", false, err.message);
        res.status(500).json({ error: "Error subiendo la imagen" });
    }
}];
