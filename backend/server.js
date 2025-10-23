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
// Banner animado
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
  const neonAnim = chalkAnimation.pulse(banner);
  await new Promise(res => setTimeout(res, 2000));
  neonAnim.stop();
  console.clear();
  console.log(gradient.pastel.multiline(banner));
  const startAnim = chalkAnimation.rainbow("💻 Iniciando servidor Routel Music API...");
  await new Promise(res => setTimeout(res, 2000));
  startAnim.stop();
  console.clear();
  console.log(gradient.pastel.multiline(banner));
  console.log(chalk.green("✅ Servidor iniciado correctamente.\n"));
}
await showAnimatedBanner();

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
  if (!token) return res.status(401).json({ message: "No autorizado" });
  try {
    const payload = jwt.verify(token, SECRET);
    res.json({ username: payload.username, role: payload.role });
  } catch (err) {
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
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  logStatus(`Directorio ${path.basename(d)}`, true, `(ubicación: ${d})`);
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
    res.status(401).json({ message: "Token inválido" });
  }
};

// ----------------------
// Middleware por rol
// ----------------------
export const authRole = (allowedRoles) => (req, res, next) => {
  const token = req.headers["x-token"];
  if (!token) return res.status(401).json({ message: "No autorizado" });
  try {
    const payload = jwt.verify(token, SECRET);
    if (!allowedRoles.includes(payload.role)) return res.status(403).json({ message: "Acceso denegado" });
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ message: "Token inválido o expirado" });
  }
};

// ----------------------
// Registro
// ----------------------
app.post("/register", async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) return res.status(400).json({ message: "Datos inválidos" });
  const exists = await db.get("SELECT * FROM usuarios WHERE nombre = ?", [username]);
  if (exists) return res.status(400).json({ message: "El usuario ya existe" });
  const hashed = await bcrypt.hash(password, 12);
  await db.run("INSERT INTO usuarios (nombre, password, role) VALUES (?, ?, ?)", [username, hashed, role || "user"]);
  logStatus("Registro de usuario", true, username);
  res.json({ message: "Usuario registrado" });
});

// ----------------------
// Login con roles
// ----------------------
app.post("/login", loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  const user = await db.get("SELECT * FROM usuarios WHERE nombre = ?", [username]);
  if (!user) return res.status(400).json({ message: "Usuario no encontrado" });
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ message: "Contraseña incorrecta" });
  const token = jwt.sign({ username: user.nombre, role: user.role }, SECRET, { expiresIn: "1h" });
  let redirectPage = "/index.html";
  if (["admin", "tester", "owner"].includes(user.role)) redirectPage = "/index_dev.html";
  logStatus("Login", true, `${username} (${user.role})`);
  res.json({ token, username: user.nombre, role: user.role, redirectPage });
});

// ----------------------
// SPA: Shell y fragmentos
// ----------------------
const PROTECTED_DIR = path.join(__dirname, "../frontend/protected");
const FRAGMENTS_DIR = path.join(PROTECTED_DIR, "fragments");
const DEV_ROLES = ['admin', 'tester', 'owner'];

// Shell completo SPA dev
app.get("/dev", (req, res) => {
  res.sendFile(path.join(PROTECTED_DIR, "index_dev.html"));
});

// Helper para servir fragmentos
const sendFragment = (fragmentName) => (req, res) => {
  const fragmentPath = path.join(FRAGMENTS_DIR, `${fragmentName}.html`);
  if (!fs.existsSync(fragmentPath)) return res.status(404).send("Fragmento no encontrado");
  fs.readFile(fragmentPath, "utf-8", (err, data) => {
    if (err) return res.status(500).send("Error interno");
    res.send(data);
  });
};

// Rutas protegidas SPA
app.get("/inicio_dev", authRole(DEV_ROLES), sendFragment("inicio_dev"));
app.get("/subir_dev", authRole(DEV_ROLES), sendFragment("subir_dev"));
app.get("/buscar_dev", authRole(DEV_ROLES), sendFragment("buscar_dev"));
app.get("/albumes_dev", authRole(DEV_ROLES), sendFragment("albumes_dev"));
app.get("/artistas_dev", authRole(DEV_ROLES), sendFragment("artistas_dev"));

// ----------------------
// Servir frontend y uploads
// ----------------------
app.use(express.static(path.join(__dirname, "../frontend/public")));
app.use("/uploads", express.static(UPLOADS_DIR));

// ----------------------
// Multer y subida de música
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

app.post("/uploads/musica", authMiddleware, upload.fields([{ name: "song", maxCount: 30 }, { name: "coverFile", maxCount: 1 }]), async (req, res) => {
  try {
    if (!req.files?.song) return res.status(400).json({ error: "No se subió ninguna canción" });
    const albumName = req.body.albumName?.trim() || "Sin título";
    const uploadedCover = req.files.coverFile?.[0] ? `/uploads/covers/${req.files.coverFile[0].filename}` : "/default_cover.jpg";
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
        const result = await db.run("INSERT INTO albumes(titulo, artista_id, portada) VALUES (?, ?, ?)", [albumName, artista.id, uploadedCover]);
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
});

// ----------------------
// Listado canciones, álbumes, artistas, buscador, etc.
// ----------------------
// (Aquí puedes mantener todo tu código de /api/albums, /api/artists, /api/search, /api/me, etc.)
// Lo dejamos intacto, solo cambia la manera de servir HTML a SPA.

// ----------------------
// Inicializar servidor
// ----------------------
(async () => {
  try { await db.get("SELECT 1"); logStatus("Conexión a DB", true); }
  catch (err) { logStatus("Conexión a DB", false, err.message); }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n Servidor corriendo en http://localhost:${PORT}\n`);
  });
})();
