# 04 — Backend: `tidol-server` (capa HTTP) y tabla de endpoints

[← Índice](INDICE.md) · Ruta: `tidol-workspace/tidol-server/`

Binario `tidol-server` (Axum 0.7). **Solo transporte**: lee el entorno, construye
`TidolCore`, define rutas y traduce errores. Sin lógica de dominio.

## Ficheros

| Fichero | Qué hace |
|---------|----------|
| `Cargo.toml` | Dependencias: `axum`, `tower_governor` (rate limit), `tower-http` (CORS). En `dev-dependencies` activa `tidol-core/test-util` para testear el middleware sin BD. |
| `src/main.rs` | Parseo de env vars → `CoreConfig`, `TidolCore::new`, rate limiters, rutas públicas/protegidas, CORS, bind en `0.0.0.0:$PORT` (default **3000** en local; 8080 en Docker), lanza `hydrate_unknown_tracks` en background. |
| `src/state.rs` | `AppState { core: Arc<TidolCore> }`. |
| `src/handlers.rs` | ~50 handlers delgados (`state.core.<método>()` + mapeo a status/JSON) y `auth_middleware`. Al final, tests del middleware de extremo a extremo. |
| `src/error.rs` | `ServerError(TidolError)` con `IntoResponse` (newtype por la orphan rule) + tests del mapeo. |

## Variables de entorno que lee `main.rs`

| Variable | Default | Nota |
|----------|---------|------|
| `DATABASE_URL` | — (**obligatoria**, `expect`) | |
| `DATABASE_MAX_CONNECTIONS` | 100 | **por réplica**; el compose pone 50 |
| `PROXY_POOL` | `direct` | lista separada por comas (hoy sin uso real) |
| `PLUGINS_DIR` | `<workspace>/target/debug` | Docker: `/app/plugins` |
| `YOUTUBE_API_KEY`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SOUNDCLOUD_CLIENT_ID` | vacío = proveedor deshabilitado | |
| `JWT_SECRET` | ninguno → **500 en rutas autenticadas** | |
| `PORT` | 3000 | |
| `RUST_LOG` | `tidol_core=info,tidol_server=info,tower_http=warn` | |
| `LASTFM_API_KEY`, `BAD_ENGINE_BIN` | (los lee el core directamente) | |

## Capas globales

- **CORS**: `allow_origin(Any)`, métodos GET/POST/PUT/PATCH/DELETE/OPTIONS, cualquier header.
  (En prod el front es mismo origen, así que el CORS abierto no se necesita.)
- **Rate limit** (`tower_governor`, por IP): register 1/s ráfaga 5; login 1/s ráfaga 2.
  Respuesta 429 JSON `{status:"error", message}`. Ojo: detrás de Caddy la IP vista puede
  ser la del proxy (el servidor usa `ConnectInfo<SocketAddr>`), lo que haría el límite global.
- No hay ruta `/health`: `GET /` devuelve 404 (ver la trampa del healthcheck en [10](10-infraestructura-y-deploy.md#trampas-conocidas)).

## Middleware de autenticación

`handlers::auth_middleware` (aplicado con `route_layer` a las rutas protegidas):
token de `Authorization: Bearer <jwt>` **o** del query `?token=<jwt>` →
`core.authenticate` → inserta `Extension<AuthContext>`. Sin token / inválido → 401;
BD caída o sin `JWT_SECRET` → 500. El handler nunca se ejecuta en esos casos (testeado).

## Mapeo de errores

`ServerError` (`src/error.rs`):

| `TidolError` | Status | Cuerpo |
|--------------|--------|--------|
| `Db` | 500 | **texto plano** `Error DB: {e}` (legado de `create_playlist`) |
| `Provider` | 502 | `{"error": Display}` |
| `StreamUnavailable`, `NotFound` | 404 | `{"error": …}` |
| `Unauthorized` | 401 | `{"error": …}` |
| `Ffi`, `Config` | 500 | `{"error": …}` |

Muchos handlers no usan `ServerError` sino enums de error propios de cada operación
(`LoginError`, `RenameError`, `AddSongError`…) mapeados a mano; su `Display` es el cuerpo.

## Tabla de rutas

Prefijo común `/api/v1`. 🔓 = pública, 🔒 = requiere JWT.

### Auth
| Método | Ruta | | Handler → core | Notas |
|--------|------|-|----------------|-------|
| POST | `/auth/register` | 🔓 | `register` | rate limit; body `{username,password,device_name,device_type}` |
| POST | `/auth/login` | 🔓 | `login` | rate limit; mismo body |
| GET | `/auth/me` | 🔒 | `me` | **sin token debe dar 401** (prueba de vida del deploy) |
| DELETE | `/auth/me` | 🔒 | `delete_account` | irreversible |
| POST | `/auth/logout` | 🔒 | `logout` | borra el device actual |

### Catálogo (MusicBrainz) y embeds
| Método | Ruta | | Core | Notas |
|--------|------|-|------|-------|
| GET | `/search/:query?limit=&offset=` | 🔒 | `search_catalog` | `limit` acotado a 1..50; consulta vacía → `{status:error}` con 200 |
| POST | `/search/click` | 🔒 | `register_click` | analítica |
| GET | `/artists/:mbid` | 🔒 | `get_artist_details` | |
| GET | `/artists/:mbid/discography` | 🔒 | `get_artist_discography` | 502 si falla (con 200 el front pintaba vacío) |
| GET | `/albums/:mbid` | 🔒 | `get_album_details` | |
| POST | `/albums/:mbid/report-cover-404` | 🔒 | `report_cover_404` | marca `albums.cover_status` |
| GET | `/radio?artist=&title=&limit=` | 🔒 | `get_similar_tracks` | Last.fm |
| GET | `/embed/search?q=&limit=` | 🔓 | `embed_search` | **consume cuota de YouTube**; pública y sin rate limit |
| GET | `/embed/resolve/:platform_id` | 🔓 | `resolve_embed` | id `plataforma:id` (p.ej. `youtube:dQw4w9WgXcQ`) |

### Letras, media y portadas
| Método | Ruta | | Core | Notas |
|--------|------|-|------|-------|
| GET | `/lyrics/:track_id` | 🔓 | `get_lyrics` | LRCLIB + caché en `track_links` |
| GET | `/covers/:mbid?fallback=` | 🔓 | `get_cover` | devuelve **JPEG**; 400 id inválido; 404 sin default |
| GET | `/images/optimize?path=&w=&q=` | 🔒 | `optimize_image` | solo `uploads/…`; `q` se ignora |
| POST | `/colors/extract` | 🔒 | `extract_colors` | sin consumidores en el front |

### Actividad / Home
| Método | Ruta | | Core |
|--------|------|-|------|
| GET | `/home` | 🔒 | `get_home_dashboard` |
| GET | `/tracks/listen-again` | 🔒 | `get_listen_again` (dispara prefetch de `bad_engine`) |
| POST | `/tracks/:mbid/log-play` | 🔒 | `log_play` |
| GET | `/history` | 🔒 | `get_history` |
| POST | `/history/add` | 🔒 | **no-op deprecado** (se conserva por compatibilidad) |

### Playlists
| Método | Ruta | | Core |
|--------|------|-|------|
| GET / POST | `/playlists` | 🔒 | `get_playlists` / `create_playlist` |
| GET / PATCH / DELETE | `/playlists/:id` | 🔒 | `get_playlist` / `rename_playlist` / `delete_playlist` |
| GET / POST | `/playlists/:id/songs` | 🔒 | `get_playlist_songs` / `add_song_to_playlist` |
| PUT | `/playlists/:id/songs/order` | 🔒 | `reorder_playlist_songs` |
| DELETE | `/playlists/:id/songs/:song_id` | 🔒 | `remove_song_from_playlist` |
| POST | `/playlists/:id/like` | 🔒 | `toggle_playlist_like` |

### Likes
| Método | Ruta | | Core |
|--------|------|-|------|
| GET | `/music/songs/likes` | 🔒 | `get_local_likes` (solo ids) |
| GET | `/music/ia/likes` | 🔒 | `get_ia_likes` (solo ids) |
| GET | `/music/likes/detailed?source=local\|archive` | 🔒 | `get_likes_detailed` |
| POST / DELETE | `/music/songs/:id/like` | 🔒 | `set_local_like` / `unset_local_like` |
| POST | `/music/ia/likes/toggle` | 🔒 | `toggle_ia_like` |

### "Biblioteca" (tablas locales)
| Método | Ruta | | Core |
|--------|------|-|------|
| GET | `/albumes` y `/music/albums` | 🔒 | `get_albums` (dos rutas, mismo handler) |
| GET | `/music/albums/:id` · `/music/albums/:id/songs` | 🔒 | `get_album_by_id` · `get_album_songs` |
| GET | `/music/artists/resolve?q=\|name=` | 🔒 | `resolve_artist` |
| GET | `/music/artists/:id` · `/music/artists/:id/songs` | 🔒 | `get_artist_by_id` · `get_artist_songs` |
| GET | `/music/home-recommendations` | 🔒 | **MOCK** (stub) |
| GET | `/music/ia/discoveries` | 🔒 | **MOCK** (stub) |

### Endpoints que el front llama y **no existen**
`/search/suggestions`, `/music/getCover/:identifier`, `/uploads/musica`, `/api/vox/*`,
`/stems/*`, `/spectra/*`. Ver [12](12-pendientes-y-deuda-tecnica.md).

## Cómo añadir un endpoint

1. Método de dominio en el módulo adecuado de `tidol-core/src/` (devuelve un error
   tipado propio o `TidolError`); re-exporta los tipos nuevos en `lib.rs` si hacen falta.
2. Handler delgado en `tidol-server/src/handlers.rs`.
3. Ruta en `main.rs` dentro de `public_routes` o `protected_routes`.
4. Si usas `sqlx::query!`, regenera `.sqlx/` ([05](05-base-de-datos.md)).
5. Si es un método HTTP nuevo, revisa la lista de métodos del CORS.
