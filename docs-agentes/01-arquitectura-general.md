# 01 — Arquitectura general

[← Índice](INDICE.md)

## Mapa de piezas

```
                         Internet
                            │  :80 / :443 (h1, h2, h3)
                    ┌───────▼────────┐
                    │  Caddy (TLS)   │  Caddyfile.prod
                    └──┬──────────┬──┘
           /api/*      │          │   resto
       (least_conn)    │          │
   ┌───────────────────▼──┐   ┌───▼─────────────────┐
   │ tidol-server  ×N     │   │ tidol-frontend      │
   │ (Axum, :8080)        │   │ Nginx + SPA React   │
   │  └─ tidol-core (lib) │   └─────────────────────┘
   └──┬────────┬──────────┘            ▲
      │        │                       │ el navegador ejecuta la SPA, que:
      │        │                       │  · llama a /api/v1/* (mismo origen)
      │        │                       │  · monta el IFrame oficial de YouTube
      │        │                       │  · reproduce audio de archive.org con <audio>
      │        │                       │  · pide letras a LRCLIB (web component am-lyrics)
 ┌────▼───┐ ┌──▼────┐
 │MariaDB │ │ Redis │ (Redis: levantado, SIN USO)
 └────────┘ └───────┘
      APIs externas que llama el backend:
      MusicBrainz · Cover Art Archive · iTunes Search · Wikipedia · Last.fm ·
      LRCLIB · YouTube Data API v3 · Spotify Web API · SoundCloud API · archive.org
```

Todo corre con Docker Compose en un solo VPS (`compose.yaml` en la raíz). Ver [10](10-infraestructura-y-deploy.md).

## Estructura del repositorio

```
TidolCore/                     ← raíz del repo git
├── compose.yaml               producción: mariadb, redis, tidol-core(×N), tidol-frontend, caddy
├── Caddyfile.prod             reverse proxy de producción
├── Caddyfile, Dockerfile.caddy  Caddy de desarrollo (LAN + DuckDNS DNS-challenge)
├── deploy.sh                  despliegue al VPS (rsync + build remoto + verificación)
├── schema_full.sql            esquema completo (bootstrap de BD vacía)
├── migrations/                migraciones idempotentes 001..003
├── cleanup_legacy_tables.sql  DROPs manuales de tablas legado (una vez)
├── .env.production            PLANTILLA (placeholders) del .env del VPS
├── README.md / README.es.md   (en realidad, el README del frontend)
├── docs-agentes/              ← ESTE directorio
└── tidol-workspace/           workspace de Cargo + frontends
    ├── Cargo.toml             miembros: tidol-core, tidol-server, tidol-shell,
    │                          plugins/provider-{archive,lyrics,jamendo}
    ├── .cargo/config.toml     SQLX_OFFLINE=true por defecto
    ├── .sqlx/                 caché offline de las consultas sqlx::query!
    ├── tidol-core/            LIB de dominio (sin axum)         → doc 03
    ├── tidol-server/          BIN HTTP (Axum)                   → doc 04
    ├── tidol-shell/           BIN REPL de administración        → doc 09
    ├── plugins/               cdylibs FFI + provider-ai (C++)   → doc 06
    ├── bad_engine/            BIN worker de letras (fuera del workspace) → doc 06
    ├── tidol-frontend/        SPA React + Vite + PWA            → doc 07
    ├── tidol-tv-lite-backup/  copia vieja de un frontend para TV → doc 13
    ├── tidol-tv-lite/         (sin ficheros versionados; solo dist/ y node_modules/)
    ├── scripts/test-db.sh     MariaDB desechable para tests    → doc 11
    ├── docs/                  textos legales (ToS, privacidad, DMCA, about)
    └── *.py, *.sql sueltos    restos de refactors pasados       → doc 13
```

## Por qué está dividido así

- **`tidol-core` es una librería pura** (sin `axum`). Contiene SQL, llamadas HTTP salientes,
  orquestación, JWT/argon2, imágenes. Así la pueden usar **dos binarios**: el servidor HTTP
  y el REPL de administración (`tidol-shell` en modo local llama directamente al core).
  Este corte se hizo en el commit `12dcf980` ("refactor core/server") y se validó con
  tests que fijan el comportamiento de la "línea base" `e46be8bb` (ver [02](02-reglas-y-convenciones.md#3-contratos-de-línea-base)).
- **`tidol-server` es transporte**: rutas, extractores, middleware de auth, rate limit,
  CORS y el mapeo `TidolError → HTTP` (newtype `ServerError` por la *orphan rule*).
- **`TidolCore` es un único struct** con bloques `impl` repartidos por dominio
  (`auth.rs`, `catalog.rs`, `library.rs`, `media.rs`, `user_data.rs`). El estado de Axum
  es solo `AppState { core: Arc<TidolCore> }`.
- **Plugins `.so` (FFI C)**: herencia de la era anterior para poder cambiar proveedores
  sin recompilar el core. Hoy son casi decorativos (ver [06](06-proveedores-plugins-y-workers.md)).
- **Los proveedores de embed** sí viven dentro del core (`providers/`), detrás del trait
  `MusicProvider`, orquestados por `ProviderOrchestrator` (búsqueda concurrente con timeout por proveedor).

## Flujo de una petición típica

**Ejemplo: el usuario pulsa play en una pista de búsqueda.**

1. Front: `SearchPage` → `PlayerContext.playSong` → `embedResolver.resolvePlayback(track)`.
2. Si es Internet Archive → `<audio>` nativo (`TidolAudioEngine`). Si no →
   `GET /api/v1/embed/search?q=<artista título>&limit=5` (pública).
3. Caddy → `tidol-server` → `handlers::embed_search_handler` → `core.embed_search` →
   `ProviderOrchestrator::search_all` → `YouTubeProvider::search` (YouTube Data API v3, caché 1 h).
4. Front elige el primer resultado `platform == youtube` → carga ese `videoId` en el
   `YouTubeEmbed` oculto montado globalmente en `PlayerContext`.
5. Front: `POST /api/v1/tracks/:mbid/log-play` (protegida) → `play_history` + upsert en `track_links`.
6. Front: portada vía `getCoverSrc` (portada propia o `/api/v1/covers/:mbid`); colores
   extraídos en el cliente con canvas; letras por el web component `am-lyrics`.

**Ejemplo: petición protegida.** `auth_middleware` lee `Authorization: Bearer …` (o
`?token=`), `core.authenticate` decodifica el JWT y **comprueba en BD que el device
existe** (por eso borrar devices/usuario invalida tokens al instante). Inyecta
`Extension<AuthContext>` para el handler.

## Fuentes externas y para qué se usan

| Servicio | Para qué | Dónde |
|----------|----------|-------|
| MusicBrainz (JSON API directa + `musicbrainz_rs`) | búsqueda, artistas, álbumes, resolución de pistas | `orchestrator.rs`, `media.rs` |
| Cover Art Archive | portadas por release / release-group | `media.rs::get_cover` |
| iTunes Search | portada de artista y fallback de portada de pista | `orchestrator.rs`, `media.rs` (bloqueado desde el VPS) |
| Wikipedia | biografía de artista | `orchestrator.rs::fetch_wikipedia_bio` |
| Last.fm | pistas similares (radio, recomendaciones) | `orchestrator.rs::get_similar_tracks` |
| LRCLIB | letras (backend y web component del front) | `catalog.rs::get_lyrics`, `AmLyricsView.jsx` |
| YouTube Data API v3 | búsqueda de vídeos para reproducir | `providers/youtube.rs` |
| Spotify / SoundCloud | embeds (desactivados) | `providers/spotify.rs`, `providers/soundcloud.rs` |
| archive.org | búsqueda y streaming legal CC/PD | `providers/archive.rs`, `InternetArchivePage.jsx` (directo desde el navegador) |
