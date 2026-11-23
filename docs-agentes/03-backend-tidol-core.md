# 03 — Backend: `tidol-core` (librería de dominio)

[← Índice](INDICE.md) · Ruta: `tidol-workspace/tidol-core/`

`tidol-core` es una **lib sin `axum`**: SQL (sqlx/MariaDB), HTTP saliente (reqwest),
orquestación de metadatos, proveedores de embed, JWT/argon2, imágenes. La consumen
`tidol-server` (HTTP) y `tidol-shell` (REPL). Versión de crate `0.2.0`, edition 2021.

## `Cargo.toml`

- Features:
  - `local-library` — **placeholder vacío** para una futura biblioteca local (la reenvía `tidol-shell`).
  - `test-util` — expone `TidolCore::new_disconnected` a otros crates (tests del middleware en `tidol-server`).
  - `db-tests` — activa `tests/db_integration.rs` (necesita BD de prueba, ver [11](11-desarrollo-local-y-pruebas.md)).
- Dependencias clave: `sqlx 0.7` (mysql, macros), `reqwest 0.11` (socks), `musicbrainz_rs 0.13`,
  `jsonwebtoken 9`, `argon2 0.5`, `image` + `color-thief`, `moka` (cachés con TTL),
  `libloading` (plugins `.so`), `tracing`.
- Otros ficheros del crate: `Dockerfile` (la imagen de **producción del backend**, ver [10](10-infraestructura-y-deploy.md)),
  `.dockerignore`, `.gitignore`, `postgresql_migration.sql` (esquema para un **posible paso a
  PostgreSQL que nunca se hizo**; no se usa), `scratch/*.py` (scripts de un refactor antiguo, ver [13](13-archivos-legado-y-sueltos.md)).

---

## Ficheros de `src/`

### `lib.rs`
**Qué hace:** declara módulos, re-exporta los tipos que usa el binario, y define
`pub struct TidolCore { db, rotator, lyrics_provider, orchestrator, embed_orchestrator, config }`.

- `TidolCore::new(config)`:
  1. Abre el pool MySQL (`database_max_connections`).
  2. **Migraciones idempotentes de arranque**: `CREATE TABLE IF NOT EXISTS track_links`
     (versión reducida), `ALTER TABLE playlist_songs ADD COLUMN IF NOT EXISTS position, url`
     y backfill de `position` con `ROW_NUMBER()`.
  3. Crea el `ProxyRotator`.
  4. Intenta cargar `{PLUGINS_DIR}/libprovider_lyrics.so` (si falla, `warn` y sigue).
  5. Monta los proveedores de embed según haya credenciales: YouTube (`YOUTUBE_API_KEY`),
     Spotify (`SPOTIFY_CLIENT_ID/SECRET`), SoundCloud (`SOUNDCLOUD_CLIENT_ID`) e
     Internet Archive (siempre).
- `new_disconnected` (`cfg(test | test-util)`): pool perezoso contra un puerto cerrado
  (`acquire_timeout` 500 ms) para probar caminos con "BD caída" **sin mocks**.
- `hydrate_unknown_tracks` ("Ghost Cleaner"): tarea de fondo lanzada por `main.rs` al
  arrancar; re-resuelve filas de `track_links` con título `Unknown` vía MusicBrainz, con
  1,5 s entre pistas. **Ojo:** con N réplicas se ejecuta N veces en paralelo.

**Por qué existe así:** el split core/server (commit `12dcf980`) movió aquí lo que antes
vivía en un `main.rs` monolítico de miles de líneas.

### `config.rs`
`CoreConfig`: valores ya resueltos (el parseo de env vive en el binario). Campos:
`database_url`, `database_max_connections`, `proxy_pool`, `plugins_dir`,
`youtube_api_key`, `spotify_client_id/secret`, `soundcloud_client_id`,
`jwt_secret: Option<String>` (si es `None` el servidor arranca igual pero toda ruta
autenticada da 500 — comportamiento preservado a propósito). El comentario dice
"default del binario: 100" para el pool; en producción el compose fija 50.

### `error.rs`
`TidolError` (`Db`, `Provider`, `StreamUnavailable`, `Unauthorized`, `NotFound`, `Ffi`,
`Config`). **No** implementa `IntoResponse` (lo hace `ServerError` en el server). Tests
fijan los textos `Display` porque son el campo `"error"` del JSON. `StreamUnavailable` y
`Ffi` son restos de la era de streaming; hoy casi no se producen.

### `models.rs`
DTOs serializados en **camelCase** vía `#[serde(rename)]` (`trackId`, `coverUrl`…),
que es lo que lee el front: `SearchResponse`, `TrackResponse`, `ArtistSearchResponse`,
`PaginationMeta`, `AlbumResponse`, `ArtistResponse`, `TrackMetadataResponse`,
`ArtistProfileResponse`, `AlbumTrackResponse`, `AlbumDetailsResponse`,
`HomeArtistResponse`, `HomeDashboardDTO`.
**Sin uso (legado):** `WorkerEvent` (progreso de workers de descarga), `CanonicalHit`,
`LocalSearchSection`, `LocalTrack`.

### `auth.rs`
Bloque `impl TidolCore` de autenticación.

- `Claims { sub: user_id, device_id, exp, iat }`; tokens válidos **7 días**, HS256 por
  defecto de `jsonwebtoken`.
- `authenticate(token)`: decodifica y **verifica que `devices(id, user_id)` existe**.
  Errores: `Unauthorized` (401) o `Internal` (500: sin `JWT_SECRET` o BD caída).
- `register` / `login`: validan entrada antes de tocar BD (400 con textos fijos),
  argon2 por defecto, crean un **device nuevo por login** (UUID) y devuelven el token.
- `me`, `logout` (borra el device actual), `delete_account` (borra `play_history` a mano
  porque no tiene FK a `users`; el resto cae por `ON DELETE CASCADE`).
- Tests: token malformado/expirado/firma inválida, sin secreto → Internal, roundtrip
  de claims, parámetros de argon2.

**Notas:** cada login crea un device y nunca se limpian los viejos (crecen sin límite).

### `catalog.rs`
Fachada del catálogo + utilidades puras.

- `normalize_query` (minúsculas, NFD sin acentos, solo alfanumérico) — pública, la usa el server.
- `parse_lrc` (LRC → `[{start_cs, word}]`, con el fix décimas×10 / milésimas÷10).
- *Forwarders* a `MetadataOrchestrator`: `search_catalog`, `get_artist_details`,
  `get_artist_discography`, `get_album_details`, `get_similar_tracks`,
  `get_home_dashboard`, `get_listen_again`.
- *Forwarders* a `ProviderOrchestrator`: `embed_search`, `resolve_embed`.
- `report_cover_404(mbid)` → `UPDATE albums SET cover_status='not_found'`.
- `register_click` → upsert en `trackMetadata` + contador en `searchClicks` (analítica).
- `log_play(mbid, user, payload)` → upsert en `track_links` (sin pisar datos buenos) e
  `INSERT INTO play_history`. Si el título llega `Unknown`, intenta `resolve_full_track`.
- `get_lyrics(track_id)`: lee `track_links.lyrics_status`:
  `whisper_synced` / `lrclib_synced` / `plain_only` → devuelve lo cacheado;
  `not_found` → 404 cacheado; si no, consulta **LRCLIB** (timeout 8 s), guarda y devuelve.
  Solo cachea negativo si LRCLIB respondió bien sin letra. `LyricsError`: `Db`→500, resto→404.

### `orchestrator.rs`
El fichero más grande (~1 270 líneas).
`MetadataOrchestrator` con un `reqwest::Client` con timeout obligatorio.

- `search_catalog`: un 503 de MB tras los reintentos ahora es **error** (antes se leía como
  0 resultados y el usuario veía "sin resultados"); el handler sigue respondiendo `{status:"error"}`.
  El `coverUrl` de cada resultado lleva una **pista de portada firmada** (`media::cover_url_for_search`:
  sus releases ya vienen en la respuesta; ver [08](08-flujos-reproduccion-portadas-letras.md#2-portadas)).
- `search_catalog`: llama **directo a la API JSON de MusicBrainz** (no a `musicbrainz_rs`,
  cuya cola global de 1 req/s hacía que la búsqueda tardara minutos). Filtra grabaciones
  no canónicas (`BAD_DISAMBIG`: megamix, karaoke…) y vídeos. Portadas: cada pista apunta
  a `/api/v1/covers/:mbid` (lazy). Hasta 3 artistas con portada de iTunes en paralelo.
- `get_artist_details`, `get_artist_discography`: cachean artista + álbumes en BD
  (`artists.status = full_discography_synced`). Detectan **caché envenenada** (fila
  sincronizada sin nombre o sin álbumes, residuo de un 503 de MB) y re-sincronizan.
  `mb_get_json` valida status y reintenta ante rate-limit.
- `get_album_details`: tracks del release desde MusicBrainz.
- `fetch_wikipedia_bio`, `fetch_apple_music_cover` (iTunes `entity=song`, comparando
  artista y título), `fetch_apple_artwork` (envoltorio; devuelve `""` al fallar).
- `resolve_full_track(mbid)`: `track_links` local o MusicBrainz; auto-repara portadas
  inválidas (vacías, placeholders muertos). Devuelve `TrackProfile`.
- `get_similar_tracks`: **Last.fm** `track.getsimilar` (clave `LASTFM_API_KEY` con un
  **literal hardcodeado como fallback**). Resultado cacheado en memoria (`moka`, 6 h, solo
  si no está vacío) porque la Home lo pide en cada carga. Usa el `mbid` que trae Last.fm
  cuando existe (si no resuelve, busca en MB) y limita los lookups a 4 simultáneos
  (`buffered`, conserva el orden) para no provocar 503 de MusicBrainz.
- `get_listen_again` (más reproducidas) y `get_home_dashboard` (recientes, top
  artistas — join por **nombre** de artista, frágil —, recomendaciones vía similares).
- `trigger_bad_engine_prefetch`: dedupe en memoria (`PREFETCH_INFLIGHT`) y lanza el
  binario `bad_engine` (`BAD_ENGINE_BIN` o `target/release/bad_engine`) para las 3
  primeras pistas de "Volver a escuchar". Tiene un **path absoluto de la máquina del
  dev** como fallback de `current_dir`. La ubicación del binario se resuelve **una vez por
  proceso** (`bad_engine_location`); en Docker no existe y el prefetch sale sin tocar la BD.
- **Código muerto:** `get_radio_tracks` (consulta columnas legado `provisional_audio_path`
  / `premium_audio_path`), `search_tracks_m3u`, `get_album_tracks_m3u`, tipos
  `ItunesSearchResponse`/`ItunesTrack`. Nadie los llama.

### `library.rs`
"Biblioteca" sobre las tablas `albums` / `artists` / `track_links` / `trackMetadata`:
`get_albums` (50 más recientes), `get_album_by_id`, `get_album_songs`,
`resolve_artist` (por `q`/`name`), `get_artist_by_id`, `get_artist_songs`. Si
`cover_status = not_found` devuelve `/default-album.png`. Tipo `SearchQuery`.

### `media.rs`
- `optimize_image(path, w)`: redimensiona y re-codifica a JPEG. **Anti path-traversal**:
  solo rutas bajo `uploads/`. Errores `InvalidPath`→400, `NotFound`→404, `Encode`→500.
  (El front lo usa vía `utils/imageUtils.js`, aunque ya casi no hay ficheros en `uploads/`.)
- `extract_colors(payload)`: `color-thief` sobre una imagen local; ante cualquier fallo
  devuelve colores por defecto con `success: true`. **El front ya no lo llama** (extrae en cliente).
- `get_cover(mbid, fallback)`: ver el flujo completo en [08](08-flujos-reproduccion-portadas-letras.md#2-portadas).
  Valida el id (anti path-traversal), caché en disco `covers/<mbid>.jpg` (relativa al
  CWD; en Docker `/app/covers`, volumen `tidol-covers`), caché negativa en memoria 30 min
  (`COVER_MISSES`), cascada CAA → MusicBrainz (puntuando releases) → iTunes → `fallback`.
  Con pista firmada (`?c=&s=`, HMAC con `JWT_SECRET`) se saltan el paso 1 y el lookup a MB. La
  puntuación de releases vive en `cover_candidates` (función pura con test). Si MB respondió 503
  no se cachea el miss. Los respaldos (iTunes/`fallback`) salen como `CoverOutcome::Fallback`.
  Las dos variantes CAA del paso 1 van en paralelo y los candidatos del paso 2 se piden con
  concurrencia 4 en orden de puntuación (gana el mismo que antes, pero sin 12 peticiones en serie).

### `user_data.rs`
Playlists, historial y likes (todo filtrado por `user_id`).

- Playlists: `get_playlists` (enriquecido: dueño, nº canciones, duración, likes, portada
  de la 1ª canción), `create_playlist`, `delete_playlist`, `get_playlist` (una ajena =
  inexistente → 404), `toggle_playlist_like`, `rename_playlist`, `get_playlist_songs`
  (emite claves canónicas `trackName/artistName/coverArtUrl` **y** legacy
  `titulo/artista/portada`), `add_song_to_playlist` (duplicado → aviso; posición
  `MAX+1`; guarda `url` directa si es Internet Archive), `reorder_playlist_songs`
  (transacción), `remove_song_from_playlist`.
- Historial: `get_history` desde `play_history` (fuente única).
- Likes: `get_likes_detailed` (metadata de `track_links` o `trackMetadata`),
  `get_local_likes`, `get_ia_likes`, `set_local_like` / `unset_local_like`
  (idempotentes, `INSERT IGNORE`), `toggle_ia_like` (persiste la metadata que manda el cliente).
- `json_id_to_string`: acepta ids string o número (el front manda ambos).

### `lyrics.rs`
`DynamicLyricsProvider`: carga un `.so` con `libloading` y resuelve los símbolos C
`get_provider_name`, `fetch_lyrics`, `free_plugin_string`. **Se carga en `new()` pero
ningún camino lo invoca** (campo marcado `#[allow(dead_code)]`); `get_lyrics` va directo a LRCLIB.

### `net.rs`
- `shared_client()`: **un único `reqwest::Client`** (UA `TidolMusic/0.2`, timeout 8 s,
  connect 4 s) para `get_lyrics`, `get_cover` y `extract_colors`. Antes cada petición
  construía su cliente y pagaba DNS+TLS desde cero.
- **Cortacircuitos de iTunes** (`itunes_available` / `itunes_report_failure`): tras un
  fallo de transporte o un 403/429/5xx, iTunes se omite 10 min. `ITUNES_ENABLED=false`
  lo desactiva del todo. Motivo: desde el VPS está bloqueado y cada intento costaba el
  timeout completo en Home, búsqueda y portadas.
- **Limitador común de MusicBrainz** (`mb_acquire` / `mb_get`): cubo de fichas por proceso
  (1 req/s, ráfaga 3) con dos prioridades. `Background` (portadas, similares, hidratación) solo
  gasta ficha si quedan ≥ 2, así `Interactive` (búsqueda, artista, álbum) nunca espera detrás de
  una ráfaga de portadas. `mb_get` reintenta 2 veces ante 503/429. Todas las llamadas a MB del
  core pasan por aquí, también las de `musicbrainz_rs` (se llama a `mb_acquire` antes). **Por
  réplica**: con N réplicas el total es N req/s.

### `proxy.rs`
`ProxyRotator`: round-robin sobre `PROXY_POOL` (`"direct"` por defecto) y
`build_proxied_client`. **Tampoco se usa** hoy (`#[allow(dead_code)]` en el campo);
`ProxyClientGuard` es un stub con un `Drop` vacío "para métricas futuras".

### `providers/`
Proveedores de embed (trait `MusicProvider`) — ver [06](06-proveedores-plugins-y-workers.md#proveedores-de-embed-en-proceso).
`mod.rs`, `provider_trait.rs`, `waterfall.rs` (`ProviderOrchestrator`), `youtube.rs`,
`spotify.rs`, `soundcloud.rs`, `archive.rs`.

## `tests/db_integration.rs`
Suite de integración (~640 líneas) contra una BD **dedicada de prueba**; solo compila con
`--features db-tests` y exige que la URL contenga `test`. Cubre playlists CRUD, reorder,
likes, historial y auth. Cada test crea su propio usuario (paralelizable). Ver [11](11-desarrollo-local-y-pruebas.md).
