-- 1. Database and User Creation (To be executed as postgres/superuser)
-- Create user tidol with password
CREATE USER tidol WITH PASSWORD 'tidol_secure_password';

-- Create database owned by tidol
CREATE DATABASE tidol OWNER tidol;

-- Connect to the newly created database (for psql)
\c tidol;

-- 2. Schema Migration to PostgreSQL

-- Create custom enum status type
CREATE TYPE artist_status AS ENUM ('provisional', 'full_discography_synced');

-- Create trigger function to handle MySQL-like ON UPDATE CURRENT_TIMESTAMP behavior
CREATE OR REPLACE FUNCTION update_last_sync()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_sync = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Table: artists
CREATE TABLE IF NOT EXISTS artists (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    image_url TEXT,
    cover_url TEXT,
    status artist_status DEFAULT 'provisional',
    last_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Apply ON UPDATE trigger for artists
CREATE TRIGGER trg_artists_last_sync
BEFORE UPDATE ON artists
FOR EACH ROW
EXECUTE FUNCTION update_last_sync();

-- Table: albums
CREATE TABLE IF NOT EXISTS albums (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    artist_id VARCHAR(255) NOT NULL,
    release_year INT,
    cover_url TEXT,
    type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_artist FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
);

-- Table: album_tracks
CREATE TABLE IF NOT EXISTS album_tracks (
    track_mbid VARCHAR(36) PRIMARY KEY,
    album_mbid VARCHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    duration INT,
    track_number INT,
    CONSTRAINT fk_album FOREIGN KEY (album_mbid) REFERENCES albums(id) ON DELETE CASCADE
);

-- Table: trackMetadata (implied table for metadata management)
CREATE TABLE IF NOT EXISTS trackMetadata (
    id SERIAL PRIMARY KEY,
    artist_id VARCHAR(255),
    album_id VARCHAR(255),
    CONSTRAINT fk_metadata_artist FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE SET NULL,
    CONSTRAINT fk_metadata_album FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE SET NULL
);

-- Table: track_links (from main.rs)
CREATE TABLE IF NOT EXISTS track_links (
    mbid VARCHAR(36) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    artist VARCHAR(255) NOT NULL,
    yt_video_id VARCHAR(50) DEFAULT NULL,
    genius_id VARCHAR(50) DEFAULT NULL,
    direct_stream_url TEXT DEFAULT NULL,
    last_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Apply ON UPDATE trigger for track_links
CREATE TRIGGER trg_track_links_last_sync
BEFORE UPDATE ON track_links
FOR EACH ROW
EXECUTE FUNCTION update_last_sync();
