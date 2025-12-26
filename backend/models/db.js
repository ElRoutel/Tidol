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

// Activar claves foráneas y WAL mode para concurrencia
await db.exec("PRAGMA foreign_keys = ON;");
await db.exec("PRAGMA journal_mode = WAL;");

// 1️⃣ Crear DB si no hay tablas
const tableCheck = await db.all("SELECT name FROM sqlite_master WHERE type='table'");
if (tableCheck.length === 0) {
  console.warn("⚠️ Base de datos vacía. Aplicando esquema desde schema.sql...");
  if (fs.existsSync(schemaPath)) {
    try {
      const schema = fs.readFileSync(schemaPath, "utf-8");
      // Split and execute segments to avoid "too many statements" issues or simply exec
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
async function initDB() {
  try {
    console.log("🚀 Aplicando migraciones automáticas...\n");
    console.log("🔧 ASEGURANDO TABLAS BASE...\n");

    // ========== USUARIOS (BASE) ==========
    await db.exec(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL UNIQUE,
        email TEXT UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        profile_img TEXT DEFAULT '/public/default_cover.png',
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ========== CANCIONES (BASE) ==========
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
        ia_id TEXT UNIQUE,
        bpm REAL DEFAULT 0,
        musical_key TEXT DEFAULT '',
        cue_in REAL DEFAULT 0,
        cue_out REAL DEFAULT 0,
        fecha_subida DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (artista_id) REFERENCES artistas(id) ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY (album_id) REFERENCES albumes(id) ON DELETE SET NULL ON UPDATE CASCADE
      );
    `);

    console.log("🔧 FORZANDO CREACIÓN DE COLUMNAS DJ METADATA (TEMPORAL)...\n");

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
      play_count INTEGER DEFAULT 1,
      PRIMARY KEY (user_id, ia_identifier),
      FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

    // ========== USUARIOS ==========
    const hasUsuarios = (await db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='usuarios'")).length > 0;
    if (hasUsuarios) {
      // Agregar columna 'role'
      try {
        await db.exec(`ALTER TABLE usuarios ADD COLUMN role TEXT DEFAULT 'user';`);
        console.log("🆕 Columna 'role' agregada");
      } catch (err) {
        if (!/duplicate column/i.test(err.message)) console.error(err.message);
      }

      // Agregar columna 'profile_img'
      try {
        await db.exec(`ALTER TABLE usuarios ADD COLUMN profile_img TEXT DEFAULT '/public/default_cover.png';`);
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
    } else {
      console.warn("⚠️ Tabla 'usuarios' no existe. Saltando sus migraciones.");
    }

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
    CREATE INDEX IF NOT EXISTS idx_albumes_artista ON albumes(artista_id);
  `);

    // ========== CANCIONES DJ METADATA ==========
    const hasCanciones = (await db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='canciones'")).length > 0;
    if (hasCanciones) {
      try {
        await db.exec(`ALTER TABLE canciones ADD COLUMN bit_rate INTEGER DEFAULT 0; `);
        console.log("🆕 Columna 'bit_rate' agregada a canciones");
      } catch (err) { if (!/duplicate column/i.test(err.message)) console.error(err.message); }

      const columns = await db.all("PRAGMA table_info(canciones)");
      const columnNames = columns.map(c => c.name);
      // console.log("📊 Columnas actuales en 'canciones':", columnNames.join(", "));

      const columnsToAdd = [
        { name: 'ia_id', type: 'TEXT' },
        { name: 'bpm', type: 'REAL DEFAULT 0' },
        { name: 'musical_key', type: 'TEXT DEFAULT ""' },
        { name: 'cue_in', type: 'REAL DEFAULT 0' },
        { name: 'cue_out', type: 'REAL DEFAULT 0' }
      ];

      for (const col of columnsToAdd) {
        if (!columnNames.includes(col.name)) {
          try {
            console.log(`🔧 Agregando columna '${col.name}'...`);
            await db.exec(`ALTER TABLE canciones ADD COLUMN ${col.name} ${col.type};`);
            console.log(`✅ Columna '${col.name}' agregada exitosamente.`);

            if (col.name === 'ia_id') {
              await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_canciones_ia_id ON canciones(ia_id);`);
            }
          } catch (err) {
            console.error(`❌ Error agregando '${col.name}':`, err.message);
          }
        }
      }
    } else {
      console.warn("⚠️ Tabla 'canciones' no existe. Saltando sus migraciones.");
    }

    // ========== MIGRACIÓN PLAY COUNT ==========
    try {
      await db.exec(`ALTER TABLE ia_history ADD COLUMN play_count INTEGER DEFAULT 1; `);
      console.log("🆕 Columna 'play_count' agregada a ia_history");
    } catch (err) { if (!/duplicate column/i.test(err.message)) console.error(err.message); }

    // ========== MIGRACIÓN COLORES (NEW) ==========
    const tablesForColors = ['canciones', 'albumes', 'canciones_externas'];
    for (const table of tablesForColors) {
      try {
        await db.exec(`ALTER TABLE ${table} ADD COLUMN extracted_colors TEXT DEFAULT NULL;`);
        console.log(`🎨 Columna 'extracted_colors' agregada a ${table}`);
      } catch (err) {
        if (!/duplicate column/i.test(err.message)) console.error(`Error colores ${table}:`, err.message);
      }
    }

    try {
      // Intentamos crear la tabla homeRecomendations si no existe, ya que no la vi en el schema
      await db.exec(`
      CREATE TABLE IF NOT EXISTS homeRecomendations(
    user_id INTEGER NOT NULL,
    song_id INTEGER NOT NULL,
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    play_count INTEGER DEFAULT 1,
    PRIMARY KEY(user_id, song_id),
    FOREIGN KEY(user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY(song_id) REFERENCES canciones(id) ON DELETE CASCADE
  );
  `);

      // Intentamos agregar la columna si la tabla ya existía
      await db.exec(`ALTER TABLE homeRecomendations ADD COLUMN play_count INTEGER DEFAULT 1; `);
      console.log("🆕 Columna 'play_count' agregada a homeRecomendations");
    } catch (err) { if (!/duplicate column/i.test(err.message)) console.error(err.message); }

    // ========== PLAYLISTS ==========
    await db.exec(`
    CREATE TABLE IF NOT EXISTS playlists(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    usuario_id INTEGER NOT NULL,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE ON UPDATE CASCADE
  );
  `);

    // ========== PLAYLIST_CANCIONES (Soporta IDs mixtos) ==========
    // Primero eliminar la tabla antigua si existe (para recrearla sin constraints)
    await db.exec(`DROP TABLE IF EXISTS playlist_canciones; `);

    // Recrear con cancion_id como TEXT para soportar IDs de IA y locales
    await db.exec(`
    CREATE TABLE playlist_canciones(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playlist_id INTEGER NOT NULL,
    cancion_id TEXT NOT NULL,
    song_source TEXT NOT NULL DEFAULT 'local',
    fecha_agregada DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(playlist_id, cancion_id),
    FOREIGN KEY(playlist_id) REFERENCES playlists(id) ON DELETE CASCADE ON UPDATE CASCADE
  );
  `);
    console.log("✅ Tabla playlist_canciones recreada con soporte para IDs mixtos");

    // ========== CALIDAD AUDIO ==========
    await db.exec(`
    CREATE TABLE IF NOT EXISTS calidad_audio(
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
    FOREIGN KEY(cancion_id) REFERENCES canciones(id) ON DELETE CASCADE
  );
    CREATE INDEX IF NOT EXISTS idx_calidad_cancion_id ON calidad_audio(cancion_id);
  `);

    // ========== LIKES (Tabla de Me Gusta) ==========
    await db.exec(`
    CREATE TABLE IF NOT EXISTS likes(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    song_id INTEGER NOT NULL,
    liked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, song_id),
    FOREIGN KEY(user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY(song_id) REFERENCES canciones(id) ON DELETE CASCADE
  );
  `);

    // ========== CANCIONES EXTERNAS ==========
    await db.exec(`
    CREATE TABLE IF NOT EXISTS canciones_externas(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id TEXT NOT NULL UNIQUE,
    source TEXT NOT NULL DEFAULT 'internet_archive',
    title TEXT NOT NULL,
    artist TEXT,
    song_url TEXT NOT NULL,
    cover_url TEXT,
    duration INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
    CREATE INDEX IF NOT EXISTS idx_canciones_externas_external_id ON canciones_externas(external_id);
  `);

    // ========== LIKES EXTERNOS ==========
    await db.exec(`
    CREATE TABLE IF NOT EXISTS likes_externos(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    cancion_externa_id INTEGER NOT NULL,
    liked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, cancion_externa_id),
    FOREIGN KEY(user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY(cancion_externa_id) REFERENCES canciones_externas(id) ON DELETE CASCADE
  );
  `);

    // ========== PROXIES ==========
    await db.exec(`
    CREATE TABLE IF NOT EXISTS proxies(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    address TEXT NOT NULL,
    active BOOLEAN DEFAULT 0,
    last_used INTEGER
  );
  `);

    console.log("✅ Migraciones aplicadas correctamente ✅");
  } catch (err) {
    console.error("❌ Error al aplicar migraciones:", err.message);
  }
}

// Auto-initialize on import (legacy support) but also export for explicit call
await initDB();

export default db;
export { initDB };
