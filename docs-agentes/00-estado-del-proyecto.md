# 00 — Estado del proyecto (resumen ejecutivo)

[← Índice](INDICE.md)

## Qué es Tidol

Tidol es un **agregador/buscador de música** con interfaz "glassmorphism" estilo
Apple Music. El usuario busca en el catálogo de **MusicBrainz**, ve artistas, álbumes
y portadas, crea playlists, da likes y escucha música. Tidol **no aloja ni descarga
audio con copyright**: la reproducción ocurre dentro del **IFrame oficial de YouTube**
(o con audio directo solo de **Internet Archive**, contenido CC / dominio público).

- Producción: `https://tidol.duckdns.org` (un VPS propio, ver [10](10-infraestructura-y-deploy.md)).
- Repo: `git@github.com:ElRoutel/Tidol.git`, una sola rama `main`.
- Idioma del código: comentarios, commits y mensajes mayoritariamente en **español**.

## Historia en cuatro líneas

1. **Hasta jun-2026**: arquitectura "pirata" (yt-dlp, Piped, Invidious, desencriptado de
   Deezer, librespot, Whisper sobre audio descargado). Todo eso se **eliminó**.
2. **29/30-jun-2026**: migración legal "embed-only" (`MIGRATION_AUDIT.md` documenta qué
   se quitó). Se **reescribió y aplastó el historial git** en un único commit (`4f71aafb`)
   para borrar todo rastro del código ilegal.
3. **Jul-2026**: endurecimiento (auditoría de bugs, portadas vía Cover Art Archive,
   playlists con orden/likes, **split `tidol-core` (lib) / `tidol-server` (bin)**,
   `tidol-shell`, SQLx offline, deploy endurecido, borrado de cuenta, long-press).
4. **Sep-2026** (último commit `5c593f57`, 13-sep): letras nuevas en el fullscreen con
   el web component `@uimaxbai/am-lyrics` (`AmLyricsView`), sustituyendo a `KaraokeView`.

## Qué funciona hoy (verificado en algún momento en producción)

| Área | Estado |
|------|--------|
| Registro / login / logout / borrado de cuenta (JWT + device en BD) | ✅ |
| Búsqueda en MusicBrainz (pistas + hasta 3 artistas) | ✅ |
| Perfil de artista + discografía (cacheada en BD) | ✅ |
| Detalle de álbum (MusicBrainz) | ✅ |
| Portadas vía `/api/v1/covers/:mbid` (CAA → MusicBrainz → iTunes → fallback) | ✅ (iTunes bloqueado desde el VPS, ver [08](08-flujos-reproduccion-portadas-letras.md)) |
| Reproducción vía IFrame de YouTube (resolución por `/embed/search`) | ✅ |
| Reproducción de Internet Archive con `<audio>` nativo | ✅ |
| Reproducción en segundo plano en móvil / PWA | ✅ (keep-alive de audio) |
| Letras sincronizadas en el fullscreen | ✅ (las busca el web component en el cliente) |
| Playlists: CRUD, orden drag&drop, likes, duración total | ✅ |
| Likes de canciones (catálogo e Internet Archive) | ✅ |
| Home: "Volver a escuchar", recientes, artistas top, recomendaciones | ✅ |
| Radio (Last.fm `track.getsimilar`) | ✅ (clave Last.fm hardcodeada como fallback) |
| Menú contextual con long-press táctil | ✅ |

## Qué NO funciona / está a medias

Resumen; el detalle priorizado está en [12](12-pendientes-y-deuda-tecnica.md).

- **Spotify y SoundCloud**: código listo pero desactivados (no hay credenciales) y,
  aun con ellas, sus widgets no se pueden controlar desde la UI.
- **Subida de música** (`/upload`): el front llama a `POST /uploads/musica`, que **no
  existe** en el backend.
- **VOX (karaoke por stems) y Spectra**: el front llama a `/api/vox`, `/stems`, `/spectra`;
  esos servicios **ya no existen** (eran de la era pirata).
- **Sugerencias de búsqueda** (`/search/suggestions`) y **`/music/getCover/:id`**: el front
  las llama, el backend no las tiene → 404 silenciosos.
- **`/music/home-recommendations` y `/music/ia/discoveries`**: el backend devuelve **mocks**.
- **Plugins `provider-archive` y `provider-jamendo`** (`.so`): se compilan y copian a la
  imagen pero **nadie los carga**. El plugin `provider-lyrics` se carga pero **nunca se usa**.
- **`bad_engine`** (prefetch de letras): no existe en la imagen Docker → en producción el
  prefetch se salta con un `warn`.
- **Redis**: caché compartida entre réplicas (búsquedas de YouTube 7 d, similares 6 h) y ventana global del límite de MusicBrainz, desde 2026-11-23 (`tidol-core/src/cache.rs`). Opcional: sin `REDIS_URL` todo funciona solo con memoria.
- **`tidol-shell` modo local**: la mayoría de comandos devuelven `NotImplemented`.
- **Cuota de YouTube Data API v3**: 10 000 unidades/día ≈ 100 búsquedas/día. Hay caché en
  memoria de 1 h por réplica, nada más.
- **Secretos en el repo** (token DuckDNS en `Caddyfile`, secreto JWT/contraseña de BD de
  desarrollo en `tidol-workspace/test_security.py`, contraseña por defecto en `compose.yaml`).

## Números aproximados (nov-2026)

- Backend Rust: ~12 300 líneas (`tidol-core` ~5 000, `tidol-server` ~1 400, `tidol-shell` ~2 800, plugins ~1 400).
- Frontend: ~13 900 líneas TS/JS en `tidol-frontend/src`, de las cuales ~35 ficheros no los importa nadie (ver [07](07-frontend.md#código-muerto)).
- 51 consultas SQLx cacheadas en `tidol-workspace/.sqlx/`.
- Tests: ~77 (unitarios de core/server + parser del shell) + suite de integración con BD tras la feature `db-tests`.
