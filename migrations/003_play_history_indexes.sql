-- =============================================================================
-- TidolCore — Índices para las consultas reales (MariaDB). Idempotente.
-- =============================================================================

-- play_history: home/listen-again filtran por user_id y agregan por pista y
-- fecha. Sin esto, cada carga de Home escanea la tabla completa.
ALTER TABLE play_history
    ADD INDEX IF NOT EXISTS idx_play_history_user (user_id, track_mbid, played_at);

-- playlist_songs: el listado ordena por posición dentro de la playlist.
ALTER TABLE playlist_songs
    ADD INDEX IF NOT EXISTS idx_playlist_songs_pos (playlist_id, position);
