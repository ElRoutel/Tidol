CREATE TABLE IF NOT EXISTS artists (
    mbid VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    cover_url TEXT,
    status ENUM('provisional', 'full_discography_synced') DEFAULT 'provisional',
    last_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS albums (
    mbid VARCHAR(36) PRIMARY KEY,
    artist_mbid VARCHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    release_year INT,
    cover_url TEXT,
    type VARCHAR(50),
    FOREIGN KEY (artist_mbid) REFERENCES artists(mbid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS album_tracks (
    track_mbid VARCHAR(36) PRIMARY KEY,
    album_mbid VARCHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    duration INT,
    track_number INT,
    FOREIGN KEY (album_mbid) REFERENCES albums(mbid) ON DELETE CASCADE
);
