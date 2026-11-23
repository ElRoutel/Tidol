# Guía telefónica de Tidol — índice para agentes IA

> **Empieza aquí.** Este directorio explica el estado, la arquitectura y la deuda
> técnica de Tidol para agentes IA (y humanos) que llegan sin contexto.
> Cada entrada te dice **a qué documento ir** según el tema; cada documento te
> dice **a qué ficheros del código ir**.
>
> Última revisión completa: **2026-11-22** (commit `5c593f57`, rama `main`).
> Si el código ha cambiado mucho desde entonces, verifica antes de fiarte.

Rutas: todas las rutas son relativas a la raíz del repo git
(`/home/routel/TidolCore`). El workspace de Cargo y el frontend viven en
`tidol-workspace/`; la infraestructura (compose, Caddy, deploy, SQL) vive en la raíz.

---

## Documentos de este directorio

| # | Documento | Léelo cuando… |
|---|-----------|---------------|
| 00 | [00-estado-del-proyecto.md](00-estado-del-proyecto.md) | Quieras el resumen ejecutivo: qué es Tidol, qué funciona hoy en producción y qué no |
| 01 | [01-arquitectura-general.md](01-arquitectura-general.md) | Necesites el mapa completo: piezas, flujo de una petición, por qué está dividido así |
| 02 | [02-reglas-y-convenciones.md](02-reglas-y-convenciones.md) | **Antes de cambiar nada.** Reglas legales absolutas, estilo, contratos que no se pueden romper |
| 03 | [03-backend-tidol-core.md](03-backend-tidol-core.md) | Toques lógica de dominio en Rust (`tidol-core`): fichero por fichero |
| 04 | [04-backend-tidol-server-api.md](04-backend-tidol-server-api.md) | Toques rutas HTTP, el middleware de auth, el mapeo de errores, o necesites la tabla de endpoints |
| 05 | [05-base-de-datos.md](05-base-de-datos.md) | Toques SQL, el esquema, migraciones o la caché offline de SQLx |
| 06 | [06-proveedores-plugins-y-workers.md](06-proveedores-plugins-y-workers.md) | Toques YouTube/Spotify/SoundCloud/Internet Archive, los plugins `.so`, `bad_engine` o `provider-ai` |
| 07 | [07-frontend.md](07-frontend.md) | Toques la SPA React: estructura, contextos, páginas, componentes vivos y muertos |
| 08 | [08-flujos-reproduccion-portadas-letras.md](08-flujos-reproduccion-portadas-letras.md) | Toques el reproductor, las portadas o las letras (cruzan back y front) |
| 09 | [09-tidol-shell.md](09-tidol-shell.md) | Toques el REPL de administración `tidol-shell` |
| 10 | [10-infraestructura-y-deploy.md](10-infraestructura-y-deploy.md) | Toques Docker, Compose, Caddy, el VPS o `deploy.sh` |
| 11 | [11-desarrollo-local-y-pruebas.md](11-desarrollo-local-y-pruebas.md) | Necesites compilar, correr o probar en local |
| 12 | [12-pendientes-y-deuda-tecnica.md](12-pendientes-y-deuda-tecnica.md) | Busques qué mejorar, qué está roto o a medias, y la prioridad de cada cosa |
| 13 | [13-archivos-legado-y-sueltos.md](13-archivos-legado-y-sueltos.md) | Te encuentres un fichero raro (scripts `.py`, SQL sueltos, `tidol-tv-lite*`…) y quieras saber si importa |

---

## Diccionario por tema (tema → documento → código)

### A
- **Álbumes (detalle, tracks)** → [03](03-backend-tidol-core.md#orchestratorrs) · `tidol-workspace/tidol-core/src/orchestrator.rs` (`get_album_details`) · front `pages/AlbumPage.jsx`, `utils/albumTracks.js`
- **Álbumes de la "biblioteca" BD (`/music/albums`)** → [03](03-backend-tidol-core.md#libraryrs) · `tidol-core/src/library.rs`
- **AmLyricsView / letras estilo Apple Music** → [08](08-flujos-reproduccion-portadas-letras.md#3-letras) · `tidol-frontend/src/components/AmLyricsView.jsx`
- **API: lista de endpoints** → [04](04-backend-tidol-server-api.md#tabla-de-rutas)
- **Argon2 / contraseñas** → [03](03-backend-tidol-core.md#authrs) · `tidol-core/src/auth.rs`
- **Artistas (perfil, discografía, caché "envenenada")** → [03](03-backend-tidol-core.md#orchestratorrs) · `orchestrator.rs` (`get_artist_discography`, `mb_get_json`)
- **Auth (JWT + devices)** → [03](03-backend-tidol-core.md#authrs), [04](04-backend-tidol-server-api.md#middleware-de-autenticación) · front `context/AuthContext.tsx`, `api/axiosConfig.js`
- **axios / cliente HTTP del front** → [07](07-frontend.md#api) · `tidol-frontend/src/api/axiosConfig.js`

### B
- **bad_engine (worker de letras)** → [06](06-proveedores-plugins-y-workers.md#bad_engine) · `tidol-workspace/bad_engine/`
- **Background playback (PWA, pestaña oculta)** → [08](08-flujos-reproduccion-portadas-letras.md#reproducción-en-segundo-plano) · `engine/backgroundKeepAlive.ts`, `context/PlayerContext.tsx`
- **Borrado de cuenta** → [03](03-backend-tidol-core.md#authrs) · `auth.rs::delete_account`, front `pages/ProfilePage.jsx`
- **Build del backend sin BD (SQLx offline)** → [05](05-base-de-datos.md#sqlx-en-modo-offline), [10](10-infraestructura-y-deploy.md)

### C
- **Caddy / TLS / reverse proxy** → [10](10-infraestructura-y-deploy.md#caddy) · `Caddyfile.prod`, `Caddyfile`, `Dockerfile.caddy`
- **Colores de portada (extracción)** → [08](08-flujos-reproduccion-portadas-letras.md#colores) · front `utils/extractColors.ts`; back `media.rs::extract_colors` (sin uso desde el front)
- **Compose / servicios Docker** → [10](10-infraestructura-y-deploy.md#compose) · `compose.yaml`
- **Context menu / long-press** → [07](07-frontend.md#menú-contextual) · `context/ContextMenuContext.tsx`, `hooks/useLongPress.ts`, `hooks/useContextMenuTrigger.ts`, `components/ContextMenu.jsx`
- **CORS** → [04](04-backend-tidol-server-api.md#capas-globales) · `tidol-server/src/main.rs`
- **Covers / portadas** → [08](08-flujos-reproduccion-portadas-letras.md#2-portadas) · back `media.rs::get_cover`; front `utils/coverArt.ts`

### D
- **Deploy** → [10](10-infraestructura-y-deploy.md#deploysh) · `deploy.sh`
- **Deuda técnica / TODO** → [12](12-pendientes-y-deuda-tecnica.md)
- **Devices (sesiones por dispositivo)** → [03](03-backend-tidol-core.md#authrs), [05](05-base-de-datos.md)
- **Docs legales (ToS, privacidad, DMCA)** → `tidol-workspace/docs/` · [13](13-archivos-legado-y-sueltos.md)

### E
- **Embeds (YouTube/Spotify/SoundCloud/IA)** → [06](06-proveedores-plugins-y-workers.md#proveedores-de-embed-en-proceso) · `tidol-core/src/providers/`
- **embedResolver (pista → videoId de YouTube)** → [08](08-flujos-reproduccion-portadas-letras.md#1-reproducción) · `tidol-frontend/src/engine/embedResolver.ts`
- **Errores (TidolError → HTTP)** → [03](03-backend-tidol-core.md#errorrs), [04](04-backend-tidol-server-api.md#mapeo-de-errores) · `tidol-core/src/error.rs`, `tidol-server/src/error.rs`
- **.env / variables de entorno** → [10](10-infraestructura-y-deploy.md#variables-de-entorno), [11](11-desarrollo-local-y-pruebas.md)

### F
- **FFI / plugins dinámicos `.so`** → [06](06-proveedores-plugins-y-workers.md#plugins-ffi-so) · `tidol-core/src/lyrics.rs`, `plugins/`
- **FullScreenPlayer** → [07](07-frontend.md#reproductor-ui), [08](08-flujos-reproduccion-portadas-letras.md) · `components/FullScreenPlayer.jsx`

### H
- **Healthcheck que miente** → [10](10-infraestructura-y-deploy.md#trampas-conocidas)
- **Historial de reproducción (`play_history`)** → [05](05-base-de-datos.md), [03](03-backend-tidol-core.md#catalogrs) · `catalog.rs::log_play`, `user_data.rs::get_history`
- **Home (dashboard, "Volver a escuchar")** → [03](03-backend-tidol-core.md#orchestratorrs) · `orchestrator.rs::get_home_dashboard`, `get_listen_again`; front `hooks/useHome.js`, `components/home/views/HomeAllView.jsx`
- **hydrate_unknown_tracks ("Ghost Cleaner")** → [03](03-backend-tidol-core.md#librs)

### I
- **Imágenes (optimización `/images/optimize`)** → [03](03-backend-tidol-core.md#mediars) · `media.rs::optimize_image`; front `utils/imageUtils.js`
- **Internet Archive** → [06](06-proveedores-plugins-y-workers.md) · `providers/archive.rs`; front `pages/InternetArchivePage.jsx`, `components/embeds/ArchiveAudio.tsx`
- **iTunes (bloqueado desde el VPS)** → [08](08-flujos-reproduccion-portadas-letras.md#2-portadas), [12](12-pendientes-y-deuda-tecnica.md)

### L
- **Legalidad (embed-only, nada de yt-dlp)** → [02](02-reglas-y-convenciones.md#1-reglas-legales-absolutas)
- **Letras (LRCLIB)** → [08](08-flujos-reproduccion-portadas-letras.md#3-letras) · `catalog.rs::get_lyrics`, `parse_lrc`
- **Likes (canciones, IA, playlists)** → [03](03-backend-tidol-core.md#user_datars) · `user_data.rs`; front `components/LikeButton.jsx`, `PlayerContext.tsx`
- **Library (página Biblioteca)** → [07](07-frontend.md) · `pages/LibraryPage.jsx`, `hooks/useLibrary.js`

### M
- **MariaDB** → [05](05-base-de-datos.md), [10](10-infraestructura-y-deploy.md)
- **MediaSession (lockscreen)** → [08](08-flujos-reproduccion-portadas-letras.md#reproducción-en-segundo-plano) · `PlayerContext.tsx`
- **Migraciones** → [05](05-base-de-datos.md#migraciones) · `TidolCore::new` en `tidol-core/src/lib.rs`, `migrations/`
- **MusicBrainz (búsqueda, metadatos, rate-limit 1 req/s)** → [03](03-backend-tidol-core.md#orchestratorrs) · `orchestrator.rs`

### P
- **PlayerContext (estado global del reproductor)** → [07](07-frontend.md#contextos), [08](08-flujos-reproduccion-portadas-letras.md) · `context/PlayerContext.tsx`
- **Playlists** → [03](03-backend-tidol-core.md#user_datars) · `user_data.rs`; front `context/PlaylistContext.tsx`, `pages/PlaylistPage.jsx`
- **Pool de conexiones × réplicas** → [10](10-infraestructura-y-deploy.md#trampas-conocidas)
- **Prefetch de `bad_engine`** → [06](06-proveedores-plugins-y-workers.md#bad_engine) · `orchestrator.rs::trigger_bad_engine_prefetch`
- **Proxy pool (salida)** → [03](03-backend-tidol-core.md#proxyrs) · `tidol-core/src/proxy.rs`
- **PWA / service worker** → [07](07-frontend.md#build-y-pwa) · `tidol-frontend/vite.config.ts`

### R
- **Radio (Last.fm similar tracks)** → [03](03-backend-tidol-core.md#orchestratorrs) · `orchestrator.rs::get_similar_tracks`; front `PlayerContext.tsx` (`/radio`)
- **Rate limiting (login/register)** → [04](04-backend-tidol-server-api.md#capas-globales)
- **Redis (en compose, sin uso)** → [10](10-infraestructura-y-deploy.md#compose), [12](12-pendientes-y-deuda-tecnica.md)
- **REPL de admin** → [09](09-tidol-shell.md)

### S
- **Búsqueda (catálogo MusicBrainz)** → [03](03-backend-tidol-core.md#orchestratorrs) · `orchestrator.rs::search_catalog`; front `hooks/useSearch.ts`, `pages/SearchPage.tsx`
- **Secretos commiteados** → [12](12-pendientes-y-deuda-tecnica.md#p0--seguridad)
- **SQLx (`query!`, `.sqlx/`)** → [05](05-base-de-datos.md#sqlx-en-modo-offline)
- **Spotify / SoundCloud (desactivados sin credenciales)** → [06](06-proveedores-plugins-y-workers.md)

### T
- **Tests (unitarios, integración con BD, del middleware)** → [11](11-desarrollo-local-y-pruebas.md#pruebas)
- **tidol-tv-lite / tidol-tv-lite-backup** → [13](13-archivos-legado-y-sueltos.md#frontends-de-tv)
- **TidolAudioEngine (audio nativo + crossfade)** → [08](08-flujos-reproduccion-portadas-letras.md) · `engine/TidolAudioEngine.ts`

### U
- **UnifiedTrack (contrato de pista del front)** → [07](07-frontend.md#tipos-y-utilidades) · `types/music.ts`, `utils/trackNormalization.ts`
- **Upload de música (roto: endpoint inexistente)** → [12](12-pendientes-y-deuda-tecnica.md) · `pages/UploadPage.jsx`

### V
- **VOX / stems / Spectra (servicios inexistentes)** → [12](12-pendientes-y-deuda-tecnica.md), [07](07-frontend.md) · `hooks/useVoxAudio.ts`, `hooks/useLazyCaching.ts`
- **VPS (discos, containerd, SSH)** → [10](10-infraestructura-y-deploy.md#el-vps)

### Y
- **YouTube (motor principal de reproducción, cuota 10k/día)** → [06](06-proveedores-plugins-y-workers.md), [08](08-flujos-reproduccion-portadas-letras.md) · `providers/youtube.rs`, `components/embeds/YouTubeEmbed.tsx`

---

## Cómo mantener este directorio

1. Si cambias la arquitectura o resuelves un pendiente, **actualiza el documento
   afectado y, si añades un tema, añade su línea a este índice**.
2. Tacha (o borra) los pendientes resueltos en [12](12-pendientes-y-deuda-tecnica.md)
   en vez de dejarlos desfasados.
3. Cambia la fecha de "Última revisión" de arriba cuando hagas una revisión completa.
4. No copies aquí secretos, contraseñas ni tokens, ni siquiera para señalar dónde están
   filtrados: nombra el fichero y la variable, nunca el valor.
