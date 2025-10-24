import express from "express";
import multer from "multer";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import mm from "music-metadata";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import db from "./models/db.js"; // tu conexión SQLite
import { clear, log } from "console";
import chalk from "chalk";
import gradient from "gradient-string";
import chalkAnimation from "chalk-animation";

import axios from "axios";
import * as cheerio from "cheerio";
dotenv.config();

// ----------------------
// Banner ASCII animado con gradiente neón
// ----------------------
async function showAnimatedBanner() {
  console.clear();

  const banner = `
 ███████████ █████ ██████████      ███████    █████       
 ░█░░░███░░░█░░███ ░░███░░░░███   ███░░░░░███ ░░███          
 ░   ░███  ░  ░███  ░███   ░░███ ███     ░░███ ░███       
     ░███     ░███  ░███    ░███░███      ░███ ░███       
     ░███     ░███  ░███    ░███░███      ░███ ░███         
     ░███     ░███  ░███    ███ ░░███     ███  ░███      █
     █████    █████ ██████████   ░░░███████░   ███████████
    ░░░░░    ░░░░░ ░░░░░░░░░░      ░░░░░░░    ░░░░░░░░░░░ 
   
    𝗥𝗼𝘂𝘁𝗲𝗹 𝗠𝘂𝘀𝗶𝗰 𝗔𝗣𝗜 - v1.0.0
   Release 12/2024 - Developed by Routel
`;

  // Animación tipo neón sobre el banner
  const neonAnim = chalkAnimation.pulse(banner);
  await new Promise(res => setTimeout(res, 2000));
  neonAnim.stop();
  console.clear();
  console.log(gradient.pastel.multiline(banner));
  // Animación ligera de inicio del servidor
  const startAnim = chalkAnimation.rainbow("💻 Iniciando servidor Routel Music API...");
  await new Promise(res => setTimeout(res, 2000));
  startAnim.stop();
console.clear();
console.log(gradient.pastel.multiline(banner));
  console.log(chalk.green("✅ Servidor iniciado correctamente.\n"));
}

// Llamar al banner ANTES de iniciar el servidor
await showAnimatedBanner();

// ----------------------
// Aquí continúa tu código de inicialización del servidor, DB, uploads, etc.
// ----------------------



const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;
if (!process.env.JWT_SECRET) {
  console.error("FATAL: set JWT_SECRET in .env antes de arrancar");
  process.exit(1);
}
const SECRET = process.env.JWT_SECRET;


// ----------------------
// Función de log
// ----------------------
function logStatus(name, success, info = "") {
  const icon = success ? "✅" : "❌";
  console.log(`${icon} ${name} ${info}`);
}

// ----------------------
// Middleware global
// ----------------------
app.use(express.json());
app.use(cors());


// ----------------------
// Validar token
// ----------------------
app.get("/validate", (req, res) => {
  const token = req.headers["x-token"];
  console.log("/validate token recibido:"); // 🔹 log para debug

  if (!token) return res.status(401).json({ message: "No autorizado" });

  try {
    const payload = jwt.verify(token, SECRET);
    console.log("👽 Payload verificado:"); // 🔹 log para debug
    res.json({ username: payload.username, role: payload.role });
  } catch (err) {
    console.error("Error verificando token:", err.message); // 🔹 log para debug
    res.status(401).json({ message: "Token inválido" });
  }
});
// ----------------------
// Rate limit login
// ----------------------
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Demasiados intentos, inténtalo más tarde." },
});

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
// Middleware auth
// ----------------------
export const authMiddleware = (req, res, next) => {
  const token = req.headers["x-token"];
  if (!token) return res.status(401).json({ message: "No autorizado" });

  try {
    const payload = jwt.verify(token, SECRET);
    req.user = payload;
    next();
  } catch (err) {
    console.error("Token inválido:", err.message);
    res.status(401).json({ message: "Token inválido" });
  }
};

// ----------------------
// Middleware por rol (versión mejorada)
// ----------------------
export const authRole = (allowedRoles) => {
  return (req, res, next) => {
    const token = req.headers["x-token"];
    if (!token)
      return res.status(401).json({ message: "401 No autorizado, falta token" });

    try {
      const payload = jwt.verify(token, SECRET);
      if (!payload || !payload.role)
        return res.status(401).json({ message: "Token inválido o corrupto" });

      // Si el rol no está permitido, bloquea
      if (!allowedRoles.includes(payload.role)) {
        console.log(`🚫 Acceso denegado: ${payload.username} (${payload.role})`);
        return res.status(403).json({ message: "Acceso denegado" });
      }

      // Si todo bien, pasa el user al request
      req.user = payload;
      next();
    } catch (err) {
      console.error("❌ Error verificando token:", err.message);
      res.status(401).json({ message: "Token inválido o expirado" });
    }
  };
};


// ----------------------
// Registro
// ----------------------
app.post("/register", async (req, res) => {
  const { username, password, role } = req.body; // role opcional
  try {
    if (!username || !password)
      return res.status(400).json({ message: "Datos inválidos" });

    const exists = await db.get("SELECT * FROM usuarios WHERE nombre = ?", [username]);
    if (exists) return res.status(400).json({ message: "El usuario ya existe" });

    const hashed = await bcrypt.hash(password, 12);
    await db.run(
      "INSERT INTO usuarios (nombre, password, role) VALUES (?, ?, ?)",
      [username, hashed, role || "user"]
    );
    logStatus("Registro de usuario", true, username);
    res.json({ message: "Usuario registrado" });
  } catch (err) {
    logStatus("Registro de usuario", false, err.message);
    res.status(500).json({ message: "Error en el servidor" });
  }
});

// ----------------------
// Login con roles
// ----------------------
app.post("/login", loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await db.get("SELECT * FROM usuarios WHERE nombre = ?", [username]);
    if (!user) return res.status(400).json({ message: "Usuario no encontrado" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: "Contraseña incorrecta" });

    // JWT con rol incluido
    const token = jwt.sign({ username: user.nombre, role: user.role }, SECRET, { expiresIn: "1h" });

    // Redirigir según rol
    let redirectPage = "/index.html"; // default
    if (["admin", "tester", "owner"].includes(user.role)) redirectPage = "/index_dev.html";

    logStatus("Login", true, `${username} (${user.role})`);
    res.json({ token, username: user.nombre, role: user.role, redirectPage });
  } catch (err) {
    logStatus("Login", false, err.message);
    res.status(500).json({ message: "Error en el servidor" });
  }
});




// ----------------------
// Servir frontend y uploads
// ----------------------
app.use(express.static(path.join(__dirname, "../frontend/public")));
app.use("/protected", express.static(path.join(__dirname, "../frontend/protected")));
app.use("/uploads", express.static(UPLOADS_DIR));

// Archivos restringidos según rol
app.get("/index_dev.html", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/protected/index_dev.html"));
});

// ----------------------
// Páginas protegidas por rol
// ----------------------
app.get("/user-page", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/public/index.html"));
});

app.get("/admin-page", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/protected/index_dev.html"));
});

logStatus("Middleware de autenticación", true, "Listo para proteger rutas");
// Ruta absoluta hacia la carpeta pública
const publicDir = path.join(__dirname, "../frontend/public");
const jsDir = path.join(publicDir, "js");

// Verifica existencia de carpeta y archivos
if (fs.existsSync(jsDir)) {
  console.log("\n📁 Archivos disponibles en /public/js: \n");
  fs.readdirSync(jsDir).forEach(file => {
    console.log("   -", file);
  });
} else {
  console.warn("⚠️  No se encontró la carpeta /frontend/public/js");
}

// Middleware temporal para depurar accesos a archivos estáticos
app.use((req, res, next) => {
  if (req.path.startsWith("/js/")) {
    console.log(`🛰️  Petición estática: ${req.path}`);
  }
  next();
});

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
  },
});
const upload = multer({ storage });

// ----------------------
// Subida canciones
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
// Listado canciones
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
app.get("/api/albums", authMiddleware, async (req, res) => {
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
// Detalle álbum
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

    logStatus("====Detalle álbum", true, `ID: ${id}`);
    res.json(album);
  } catch (err) {
    logStatus("====Detalle álbum", false, err.message);
    res.status(500).json({ error: "Error al obtener el álbum" });
  }
});

// ----------------------
// Canciones de álbum
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
    logStatus("Canciones de álbum 🤑 ", true, `ID: ${id}, Canciones: ${canciones.length}`);
    res.json(canciones);
  } catch (err) {
    logStatus("Canciones de álbum 🤑 ", false, err.message);
    res.status(500).json({ error: "Error al obtener canciones" });
  }
});

// ----------------------
// Listar artistas
// ----------------------
app.get("/api/artists", authMiddleware, async (req, res) => {
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
// Detalle artista
// ----------------------
app.get("/api/artists/:id", authMiddleware, async (req, res) => {
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

    logStatus("   Detalle artista  ", true, `ID: ${id}, Álbumes: ${albums.length}`);
    res.json({ ...artist, albums });
  } catch (err) {
    logStatus("   Detalle artista  ", false, err.message);
    res.status(500).json({ error: "Error al obtener el artista" });
  }
});

// ----------------------
// Buscador: álbum, artista o canción
// ----------------------
app.get("/api/search", authMiddleware, async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim() === "") return res.status(400).json({ error: "Consulta vacía" });

  const query = `%${q.trim()}%`;

  try {
    // Buscar canciones
  
  const canciones = await db.all(`
  SELECT c.id, c.titulo, c.archivo AS url, c.portada, c.duracion,
         a.nombre AS artista, al.titulo AS album, c.album_id AS albumId
  FROM canciones c
  LEFT JOIN artistas a ON c.artista_id = a.id
  LEFT JOIN albumes al ON c.album_id = al.id
  WHERE c.titulo LIKE ? OR a.nombre LIKE ? OR al.titulo LIKE ?
  ORDER BY c.titulo ASC
  LIMIT 50
`, [query, query, query]);
    // Buscar álbumes
    const albums = await db.all(`
      SELECT al.id, al.titulo, al.portada, ar.nombre AS autor
      FROM albumes al
      LEFT JOIN artistas ar ON al.artista_id = ar.id
      WHERE al.titulo LIKE ? OR ar.nombre LIKE ?
      ORDER BY al.titulo ASC
      LIMIT 20
    `, [query, query]);

    // Buscar artistas
    const artists = await db.all(`
      SELECT id, nombre, COALESCE(imagen, '/img/default-artist.png') AS imagen
      FROM artistas
      WHERE nombre LIKE ?
      ORDER BY nombre ASC
      LIMIT 20
    `, [query]);

    logStatus("Búsqueda", true, `Query: "${q}"`);
    res.json({ canciones, albums, artists });

  } catch (err) {
    logStatus("Búsqueda", false, err.message);
    res.status(500).json({ error: "Error en la búsqueda" });
  }
});
////////////////
// Información del usuario
/////////////////
app.get('/api/me', (req, res) => {
  const authHeader = req.headers["authorization"] || req.headers["x-token"];
  if (!authHeader) return res.status(401).json({ message: "No autorizado" });

  const token = authHeader.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : authHeader;

  try {
    const payload = jwt.verify(token, SECRET);

    db.get(
      "SELECT id, nombre, role, profile_img FROM usuarios WHERE nombre = ?",
      [payload.username],
      (err, user) => {
        if (err) return res.status(500).json({ message: "Error de base de datos" });
        if (!user) return res.status(404).json({ message: "Usuario no encontrado" });
        res.json(user);
      }
    );
  } catch (err) {
    res.status(401).json({ message: "Token inválido" });
  }
});


// ----------------------
// Subir foto de artista
// ----------------------
const ARTIST_IMAGES_DIR = path.join(UPLOADS_DIR, "artists");

// Crear directorio si no existe
if (!fs.existsSync(ARTIST_IMAGES_DIR)) fs.mkdirSync(ARTIST_IMAGES_DIR, { recursive: true });

// Configuración de multer para foto de artista
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

// Endpoint foto de artista
app.post("/api/artists/:id/imagen", authMiddleware, uploadArtist.single("image"), async (req, res) => {
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
});

const router = express.Router();

// ===================== BUSQUEDA EN INTERNET ARCHIVE =====================
router.get("/searchArchive", async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: "Falta el parámetro q" });

  try {
    const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(
      q + " AND mediatype:audio"
    )}&fl[]=identifier,title,creator&rows=15&page=1&output=json`;

    const { data } = await axios.get(url);
    const docs = data.response.docs || [];

    let results = [];

    for (const item of docs) {
      const { identifier, title, creator } = item;
      const artist = creator || "Artista desconocido";

      // Abrir la página del item para raspar archivos
      const pageUrl = `https://archive.org/download/${identifier}/`;
      const html = (await axios.get(pageUrl)).data;
      const $ = cheerio.load(html);

      $("a").each((_, el) => {
        const href = $(el).attr("href") || "";
        const ext = href.split(".").pop().toLowerCase();
        if (["flac", "wav", "alac", "mp3", "ogg"].includes(ext)) {
          results.push({
            title: title || href.replace(/\.[^/.]+$/, ""),
            artist,
            format: ext.toUpperCase(),
            url: `https://archive.org/download/${identifier}/${href}`,
            thumbnail: `https://archive.org/services/img/${identifier}`,
          });
        }
      });
    }

    return res.json(results);
  } catch (err) {
    console.error("Error en searchArchive:", err.message);
    return res.status(500).json({ error: "Error al buscar en Internet Archive" });
  }
});
//exportar los views
app.get('/app/:view', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'protected', 'base_dev.html'));
});
console.log("\n🚀 Rutas dinámicas para vistas protegidas listas.\n");

export default router;
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
    console.log(`\n Servidor corriendo en http://localhost:${PORT} o http://192.168.1.70:${PORT}\n`);
  });


})();
