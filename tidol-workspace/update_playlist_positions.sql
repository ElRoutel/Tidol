-- =============================================================================
-- TidolCore — Orden estable y URL de reproducción en playlist_songs (MariaDB).
-- Idempotente. tidol-core la aplica también en el arranque (main.rs), este
-- fichero queda como referencia/aplicación manual.
-- =============================================================================

ALTER TABLE playlist_songs
    ADD COLUMN IF NOT EXISTS position INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS url TEXT DEFAULT NULL;

-- Backfill: a las filas existentes (position = 0) se les asigna un orden 1-based
-- según su fecha de añadido. Las nuevas inserciones ya llegan con position.
UPDATE playlist_songs ps
JOIN (
    SELECT playlist_id, track_id,
           ROW_NUMBER() OVER (PARTITION BY playlist_id ORDER BY added_at ASC) AS rn
    FROM playlist_songs
) x ON ps.playlist_id = x.playlist_id AND ps.track_id = x.track_id
SET ps.position = x.rn
WHERE ps.position = 0;
