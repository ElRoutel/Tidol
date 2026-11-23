-- =============================================================================
-- TidolCore — Vídeo de YouTube recordado por pista (MariaDB). Idempotente.
-- =============================================================================
--
-- Por qué: cada reproducción de una pista del catálogo buscaba su vídeo en
-- YouTube (search.list = 100 de 10 000 unidades/día ≈ 100 búsquedas/día). La
-- caché de Redis solo dura 7 días y depende del texto exacto de la consulta.
-- track_links.yt_video_id existía sin uso; ahora GET /api/v1/tracks/:mbid/youtube
-- lo lee y lo guarda.
--
-- yt_checked_at: última vez que se comprobó que el vídeo sigue existiendo. Se
-- re-comprueba si tiene más de 30 días (videos.list = 1 unidad), lo que además
-- respeta el límite de las políticas de YouTube API Services para guardar datos
-- de la API sin refrescarlos. NULL = nunca comprobado (p.ej. los yt_video_id
-- heredados de versiones antiguas): se comprueba en el primer uso.
-- Lo usa tidol-core/src/catalog.rs. TidolCore::new también lo añade si falta.

ALTER TABLE track_links
    ADD COLUMN IF NOT EXISTS yt_checked_at TIMESTAMP NULL DEFAULT NULL AFTER yt_video_id;
