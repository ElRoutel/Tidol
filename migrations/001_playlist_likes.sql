-- =============================================================================
-- TidolCore — Likes de playlists (MariaDB). Idempotente.
-- =============================================================================

CREATE TABLE IF NOT EXISTS playlist_likes (
    playlist_id VARCHAR(36) NOT NULL,
    user_id     BIGINT      NOT NULL,
    liked_at    TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (playlist_id, user_id),
    KEY idx_playlist_likes_user (user_id),
    CONSTRAINT fk_playlist_likes_playlist FOREIGN KEY (playlist_id) REFERENCES playlists (id) ON DELETE CASCADE,
    CONSTRAINT fk_playlist_likes_user     FOREIGN KEY (user_id)     REFERENCES users (id)     ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
