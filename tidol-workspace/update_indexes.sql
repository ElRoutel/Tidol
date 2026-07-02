-- =============================================================================
-- TidolCore — Índices de rendimiento (MariaDB)
-- Aplica sobre una BD ya creada con schema_full.sql. Idempotente.
-- =============================================================================

-- El dashboard de Home hace JOIN artists a ON t.artist = a.name (orchestrator.rs
-- get_home_dashboard): sin índice en artists.name es un full scan por cada fila
-- de play_history del usuario.
CREATE INDEX IF NOT EXISTS idx_artists_name ON artists (name);

-- resolve_artist_handler busca por name LIKE '%..%'; el índice al menos acota
-- los prefijos y las búsquedas exactas.
-- (cubierto por idx_artists_name)

-- get_history_handler hace LEFT JOIN trackMetadata ON h.track_id = tm.trackId
-- (cubierto por uq_trackMetadata_trackId) y ordena por played_at por usuario.
CREATE INDEX IF NOT EXISTS idx_user_history_user_played
    ON user_history (user_id, played_at);

-- get_listen_again / recently_played agrupan y ordenan play_history por usuario
-- y fecha.
CREATE INDEX IF NOT EXISTS idx_play_history_user_played
    ON play_history (user_id, played_at);

-- hydrate_unknown_tracks y el prefetch filtran por estado de letras.
CREATE INDEX IF NOT EXISTS idx_track_links_lyrics_status
    ON track_links (lyrics_status);

-- user_likes se filtra por (user_id, source).
CREATE INDEX IF NOT EXISTS idx_user_likes_user_source
    ON user_likes (user_id, source);
