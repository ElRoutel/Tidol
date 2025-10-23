import express from "express";
import multer from "multer";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import mm from "music-metadata";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import db from "./models/db.js"; // tu conexión SQLite

// ----------------------
// Variables globales
// ----------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = 3000;
const SECRET = "tidol_secret_key"; // Cambiar en producción

// ----------------------
// Función de log
// ----------------------
function logStatus(name, success, info = "") {
  const icon = success ? "✅" : "❌";
  console.log(`${icon} ${name} ${info}`);
}

// ----------------------
// Middleware
// ----------------------
app.use(express.json());
app.use(cors());

// ----------------------
// Directorios
// ----------------------
const UPLOADS_DIR = path.join(__dirname, "uploads");
const MUSIC_DIR = path.join(UPLOADS_DIR, "musica");
const COVER_DIR = path.join(UPLOADS_DIR, "covers");

[UPLOADS_DIR, MUSIC_DIR, COVER_DIR].forEach((d) => {
  try {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    logStatus(`Directorio ${path.basename(d)}`, true, `(ubicación: ${d})`);
  } catch (err) {
    logStatus(`Directorio ${path.basename(d)}`, false, err.message);
  }
});

// ----------------------
// Middleware de autenticación
// ----------------------
export const authMiddleware = (req, res, next) => {
  const token = req.headers["x-token"];
  if (!token) return res.status(401).json({ message: "No autorizado" });
  try {
    const payload = jwt.verify(token, SECRET);
    req.user = payload;
    next();
  } catch (err) {
    res.status(401).json({ message: "Token inválido" });
  }
};

// ----------------------
// Registro y login
// ----------------------
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  try {
    const exists = await db.get("SELECT * FROM usuarios WHERE nombre = ?", [username]);
    if (exists) return res.status(400).json({ message: "El usuario ya existe" });

    const hashed = await bcrypt.hash(password, 10);
    await db.run("INSERT INTO usuarios (nombre, password) VALUES (?, ?)", [username, hashed]);
    logStatus("Registro de usuario", true, username);
    res.json({ message: "Usuario registrado" });
  } catch (err) {
    logStatus("Registro de usuario", false, err.message);
    res.status(500).json({ message: "Error en el servidor" });
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await db.get("SELECT * FROM usuarios WHERE nombre = ?", [username]);
    if (!user) return res.status(400).json({ message: "Usuario no encontrado" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: "Contraseña incorrecta" });

    const token = jwt.sign({ username: user.nombre }, SECRET, { expiresIn: "1h" });
    logStatus("Login", true, username);
    res.json({ token, username: user.nombre });
  } catch (err) {
    logStatus("Login", false, err.message);
    res.status(500).json({ message: "Error en el servidor" });
  }
});

// ----------------------
// Validar token
// ----------------------
app.get("/validate", (req, res) => {
  const token = req.headers["x-token"];
  if (!token) return res.status(401).json({ message: "No autorizado" });
  try {
    const payload = jwt.verify(token, SECRET);
    res.json({ username: payload.username });
  } catch (err) {
    res.status(401).json({ message: "Token inválido" });
  }
});

// ----------------------
// Servir frontend y uploads
// ----------------------
app.use(express.static(path.join(__dirname, "../frontend/public")));
app.use("/uploads", express.static(UPLOADS_DIR));

// ----------------------
// Multer: Subida de canciones y portadas
// ----------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "song") cb(null, MUSIC_DIR);
    else if (file.fieldname === "coverFile") cb(null, COVER_DIR);
    else cb(new Error("Campo inesperado"), null);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// ----------------------
// Subida de canciones con álbum
// ----------------------
app.post(
  "/uploads/musica",
  authMiddleware,
  upload.fields([
    { name: "song", maxCount: 30 },
    { name: "coverFile", maxCount: 1 }
  ]),
  async (req, res) => {
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
  }
);

// ----------------------
// Listar canciones
// ----------------------
app.get("/uploads/musica", async (req, res) => {
  try {
    const songs = await db.all(`
      SELECT c.id, c.titulo, c.archivo AS url, c.portada, c.duracion, c.bit_rate, c.bit_depth, c.sample_rate,
             a.nombre AS artista, al.titulo AS album
      FROM canciones c
      LEFT JOIN artistas a ON c.artista_id = a.id
      LEFT JOIN albumes al ON c.album_id = al.id
      ORDER BY c.fecha_subida DESC
    `);
    logStatus("Listado de canciones", true, `${songs.length} canciones`);
    res.json(songs);
  } catch (err) {
    logStatus("Listado de canciones", false, err.message);
    res.status(500).json({ error: "Error listando canciones" });
  }
});

// ----------------------
// Listar álbumes
// ----------------------
app.get("/api/albums", async (req, res) => {
  try {
    const albums = await db.all(`
      SELECT al.id, al.titulo, al.portada, ar.nombre AS autor, ROUND(AVG(c.bit_rate)) AS bitrate
      FROM albumes al
      LEFT JOIN artistas ar ON al.artista_id = ar.id
      LEFT JOIN canciones c ON c.album_id = al.id
      GROUP BY al.id
      ORDER BY al.titulo ASC
    `);
    logStatus("Listado de álbumes", true, `${albums.length} álbumes`);
    res.json(albums);
  } catch (err) {
    logStatus("Listado de álbumes", false, err.message);
    res.status(500).json({ error: "Error al obtener los álbumes" });
  }
});

// ----------------------
// Obtener álbum por ID
// ----------------------
app.get("/api/albums/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const album = await db.get(`
      SELECT al.*, ar.nombre AS autor
      FROM albumes al
      LEFT JOIN artistas ar ON al.artista_id = ar.id
      WHERE al.id = ?
    `, [id]);
    if (!album) return res.status(404).json({ error: "Álbum no encontrado" });

    logStatus("Detalle álbum", true, `ID: ${id}`);
    res.json(album);
  } catch (err) {
    logStatus("Detalle álbum", false, err.message);
    res.status(500).json({ error: "Error al obtener el álbum" });
  }
});

// ----------------------
// Obtener canciones de un álbum
// ----------------------
app.get("/api/albums/:id/canciones", authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const canciones = await db.all(`
      SELECT c.id, c.titulo, c.archivo AS url, c.duracion, c.bit_rate, c.bit_depth, c.sample_rate, c.portada, c.album_id,
             COALESCE(a.nombre, 'Desconocido') AS artista,
             COALESCE(al.titulo, 'Sin título') AS album
      FROM canciones c
      LEFT JOIN artistas a ON c.artista_id = a.id
      LEFT JOIN albumes al ON c.album_id = al.id
      WHERE c.album_id = ?
      ORDER BY c.titulo ASC
    `, [id]);
    logStatus("Canciones de álbum", true, `ID: ${id}, Canciones: ${canciones.length}`);
    res.json(canciones);
  } catch (err) {
    logStatus("Canciones de álbum", false, err.message);
    res.status(500).json({ error: "Error al obtener canciones" });
  }
});

// ----------------------
// Listar artistas
// ----------------------
app.get("/api/artists", async (req, res) => {
  try {
    const artists = await db.all(`
      SELECT ar.id, ar.nombre, COALESCE(ar.imagen, '/img/default-artist.png') AS imagen,
             COUNT(DISTINCT al.id) AS albums, COUNT(DISTINCT c.id) AS canciones
      FROM artistas ar
      LEFT JOIN albumes al ON al.artista_id = ar.id
      LEFT JOIN canciones c ON c.artista_id = ar.id
      GROUP BY ar.id
      ORDER BY ar.nombre ASC
    `);
    logStatus("Listado de artistas", true, `${artists.length} artistas`);
    res.json(artists);
  } catch (err) {
    logStatus("Listado de artistas", false, err.message);
    res.status(500).json({ error: "Error al obtener los artistas" });
  }
});

// ----------------------
// Obtener artista por ID con álbumes
// ----------------------
app.get("/api/artists/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const artist = await db.get(`
      SELECT ar.id, ar.nombre, COALESCE(ar.imagen, '/img/default-artist.png') AS imagen,
             COUNT(DISTINCT c.id) AS canciones
      FROM artistas ar
      LEFT JOIN canciones c ON c.artista_id = ar.id
      WHERE ar.id = ?
    `, [id]);
    if (!artist) return res.status(404).json({ error: "Artista no encontrado" });

    const albums = await db.all(`
      SELECT al.id, al.titulo, al.portada, COUNT(c.id) AS canciones
      FROM albumes al
      LEFT JOIN canciones c ON c.album_id = al.id
      WHERE al.artista_id = ?
      GROUP BY al.id
      ORDER BY al.titulo ASC
    `, [id]);

    logStatus("Detalle artista", true, `ID: ${id}, Álbumes: ${albums.length}`);
    res.json({ ...artist, albums });
  } catch (err) {
    logStatus("Detalle artista", false, err.message);
    res.status(500).json({ error: "Error al obtener el artista" });
  }
});

// ----------------------
// Inicializar servidor
// ----------------------
(async () => {
  try {
    await db.get("SELECT 1");
    logStatus("Conexión a DB", true);
  } catch (err) {
    logStatus("Conexión a DB", false, err.message);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🌐 Servidor Tidol corriendo en http://localhost:${PORT}\n`);
  });
})();
