import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import db from "./models/db.js";
import chalk from "chalk";
import gradient from "gradient-string";
import chalkAnimation from "chalk-animation";

import authRoutes from "./routes/auth.routes.js";
import musicRoutes from "./routes/music.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import historyRoutes from "./routes/history.routes.js";
import playlistsRoutes from "./routes/playlists.js";

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
  await new Promise(res => setTimeout(res, 1000));
  startAnim.stop();
  console.clear();
  console.log(gradient.pastel.multiline(banner));
  console.log(chalk.green("✅ Servidor iniciado correctamente.\n"));
}

await showAnimatedBanner();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.JWT_SECRET) {
  console.error("FATAL: set JWT_SECRET in .env antes de arrancar");
  process.exit(1);
}

function logStatus(name, success, info = "") {
  const icon = success ? "✅" : "❌";
  console.log(`${icon} ${name} ${info}`);
}

app.use(express.json());
app.use(cors());

const UPLOADS_DIR = path.join(__dirname, "uploads");
app.use("/uploads", express.static(UPLOADS_DIR));

// --- Montaje de Rutas ---
app.use("/api/auth", authRoutes);
app.use("/api/music", musicRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/playlists", playlistsRoutes);
// -------------------------

// --- Arranque del Servidor ---
(async () => {
  try {
    // Conectar a la DB
    await db.get("SELECT 1");
    logStatus("Conexión a DB", true);

    // --- TABLA IA_CACHE ---
    await db.run(`
      CREATE TABLE IF NOT EXISTS ia_cache (
        query TEXT PRIMARY KEY,
        results TEXT,
        timestamp INTEGER
      )
    `);
    logStatus("Caché de Búsqueda", true, "Tabla 'ia_cache' lista.");

    // --- TABLA HOME RECOMMENDATIONS ---
    await db.run(`
      CREATE TABLE IF NOT EXISTS homeRecomendations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        song_id INTEGER NOT NULL,
        played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (song_id) REFERENCES canciones (id) ON DELETE CASCADE,
        UNIQUE(user_id, song_id)
      )
    `);
    logStatus("Historial", true, "Tabla 'homeRecomendations' lista.");

    // --- TABLA IA_HISTORY ---
    await db.run(`
      CREATE TABLE IF NOT EXISTS ia_history (
        user_id INTEGER NOT NULL,
        ia_identifier TEXT NOT NULL,
        titulo TEXT,
        artista TEXT,
        url TEXT,
        portada TEXT,
        played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, ia_identifier),
        FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
    logStatus("Historial de IA", true, "Tabla 'ia_history' lista.");

    // --- TABLA DE LETRAS (lyrics) ---
    await db.run(`
      CREATE TABLE IF NOT EXISTS lyrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        song_id INTEGER NOT NULL,
        time_ms INTEGER NOT NULL,
        line TEXT NOT NULL,
        FOREIGN KEY (song_id) REFERENCES canciones(id) ON DELETE CASCADE
      )
    `);
    await db.run(`
      CREATE INDEX IF NOT EXISTS idx_lyrics_song_id_time
      ON lyrics(song_id, time_ms)
    `);
    logStatus("Tabla de Letras", true, "Tabla 'lyrics' lista y lista para sincronización.");

  } catch (err) {
    logStatus("Conexión a DB / Creación de tablas", false, err.message);
  }
// --- TABLA LIKES ---
await db.run(`
  CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    song_id INTEGER NOT NULL,
    liked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (song_id) REFERENCES canciones(id) ON DELETE CASCADE,
    UNIQUE(user_id, song_id)
  )
`);
logStatus("Likes", true, "Tabla 'likes' lista.");
  // --- Iniciar el servidor ---
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\nServidor corriendo en http://localhost:${PORT} o http://192.168.1.70:${PORT}\n`);
  });
})();
