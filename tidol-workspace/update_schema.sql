CREATE TABLE IF NOT EXISTS artists (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS albums (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    artist_id VARCHAR(255) NOT NULL,
    release_year INT,
    cover_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
);

-- Check if column exists before adding it to avoid errors if it was partially applied
SET @dbname = DATABASE();
SET @tablename = "trackMetadata";

SELECT count(*) INTO @col_exists_artist 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = "artist_id";

SET @s = IF(@col_exists_artist = 0, 'ALTER TABLE trackMetadata ADD COLUMN artist_id VARCHAR(255) NULL;', 'SELECT "Column artist_id exists"');
PREPARE stmt FROM @s;
EXECUTE stmt;

SELECT count(*) INTO @col_exists_album 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = "album_id";

SET @s = IF(@col_exists_album = 0, 'ALTER TABLE trackMetadata ADD COLUMN album_id VARCHAR(255) NULL;', 'SELECT "Column album_id exists"');
PREPARE stmt FROM @s;
EXECUTE stmt;

-- Add constraints if they don't exist
SELECT count(*) INTO @fk_exists_artist 
FROM information_schema.TABLE_CONSTRAINTS 
WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND CONSTRAINT_NAME = "fk_artist";

SET @s = IF(@fk_exists_artist = 0, 'ALTER TABLE trackMetadata ADD CONSTRAINT fk_artist FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE SET NULL;', 'SELECT "FK fk_artist exists"');
PREPARE stmt FROM @s;
EXECUTE stmt;

SELECT count(*) INTO @fk_exists_album 
FROM information_schema.TABLE_CONSTRAINTS 
WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND CONSTRAINT_NAME = "fk_album";

SET @s = IF(@fk_exists_album = 0, 'ALTER TABLE trackMetadata ADD CONSTRAINT fk_album FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE SET NULL;', 'SELECT "FK fk_album exists"');
PREPARE stmt FROM @s;
EXECUTE stmt;
