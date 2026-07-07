-- =============================================================================
-- TidolCore — Limpieza de tablas legado (EJECUTAR MANUALMENTE, UNA VEZ).
-- No está en migrations/ a propósito: contiene DROPs irreversibles.
--
--   docker compose exec -T mariadb mariadb -u tidol_admin -p"$MARIADB_PASSWORD" tidol < cleanup_legacy_tables.sql
--
-- Qué elimina y por qué:
--   · user_history        — historial duplicado: cada reproducción se escribía
--                           también en play_history (la única que lee el código
--                           desde jul-2026). Antes del DROP se backfillea lo que
--                           falte en play_history.
--   · user_favorites      — sustituida por user_likes; 0 referencias en código.
--   · audioProcessingQueue — cola de la era yt-dlp/whisper (bad_engine);
--                           0 referencias en el código actual.
-- =============================================================================

-- 1) Backfill: pasa a play_history las reproducciones de user_history que no
--    estén ya (ventana ±120s para no duplicar la doble escritura histórica).
--    Solo pistas presentes en track_links (FK de play_history).
INSERT INTO play_history (track_mbid, user_id, played_at)
SELECT uh.track_id, uh.user_id, uh.played_at
FROM user_history uh
JOIN track_links tl ON tl.mbid = uh.track_id
WHERE NOT EXISTS (
    SELECT 1 FROM play_history ph
    WHERE ph.user_id = uh.user_id
      AND ph.track_mbid = uh.track_id
      AND ABS(TIMESTAMPDIFF(SECOND, ph.played_at, uh.played_at)) < 120
);

-- 2) Drops
DROP TABLE IF EXISTS user_history;
DROP TABLE IF EXISTS user_favorites;
DROP TABLE IF EXISTS audioProcessingQueue;
