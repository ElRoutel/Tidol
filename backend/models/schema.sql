-- ======================================================
-- ACTUALIZACIÓN COMPLETA DE LA BASE DE DATOS TIDOL
-- ======================================================

-- -----------------------
-- 1️⃣ Tabla de usuarios con roles
-- -----------------------
-- Agregar columna 'role' si no existe
ALTER TABLE usuarios ADD COLUMN role TEXT DEFAULT 'user';
-- esto es para mostrar imagen de perfil por defecto
ALTER TABLE usuarios ADD COLUMN profile_img TEXT DEFAULT '/public/default_cover.png';

-- Marcar tu usuario dev/owner
UPDATE usuarios
SET role = 'owner'
WHERE nombre = 'Routel';

-- Ejemplo: agregar usuario admin y tester (reemplaza <hashed_password> con bcrypt)
INSERT OR IGNORE INTO usuarios (nombre, password, role)
VALUES ('admin', '<$2b$12$RmttDJ9ySItjgv8vsBYyRe0owrY02N.Ssh4bSjQNilJxqh2dYR0Vm>', 'admin');

INSERT OR IGNORE INTO usuarios (nombre, password, role)
VALUES ('ADOLFO', '<$2b$12$eTB99h98Nn3csDPEDTYw1.1uLgA4sQGAORRNwDWdU2ubpICu/vpjy>', 'tester');

-- Verificación rápida
SELECT id, nombre, role FROM usuarios;


-- -----------------------
-- 2️⃣ Tabla de artistas (existente, sin cambios)
-- -----------------------
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


-- -----------------------
-- 3️⃣ Tabla de álbumes (existente, sin cambios)
-- -----------------------
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


-- -----------------------
-- 4️⃣ Tabla de canciones (existente, sin cambios)
-- -----------------------
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


-- -----------------------
-- 5️⃣ Tabla de playlists (existente, sin cambios)
-- -----------------------
CREATE TABLE IF NOT EXISTS playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    usuario_id INTEGER NOT NULL,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE ON UPDATE CASCADE
);


-- -----------------------
-- 6️⃣ Tabla intermedia playlist_canciones (existente, sin cambios)
-- -----------------------
CREATE TABLE IF NOT EXISTS playlist_canciones (
    playlist_id INTEGER NOT NULL,
    cancion_id INTEGER NOT NULL,
    fecha_agregada DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (playlist_id, cancion_id),
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (cancion_id) REFERENCES canciones(id) ON DELETE CASCADE ON UPDATE CASCADE
);


-- -----------------------
-- 7️⃣ Tabla calidad_audio (existente, sin cambios)
-- -----------------------
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
