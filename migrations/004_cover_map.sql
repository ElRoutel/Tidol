-- =============================================================================
-- TidolCore — Mapa persistente de portadas (MariaDB). Idempotente.
-- =============================================================================
--
-- Por qué: covers/ guardaba una copia de la imagen POR GRABACIÓN
-- (covers/<mbid>.jpg). Todas las pistas de un álbum tienen la misma portada, así
-- que el 52 % del disco eran duplicados (medido: 495 ficheros, 231 imágenes
-- distintas; una misma hasta 20 veces). Además los "sin portada" vivían en
-- memoria 30 min y por réplica (con 3 réplicas, la misma cascada se repetía 3
-- veces). Ahora:
--   - cada id pedido a /covers apunta a su portada de Cover Art Archive
--     (art_key = 'r.<release>' / 'g.<release-group>'), y la imagen se guarda UNA
--     vez en covers/art/<art_key>.jpg;
--   - art_key NULL = sin portada, compartido por todas las réplicas y con
--     reintento a los 7 días (checked_at).
-- Lo usa tidol-core/src/media.rs::get_cover. TidolCore::new también lo crea si
-- falta (mismo DDL).

CREATE TABLE IF NOT EXISTS cover_map (
    mbid       VARCHAR(64) NOT NULL,
    art_key    VARCHAR(40) DEFAULT NULL,
    checked_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (mbid),
    KEY idx_cover_map_art (art_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
