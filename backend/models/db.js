import sqlite3 from "sqlite3";
import { open } from "sqlite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, "database.sqlite");
const schemaPath = path.join(__dirname, "schema.sql");

const db = await open({
  filename: dbPath,
  driver: sqlite3.Database,
});

// Activar claves foráneas
await db.exec("PRAGMA foreign_keys = ON;");

// 1️⃣ Crear DB si no existe
if (!fs.existsSync(dbPath)) {
  console.warn("⚠️ Base de datos no encontrada. Creando...");
  if (fs.existsSync(schemaPath)) {
    try {
      const schema = fs.readFileSync(schemaPath, "utf-8");
      await db.exec(schema);
      console.log("✅ Esquema inicial aplicado correctamente");
    } catch (err) {
      console.error("❌ Error al ejecutar schema.sql:", err.message);
    }
  } else {
    console.error("❌ No se encontró el archivo schema.sql");
  }
}

// 2️⃣ Migraciones automáticas
try {
  console.log("🚀 Aplicando migraciones automáticas...");

  // ========== IA CACHE ==========
  await db.exec(`
    CREATE TABLE IF NOT EXISTS ia_cache (
      query TEXT PRIMARY KEY,
      results TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );
  `);

  // ========== IA HISTORY ==========
  await db.exec(`
    CREATE TABLE IF NOT EXISTS ia_history (
      user_id INTEGER NOT NULL,
      ia_identifier TEXT NOT NULL,
      titulo TEXT,
      artista TEXT,
      url TEXT,
      portada TEXT,
      duration INTEGER,
      played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, ia_identifier),
      FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  // ========== USUARIOS ==========
  // Agregar columna 'role'
  try {
    await db.exec(`
      ALTER TABLE usuarios ADD COLUMN role TEXT DEFAULT 'user';
    `);
    console.log("🆕 Columna 'role' agregada");
  } catch (err) {
    if (!/duplicate column/i.test(err.message)) console.error(err.message);
  }

  // Agregar columna 'profile_img'
  try {
    await db.exec(`
      ALTER TABLE usuarios ADD COLUMN profile_img TEXT DEFAULT '/public/default_cover.png';
    `);
    console.log("🆕 Columna 'profile_img' agregada");
  } catch (err) {
    if (!/duplicate column/i.test(err.message)) console.error(err.message);
  }

  // Asignar rol 'owner' a tu usuario
  await db.exec(`
    UPDATE usuarios
    SET role = 'owner'
    WHERE LOWER(nombre) IN ('routel', 'elroutel', 'adolfo');
  `);

  // Insertar usuarios base
  await db.exec(`
    INSERT OR IGNORE INTO usuarios (nombre, password, role)
    VALUES 
      ('admin', '$2b$12$RmttDJ9ySItjgv8vsBYyRe0owrY02N.Ssh4bSjQNilJxqh2dYR0Vm', 'admin'),
      ('ADOLFO', '$2b$12$eTB99h98Nn3csDPEDTYw1.1uLgA4sQGAORRNwDWdU2ubpICu/vpjy', 'tester');
  `);

  // ========== ARTISTAS ==========
  await db.exec(`
    CREATE TABLE IF NOT EXISTS artistas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE,
      bio TEXT DEFAULT '',
      imagen TEXT DEFAULT '/public/default_cover.png',
      genero TEXT DEFAULT '',
      pais TEXT DEFAULT '',
      fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_artistas_nombre ON artistas(nombre);
  `);

  // ========== ÁLBUMES ==========
  await db.exec(`
    CREATE TABLE IF NOT EXISTS albumes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT NOT NULL,
      artista_id INTEGER NOT NULL,
      portada TEXT DEFAULT '',
      anio INTEGER,
      genero TEXT DEFAULT '',
      fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (artista_id) REFERENCES artistas(id) ON DELETE CASCADE ON UPDATE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_albumes_titulo ON albumes(titulo);
  `);

  // ========== CANCIONES ==========
  await db.exec(`
    CREATE TABLE IF NOT EXISTS canciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT NOT NULL,
      archivo TEXT NOT NULL,
      artista_id INTEGER NOT NULL,
      album_id INTEGER,
      duracion INTEGER DEFAULT 0,
      genero TEXT DEFAULT '',
      portada TEXT DEFAULT '',
      bit_depth INTEGER DEFAULT 0,
      sample_rate INTEGER DEFAULT 44100,
      bit_rate INTEGER DEFAULT 0,
      fecha_subida DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (artista_id) REFERENCES artistas(id) ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY (album_id) REFERENCES albumes(id) ON DELETE SET NULL ON UPDATE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_canciones_titulo ON canciones(titulo);
  `);

  // ========== PLAYLISTS ==========
  await db.exec(`
    CREATE TABLE IF NOT EXISTS playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      usuario_id INTEGER NOT NULL,
      fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  // ========== PLAYLIST_CANCIONES ==========
  await db.exec(`
    CREATE TABLE IF NOT EXISTS playlist_canciones (
      playlist_id INTEGER NOT NULL,
      cancion_id INTEGER NOT NULL,
      fecha_agregada DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (playlist_id, cancion_id),
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY (cancion_id) REFERENCES canciones(id) ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  // ========== CALIDAD AUDIO ==========
  await db.exec(`
    CREATE TABLE IF NOT EXISTS calidad_audio (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cancion_id INTEGER NOT NULL,
      codec TEXT NOT NULL DEFAULT 'flac',
      bit_depth INTEGER DEFAULT 0,
      sample_rate INTEGER DEFAULT 44100,
      bit_rate INTEGER DEFAULT 0,
      clasificacion TEXT DEFAULT '',
      sospechoso BOOLEAN DEFAULT 0,
      espectrograma TEXT DEFAULT '',
      fecha_analisis DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cancion_id) REFERENCES canciones(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_calidad_cancion_id ON calidad_audio(cancion_id);
  `);

  console.log("✅ Migraciones aplicadas correctamente ✅");
} catch (err) {
  console.error("❌ Error al aplicar migraciones:", err.message);
}

export default db;
