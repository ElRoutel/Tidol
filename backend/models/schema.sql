-- ======================================================
-- ACTUALIZACIÓN DE BASE DE DATOS - TIDOL v2 (Rama db-update-tidol)
-- ======================================================

-- =======================================
-- 1️⃣ USUARIOS (Agregar columnas nuevas)
-- =======================================
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE,
    email TEXT UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    profile_img TEXT DEFAULT '/assets/default_user.png',
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =======================================
-- 2️⃣ ARTISTAS
-- =======================================
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


-- =======================================
-- 3️⃣ ÁLBUMES
-- =======================================
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


-- =======================================
-- 4️⃣ CANCIONES
-- =======================================
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


-- =======================================
-- 5️⃣ PLAYLISTS
-- =======================================
CREATE TABLE IF NOT EXISTS playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    usuario_id INTEGER NOT NULL,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE ON UPDATE CASCADE
);


-- =======================================
-- 6️⃣ PLAYLIST_CANCIONES (Soporta IDs mixtos: local + IA)
-- =======================================
CREATE TABLE IF NOT EXISTS playlist_canciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playlist_id INTEGER NOT NULL,
    cancion_id TEXT NOT NULL,
    song_source TEXT NOT NULL DEFAULT 'local',
    fecha_agregada DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(playlist_id, cancion_id),
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE ON UPDATE CASCADE
);


-- =======================================
-- 7️⃣ LIKES (Tabla de Me Gusta)
-- =======================================
CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    song_id INTEGER NOT NULL,
    liked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, song_id),
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (song_id) REFERENCES canciones(id) ON DELETE CASCADE
);


-- =======================================
-- 8️⃣ CALIDAD DE AUDIO
-- =======================================
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

-- =======================================
-- 9️⃣ IA_HISTORY (Historial de canciones de Internet Archive)
-- =======================================
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
);

-- Add new columns if they don't exist (for existing databases)
-- These ALTER TABLE statements are for existing databases that might not have these columns.
-- They will fail gracefully if the columns already exist.
-- In a real-world scenario, you might use a proper migration system.
-- For this exercise, we'll add them here.
ALTER TABLE ia_history ADD COLUMN titulo TEXT;
ALTER TABLE ia_history ADD COLUMN artista TEXT;
ALTER TABLE ia_history ADD COLUMN url TEXT;
ALTER TABLE ia_history ADD COLUMN portada TEXT;

-- =======================================
-- 10) CANCIONES EXTERNAS (Para Internet Archive y otros)
-- =======================================
CREATE TABLE IF NOT EXISTS canciones_externas (
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


-- =======================================
-- 11) LIKES EXTERNOS (Me Gusta para canciones externas)
-- =======================================
DROP TABLE IF EXISTS likes_externos;
CREATE TABLE IF NOT EXISTS likes_externos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    cancion_externa_id INTEGER NOT NULL,
    liked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, cancion_externa_id),
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (cancion_externa_id) REFERENCES canciones_externas(id) ON DELETE CASCADE
);