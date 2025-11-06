// backend/server.js
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

// --- Arranque del Servidor ---
(async () => {
  try {
    // 1. Conectar a la DB
    await db.get("SELECT 1");
    logStatus("Conexión a DB", true);

   // ----- ¡AÑADE ESTE BLOQUE! -----
    await db.run(`
      CREATE TABLE IF NOT EXISTS ia_cache (
        query TEXT PRIMARY KEY,
        results TEXT,
        timestamp INTEGER
      )
    `);
    logStatus("Caché de Búsqueda", true, "Tabla 'ia_cache' lista.");

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
    // ----------------------------
  } catch (err) {
    logStatus("Conexión a DB", false, err.message);
    logStatus("Caché de Búsqueda", false, err.message);
  }

  // 3. Iniciar el servidor
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n Servidor corriendo en http://localhost:${PORT} o http://192.168.1.70:${PORT}\n`);
  });
})();