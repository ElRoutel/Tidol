# 05 — Base de datos (MariaDB), migraciones y SQLx

[← Índice](INDICE.md)

- Motor: **MariaDB 11.4** (contenedor `tidol-mariadb`, BD `tidol`, usuario `tidol_admin`).
- Acceso: `sqlx 0.7` con macros `query!` (validadas en compilación contra `.sqlx/`) y
  algunas `query`/`query_as` dinámicas (sin validar en compilación).
- Esquema de referencia: **`schema_full.sql`** (raíz del repo). `deploy.sh --full` lo
  importa si la BD está vacía.

## Tablas

| Tabla | Para qué | Claves / notas |
|-------|----------|----------------|
| `users` | cuentas | `id` BIGINT auto, `username` único, `password_hash` (argon2) |
| `devices` | una fila por sesión/login; el JWT lleva su `id` | FK → users ON DELETE CASCADE. Nunca se purgan los antiguos |
| `artists` | caché de artistas de MusicBrainz | PK `mbid`; `status` `provisional`/`full_discography_synced`; `image_url` y `cover_url` (redundantes) |
| `albums` | caché de álbumes (release-groups) | PK `mbid`, FK → artists; `cover_status` (`not_found` lo pone el front vía report-cover-404) |
| `album_tracks` | pistas de álbum | PK `track_mbid` (¡una pista solo puede estar en un álbum!), FK → albums |
| `track_links` | **índice maestro de pistas** reproducidas: título, artista, portada, letras | PK `mbid`; `lyrics_json` + `lyrics_status` (`pending`/`lrclib_synced`/`plain_only`/`whisper_synced`/`not_found`). `yt_video_id` + `yt_checked_at` = vídeo de YouTube recordado (desde 2026-11-23). Columnas **legado**: `genius_id`, `direct_stream_url`, `premium_audio_path`, `provisional_audio_path`, `soundcloud_track_id` |
| `trackMetadata` | caché de metadata de búsquedas/clics/likes de IA | camelCase (herencia de otra época); PK `id`, único `trackId`. Muchas columnas legado (`localAudioPath`, `structuredWordsJson`…) |
| `searchClicks` | analítica: query normalizada × pista → nº clics | PK compuesta |
| `playlists` | playlists | PK `id` UUID (VARCHAR 36), FK → users |
| `playlist_songs` | canciones de playlist (con metadata desnormalizada) | PK `(playlist_id, track_id)`; `position` (orden estable), `url` (audio directo de IA), `song_source` |
| `playlist_likes` | likes a playlists | PK `(playlist_id, user_id)`, FKs con cascade |
| `user_likes` | likes a canciones | único `(user_id, track_id)`; `source` `local`/`archive` |
| `cover_map` | **mapa de portadas**: id pedido a `/covers` → portada de CAA | PK `mbid`; `art_key` `r.<release>`/`g.<release-group>` o NULL (sin portada, reintento a los 7 días por `checked_at`). Imagen en `covers/art/<art_key>.jpg`, una por portada |
| `play_history` | **única** fuente de historial (Home, "Volver a escuchar", `/history`) | sin FK a users (por eso `delete_account` la borra a mano); índices `(user_id, track_mbid, played_at)` y `(track_mbid)` |

Tablas **legado ya eliminadas** (o a eliminar con `cleanup_legacy_tables.sql`):
`user_history` (historial duplicado; se backfillea a `play_history` antes del DROP),
`user_favorites` (sustituida por `user_likes`), `audioProcessingQueue` (cola de
yt-dlp/whisper). `clear_cache.sh` (local, no versionado) todavía las menciona.

## Migraciones

Hay **tres mecanismos** (sí, es un poco caótico):

1. **`TidolCore::new`** (`tidol-core/src/lib.rs`) — se ejecuta en cada arranque, idempotente:
   `CREATE TABLE IF NOT EXISTS track_links` (versión reducida de columnas) y
   `ALTER TABLE playlist_songs ADD COLUMN IF NOT EXISTS position, url` + backfill.
2. **`migrations/00N_*.sql`** (raíz) — las aplica `deploy.sh` antes de construir:
   - `001_playlist_likes.sql` — tabla `playlist_likes`.
   - `002_playlist_position_url.sql` — mismo cambio que (1), como referencia/aplicación manual.
   - `003_play_history_indexes.sql` — índices de `play_history` y `playlist_songs`.
   - `004_cover_map.sql` — tabla `cover_map` (también la crea `TidolCore::new`).
   - `005_track_links_yt_checked.sql` — `track_links.yt_checked_at` (también en `TidolCore::new`).
   No hay tabla de control de versiones: cada fichero debe ser **idempotente**.
3. **`cleanup_legacy_tables.sql`** — manual, una vez, contiene DROPs irreversibles.

Ficheros SQL viejos en `tidol-workspace/` (`schema_discography.sql`, `update_schema.sql`,
`update_indexes.sql`) y `tidol-core/postgresql_migration.sql` son **históricos**; no los
apliques. Ver [13](13-archivos-legado-y-sueltos.md).

### Receta para cambiar el esquema
1. `ALTER` en tu BD de desarrollo.
2. Migración idempotente nueva en `migrations/00N_*.sql` (y/o en `TidolCore::new` si el
   código no puede arrancar sin ella).
3. `cd tidol-workspace && cargo sqlx prepare --workspace` → commitea `.sqlx/`.
4. Actualiza `schema_full.sql`.
5. Si afecta a las pruebas de integración, la BD de prueba clona el esquema de la de
   desarrollo (`scripts/test-db.sh`), así que basta con reiniciarla.

## SQLx en modo offline

- `tidol-workspace/.cargo/config.toml` fija `SQLX_OFFLINE=true`: **compilar no necesita
  una BD viva**. Las macros validan contra `tidol-workspace/.sqlx/*.json` (51 consultas).
- `cargo sqlx prepare` pone `SQLX_OFFLINE=false` en su propio entorno, así que funciona
  igual (las variables de `[env]` no pisan las del entorno).
- El `Dockerfile` del backend también compila con `SQLX_OFFLINE=true`. Si ves
  *"set DATABASE_URL to use query macros online"*, la caché está desincronizada.
- `deploy.sh` hace un `cargo check` offline local antes de subir nada para detectarlo.
- `bad_engine` usa `sqlx` sin macros (no depende de la caché).

## Acceso a la BD de producción

MariaDB solo escucha en `127.0.0.1:3306` del VPS. Para administrarla:
`ssh -L 3306:127.0.0.1:3306 mi-vps` y conéctate a `localhost:3306` con las credenciales
del `.env` del VPS. (Antes estaba publicada en `0.0.0.0:3306`; se cerró en jul-2026.)

## Rarezas a tener en cuenta

- Los ids de pista son **mbids de MusicBrainz** (VARCHAR 36) para el catálogo, pero
  identificadores de Internet Archive u otros (hasta 255) en likes/playlists/`trackMetadata`.
- `get_home_dashboard` une `track_links.artist = artists.name` (**por nombre**, no por mbid).
- El comentario de `cleanup_legacy_tables.sql` habla de una FK de `play_history` a
  `track_links` que el `schema_full.sql` actual no declara.
