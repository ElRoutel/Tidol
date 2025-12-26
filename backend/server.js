import dotenv from "dotenv";
dotenv.config();


import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import db, { initDB } from "./models/db.js";

// Inicializar DB y migraciones
await initDB();
import chalk from "chalk";
import gradient from "gradient-string";
import chalkAnimation from "chalk-animation";

import authRoutes from "./routes/auth.routes.js";
import musicRoutes from "./routes/music.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import historyRoutes from "./routes/history.routes.js";
import playlistsRoutes from "./routes/playlists.js";
import albumesRoutes from "./routes/albumes.js";
import spectraRoutes from "./routes/spectra.routes.js";
import imageRoutes from "./routes/image.routes.js";
import colorsRoutes from "./routes/colors.routes.js";
import helmet from "helmet";
import compression from "compression";

async function showAnimatedBanner() {
  // console.clear();

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
    Release 11/2025 - Developed by Routel
`;

  const neonAnim = chalkAnimation.pulse(banner);
  await new Promise(res => setTimeout(res, 2000));
  neonAnim.stop();
  // console.clear();
  console.log(gradient.pastel.multiline(banner));
  const startAnim = chalkAnimation.rainbow("💻 Iniciando servidor Routel Music API...");
  await new Promise(res => setTimeout(res, 1000));
  startAnim.stop();
  // console.clear();
  console.log(gradient.pastel.multiline(banner));
  console.log(chalk.green("✅ Servidor iniciado correctamente.\n"));
}

await showAnimatedBanner();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 3000;

if (!process.env.JWT_SECRET) {
  console.error("FATAL: set JWT_SECRET in .env antes de arrancar");
  process.exit(1);
}

function logStatus(name, success, info = "") {
  const icon = success ? "✅" : "❌";
  console.log(`${icon} ${name} ${info}`);
}

// --- Middleware de Optimización ---
// Helmet para seguridad
// Helmet para seguridad (Configuración relajada para SPA + Imágenes externas)
import { createProxyMiddleware } from 'http-proxy-middleware';

// ... (imports)

// Helmet para seguridad (Configuración optimizada para desarrollo local/LAN sin SSL)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "blob:", "https://archive.org", "https://*.archive.org"],
      connectSrc: ["'self'", "https://archive.org", "https://*.archive.org", "http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001"],
      mediaSrc: ["'self'", "https://archive.org", "https://*.archive.org", "blob:"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      upgradeInsecureRequests: null, // No forzar HTTPS en desarrollo local
    },
  },
  crossOriginOpenerPolicy: false, // Evitar bloqueos por origen en COOP
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Permitir recursos cruzados si es necesario
  hsts: false, // No forzar HTTPS (causa ERR_SSL_PROTOCOL_ERROR en HTTP local)
}));

// ... (compression)

// --- Proxy para Spectra (Microservicio Python en puerto 3001) ---
// Soportamos tanto /api/spectra/ como /spectra/ para compatibilidad con el frontend
const spectraProxy = createProxyMiddleware({
  target: 'http://localhost:3001',
  changeOrigin: true,
  pathRewrite: {
    '^/api/spectra': '', // remove /api/spectra prefix
    '^/spectra': '',     // remove /spectra prefix
  },
  onProxyReq: (proxyReq, req, res) => {
    // console.log(`[Proxy Spectra] ${req.method} ${req.url}`);
  },
  onError: (err, req, res) => {
    console.error('[Proxy Error] Spectra not available:', err);
    res.status(503).send('Spectra Service Unavailable');
  }
});

app.use('/api/spectra', spectraProxy);
app.use('/spectra', spectraProxy);

// ... (rest of middleware)

app.use("/api/internal/spectra", spectraRoutes); // Keep internal routes if they exist, but proxy takes precedence for /spectra prefix


// Compression para reducir tamaño de respuestas (Gzip/Brotli)
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6, // Balance entre velocidad y compresión
  threshold: 1024 // Solo comprimir responses > 1KB
}));

app.use(express.json());
app.use(cors({
  origin: true, // In production, replace with specific domain
  credentials: true
}));
app.use(express.json({
  limit: "10mb",
  strict: true,
}));
const UPLOADS_DIR = path.join(__dirname, "uploads");
app.use("/uploads", express.static(UPLOADS_DIR));

// --- Montaje de Rutas ---
app.use("/api/auth", authRoutes);
app.use("/api/music", musicRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/playlists", playlistsRoutes);
app.use("/api/albumes", albumesRoutes);
app.use("/api/internal/spectra", spectraRoutes);
app.use("/api/images", imageRoutes);
app.use("/api/colors", colorsRoutes);
// -------------------------

// Helpers de migración
async function columnExists(table, column) {
  const rows = await db.all(`PRAGMA table_info(${table})`);
  return Array.isArray(rows) && rows.some(c => c.name === column);
}

// Versión endurecida: no oculta errores ajenos a columna duplicada
async function ensureColumn(table, column, typeDef) {
  const exists = await columnExists(table, column);
  if (exists) {
    logStatus(`Migración columna ${table}.${column}`, true, "(ya existe)");
    return;
  }
  try {
    await db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${typeDef}`);
    logStatus(`Migración columna ${table}.${column}`, true, "(añadida)");
  } catch (e) {
    if (!/duplicate column name/i.test(e.message || "")) {
      logStatus(`Migración columna ${table}.${column}`, false, e.message);
      throw e;
    }
    logStatus(`Migración columna ${table}.${column}`, true, "(ya existía)");
  }
}

// --- Arranque del Servidor ---
(async () => {
  try {
    // Conectar a la DB
    await db.get("SELECT 1");
    await db.run("PRAGMA foreign_keys = ON");
    logStatus("Conexión a DB", true);

    // --- TABLA IA_CACHE (+ índices) ---
    await db.run(`
      CREATE TABLE IF NOT EXISTS ia_cache (
        query TEXT PRIMARY KEY,
        results TEXT,
        timestamp INTEGER,
        last_access INTEGER
      )
    `);
    // Migración si ya existía sin last_access
    await ensureColumn("ia_cache", "last_access", "INTEGER");
    await db.run(`CREATE INDEX IF NOT EXISTS ia_cache_timestamp_idx ON ia_cache(timestamp)`);
    await db.run(`CREATE INDEX IF NOT EXISTS ia_cache_last_access_idx ON ia_cache(last_access)`);
    logStatus("Caché de Búsqueda", true, "Tabla 'ia_cache' lista.");

    // --- TABLA IA_CLICKS (+ índice) ---
    await db.run(`
      CREATE TABLE IF NOT EXISTS ia_clicks (
        query TEXT,
        identifier TEXT,
        clicks INTEGER DEFAULT 1,
        last_clicked INTEGER,
        PRIMARY KEY (query, identifier)
      )
    `);
    await db.run(`CREATE INDEX IF NOT EXISTS ia_clicks_query_idx ON ia_clicks(query)`);
    logStatus("IA Clicks", true, "Tabla 'ia_clicks' lista.");

    // --- TABLA IA_HITS (+ índice) ---
    await db.run(`
      CREATE TABLE IF NOT EXISTS ia_hits (
        query TEXT PRIMARY KEY,
        top_identifier TEXT,
        confidence REAL,
        last_update INTEGER
      )
    `);
    await db.run(`CREATE INDEX IF NOT EXISTS ia_hits_last_update_idx ON ia_hits(last_update)`);
    logStatus("IA Hits", true, "Tabla 'ia_hits' lista.");

    // --- TABLA IA_COMPARATOR (+ índice) ---
    await db.run(`
      CREATE TABLE IF NOT EXISTS ia_comparator (
        term_a TEXT,
        term_b TEXT,
        strength REAL DEFAULT 0,
        last_update INTEGER,
        PRIMARY KEY (term_a, term_b)
      )
    `);
    await db.run(`CREATE INDEX IF NOT EXISTS ia_comparator_a_idx ON ia_comparator(term_a)`);
    logStatus("IA Comparator", true, "Tabla 'ia_comparator' lista.");

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
    logStatus("Tabla de Letras", true, "Tabla 'lyrics' lista e indexada.");

    // --- TABLA LIKES (Canciones Locales) ---
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
    logStatus("Likes Locales", true, "Tabla 'likes' lista.");

    // --- TABLA CANCIONES EXTERNAS (Internet Archive) ---
    await db.run(`
      CREATE TABLE IF NOT EXISTS canciones_externas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        external_id TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'internet_archive',
        title TEXT,
        artist TEXT,
        song_url TEXT, -- Parte de la clave única
        cover_url TEXT,
        duration REAL,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(external_id, song_url)
      )
    `);
    // Aseguramos el índice correcto para la lógica de la aplicación.
    await db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_canciones_externas_unique ON canciones_externas(external_id, song_url)`);
    logStatus("Canciones Externas", true, "Tabla 'canciones_externas' lista.");

    // --- TABLA PROXIES ---
    await db.run(`
      CREATE TABLE IF NOT EXISTS proxies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        address TEXT NOT NULL,
        active BOOLEAN DEFAULT 0,
        last_used INTEGER
      )
    `);

    // Insertar proxy por defecto si no existe ninguno
    const proxyCount = await db.get("SELECT COUNT(*) as count FROM proxies");
    if (proxyCount.count === 0) {
      await db.run(`INSERT INTO proxies (address, active, last_used) VALUES (?, 1, ?)`, ['socks5://127.0.0.1:9050', Date.now()]);
      logStatus("Proxies", true, "Tabla 'proxies' inicializada con valor por defecto.");
    } else {
      logStatus("Proxies", true, "Tabla 'proxies' lista.");
    }

    // --- TABLA LIKES EXTERNOS (Internet Archive) ---
    await db.run(`
      CREATE TABLE IF NOT EXISTS likes_externos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        cancion_externa_id INTEGER NOT NULL,
        liked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        FOREIGN KEY (cancion_externa_id) REFERENCES canciones_externas(id) ON DELETE CASCADE,
        UNIQUE(user_id, cancion_externa_id)
      )
    `);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_likes_externos_user_id ON likes_externos(user_id)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_likes_externos_cancion_externa_id ON likes_externos(cancion_externa_id)`);
    logStatus("Likes Externos", true, "Tabla 'likes_externos' lista.");

    // --- ÍNDICES DE OPTIMIZACIÓN (Performance Boost) ---
    console.log("\n🚀 Aplicando índices de optimización de performance...\n");

    // Índices compuestos para queries frecuentes en canciones
    await db.run(`CREATE INDEX IF NOT EXISTS idx_canciones_artist_album ON canciones(artista_id, album_id)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_canciones_fecha_subida ON canciones(fecha_subida DESC)`);
    logStatus("Índices Canciones", true, "Índices compuestos para búsquedas optimizadas");

    // Índices para likes (operaciones frecuentes)
    await db.run(`CREATE INDEX IF NOT EXISTS idx_likes_user_song ON likes(user_id, song_id)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id)`);
    logStatus("Índices Likes", true, "Índices para verificación rápida de likes");

    // Índices para álbumes por artista (navegación común)
    await db.run(`CREATE INDEX IF NOT EXISTS idx_albumes_artista_id ON albumes(artista_id)`);
    logStatus("Índices Álbumes", true, "Índice para listado por artista");

    // Índices para playlists
    await db.run(`CREATE INDEX IF NOT EXISTS idx_playlists_usuario_id ON playlists(usuario_id)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_playlist_canciones_playlist ON playlist_canciones(playlist_id)`);
    logStatus("Índices Playlists", true, "Índices para consultas de playlists");

    // Índices para homeRecomendations (página de inicio)
    await db.run(`CREATE INDEX IF NOT EXISTS idx_home_recs_user_id ON homeRecomendations(user_id)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_home_recs_played_at ON homeRecomendations(played_at DESC)`);
    logStatus("Índices Home", true, "Índices para recomendaciones de inicio");

    console.log("✅ Todos los índices de optimización aplicados correctamente.\n");

    //NO TOCAR ES PARA SERVIR EL FRONTEND
    //NO TOCAR
    //NO TOCAR
    // --- Servir el Frontend (tidol-ui/dist) ---
    const frontendDistPath = path.join(__dirname, '..', 'tidol-ui', 'dist');

    // Middleware para servir los archivos estáticos (JS, CSS, imágenes, etc.)
    app.use(express.static(frontendDistPath));
    logStatus("Frontend", true, `Sirviendo archivos estáticos desde ${frontendDistPath}`);

    // Middleware "catch-all" para Single Page Applications (SPA).
    app.get('*', (req, res) => {
      // 1. Si es una ruta de API, no devolver el index.html
      if (req.originalUrl.startsWith('/api')) {
        return res.status(404).json({ error: "Ruta de API no encontrada" });
      }

      // 2. Si es un archivo estático (tiene extensión o está en /assets/) que no se encontró en express.static
      // devolvemos 404 en lugar de index.html para evitar errores de MIME type.
      const isFile = req.path.includes('.') || req.path.includes('/assets/');
      if (isFile) {
        return res.status(404).send('Archivo no encontrado');
      }

      // 3. Para todo lo demás (rutas del router de React), servir index.html
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(frontendDistPath, 'index.html'));
    });

    // --- Health Check (Optimized) ---
    // Place this BEFORE the catch-all to prevent SPA serving for health checks
    app.get("/health", (req, res) => {
      res.status(200).json({ status: "ok", server: "Routel Music API" });
    });

    app.get("/api/health", (req, res) => {
      res.json({ status: "ok", server: "Routel Music API" });
    });

    // --- Iniciar el servidor ---

    // Inicializar Proxies antes de escuchar
    const { initProxies } = await import("./services/iaProxy.service.js");
    await initProxies();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`\nServidor corriendo en http://localhost:${PORT} o http://192.168.1.70:${PORT}\n`);
    });
  } catch (err) {
    logStatus("Conexión a DB / Creación de tablas", false, err.message);
    process.exit(1);
  }
}
)();
