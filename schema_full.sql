-- =============================================================================
-- TidolCore — Schema completo de producción (MariaDB / MySQL)
-- Ejecutar en orden (respeta dependencias de FK)
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------
-- Artistas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS artists (
    mbid       VARCHAR(36)  NOT NULL,
    name       VARCHAR(255) NOT NULL,
    image_url  TEXT         DEFAULT NULL,
    cover_url  TEXT         DEFAULT NULL,
    status     ENUM('provisional','full_discography_synced') DEFAULT 'provisional',
    last_sync  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (mbid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Álbumes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS albums (
    mbid         VARCHAR(36)  NOT NULL,
    title        VARCHAR(255) NOT NULL,
    artist_mbid  VARCHAR(36)  NOT NULL,
    release_year INT          DEFAULT NULL,
    cover_url    TEXT         DEFAULT NULL,
    cover_status VARCHAR(50)  DEFAULT NULL,
    type         VARCHAR(50)  DEFAULT NULL,
    created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (mbid),
    CONSTRAINT fk_albums_artist FOREIGN KEY (artist_mbid) REFERENCES artists (mbid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Pistas de álbum
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS album_tracks (
    track_mbid   VARCHAR(36)  NOT NULL,
    album_mbid   VARCHAR(36)  NOT NULL,
    title        VARCHAR(255) NOT NULL,
    duration     INT          DEFAULT NULL,
    track_number INT          DEFAULT NULL,
    PRIMARY KEY (track_mbid),
    CONSTRAINT fk_album_tracks_album FOREIGN KEY (album_mbid) REFERENCES albums (mbid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Track links (índice maestro de pistas con URLs de streaming)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS track_links (
    mbid                   VARCHAR(36)  NOT NULL,
    title                  VARCHAR(255) NOT NULL,
    artist                 VARCHAR(255) NOT NULL,
    yt_video_id            VARCHAR(50)  DEFAULT NULL,
    genius_id              VARCHAR(50)  DEFAULT NULL,
    direct_stream_url      TEXT         DEFAULT NULL,
    cover_url              TEXT         DEFAULT NULL,
    lyrics_json            TEXT         DEFAULT NULL,
    lyrics_status          VARCHAR(50)  DEFAULT NULL,
    premium_audio_path     TEXT         DEFAULT NULL,
    provisional_audio_path TEXT         DEFAULT NULL,
    soundcloud_track_id    VARCHAR(100) DEFAULT NULL,
    last_sync              TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (mbid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Metadata de pistas (caché de búsqueda y procesamiento)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trackMetadata (
    id                  BIGINT       NOT NULL AUTO_INCREMENT,
    trackId             VARCHAR(255) NOT NULL,
    trackName           VARCHAR(255) NOT NULL DEFAULT '',
    artistName          VARCHAR(255) DEFAULT NULL,
    coverArtUrl         TEXT         DEFAULT NULL,
    sourceLink          TEXT         DEFAULT NULL,
    isCached            TINYINT(1)   DEFAULT 0,
    hasLyrics           TINYINT(1)   DEFAULT 0,
    albumName           VARCHAR(255) DEFAULT NULL,
    durationSeconds     INT          DEFAULT NULL,
    localAudioPath      TEXT         DEFAULT NULL,
    localLyricsPath     TEXT         DEFAULT NULL,
    structuredWordsJson TEXT         DEFAULT NULL,
    extractedColors     TEXT         DEFAULT NULL,
    artist_id           VARCHAR(255) DEFAULT NULL,
    album_id            VARCHAR(255) DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_trackMetadata_trackId (trackId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Clics de búsqueda (analítica)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS searchClicks (
    queryNormalized VARCHAR(500) NOT NULL,
    trackId         VARCHAR(255) NOT NULL,
    clicks          INT          DEFAULT 1,
    PRIMARY KEY (queryNormalized, trackId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Cola de procesamiento de audio / letras
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audioProcessingQueue (
    taskId       BIGINT       NOT NULL AUTO_INCREMENT,
    trackId      VARCHAR(255) NOT NULL,
    status       VARCHAR(50)  DEFAULT 'PENDING',
    progress     INT          DEFAULT 0,
    errorMessage TEXT         DEFAULT NULL,
    PRIMARY KEY (taskId),
    KEY idx_apq_trackId (trackId),
    KEY idx_apq_status  (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Usuarios
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    username      VARCHAR(50)  NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Dispositivos (sesiones JWT por usuario)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS devices (
    id          VARCHAR(36)  NOT NULL,
    user_id     BIGINT       NOT NULL,
    device_name VARCHAR(255) NOT NULL,
    device_type VARCHAR(100) NOT NULL,
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_devices_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Playlists
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS playlists (
    id         VARCHAR(36)  NOT NULL,
    user_id    BIGINT       NOT NULL,
    name       VARCHAR(255) NOT NULL,
    created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_playlists_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Canciones en playlists
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS playlist_songs (
    playlist_id VARCHAR(36)  NOT NULL,
    track_id    VARCHAR(255) NOT NULL,
    song_source VARCHAR(50)  DEFAULT NULL,
    title       VARCHAR(255) DEFAULT NULL,
    artist      VARCHAR(255) DEFAULT NULL,
    cover_url   TEXT         DEFAULT NULL,
    duration    INT          DEFAULT NULL,
    url         TEXT         DEFAULT NULL,
    position    INT          NOT NULL DEFAULT 0,
    added_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (playlist_id, track_id),
    CONSTRAINT fk_playlist_songs_playlist FOREIGN KEY (playlist_id) REFERENCES playlists (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Historial de reproducción del usuario
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_history (
    id        BIGINT       NOT NULL AUTO_INCREMENT,
    user_id   BIGINT       NOT NULL,
    track_id  VARCHAR(255) NOT NULL,
    played_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_user_history_user (user_id),
    CONSTRAINT fk_user_history_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Likes del usuario
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_likes (
    id       BIGINT       NOT NULL AUTO_INCREMENT,
    user_id  BIGINT       NOT NULL,
    track_id VARCHAR(255) NOT NULL,
    source   VARCHAR(50)  NOT NULL DEFAULT 'local',
    liked_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_user_likes (user_id, track_id),
    CONSTRAINT fk_user_likes_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Historial de reproducciones detallado
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS play_history (
    id         BIGINT      NOT NULL AUTO_INCREMENT,
    track_mbid VARCHAR(36) DEFAULT NULL,
    user_id    BIGINT      DEFAULT NULL,
    played_at  TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_play_history_user  (user_id),
    KEY idx_play_history_track (track_mbid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
