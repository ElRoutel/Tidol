# 06 — Proveedores de embed, plugins FFI y workers

[← Índice](INDICE.md)

Hay **tres generaciones** de "proveedores" conviviendo. Solo la primera está viva.

| Generación | Dónde | ¿Se usa? |
|------------|-------|----------|
| Proveedores de embed en proceso (trait `MusicProvider`) | `tidol-core/src/providers/` | **Sí** (YouTube + Internet Archive) |
| Plugins dinámicos `.so` vía FFI C | `tidol-workspace/plugins/provider-*` | **No** (se compilan y cargan, pero nadie los invoca) |
| Workers externos (`bad_engine`, `provider-ai` Whisper/CUDA) | `tidol-workspace/bad_engine/`, `plugins/provider-ai/` | **No en producción** |

---

## Proveedores de embed (en proceso)

Ruta: `tidol-workspace/tidol-core/src/providers/`.

### `provider_trait.rs`
- `enum Platform { YouTube, Spotify, SoundCloud, InternetArchive }` con serde
  `snake_case` y `rename` explícito: `youtube`, `spotify`, `soundcloud`,
  `internet_archive`. (Antes `YouTube` salía como `you_tube`; el front aún normaliza
  `you_tube → youtube` en `canonicalPlatform()` por compatibilidad.)
- `struct Track { id, platform, title, artist, thumbnail, duration, embed_url, external_url, preview_url }`.
- `struct EmbedInfo { embed_url, external_url, preview_url }`.
- `trait MusicProvider { name, platform, search(query, limit), resolve(id), max_timeout() = 5 s }`.
- `ProviderError` (`NotFound`, `Api`, `Http`, `RateLimited`, `MissingConfig`, `Parse`).
- **Regla del trait:** nunca devolver URLs de audio directo para contenido con copyright;
  `preview_url` solo para previews legales (Spotify 30 s) o Internet Archive.

### `waterfall.rs` — `ProviderOrchestrator`
- `search_all(query, limit)`: lanza **todos** los proveedores en paralelo (`join_all`),
  cada uno con su `max_timeout`; los errores/timeouts se registran y se ignoran; concatena resultados.
- `resolve("plataforma:id")`: busca el proveedor cuyo `Platform::to_string()` coincide.
- A pesar del nombre ("waterfall") **no es una cascada**: es un fan-out.

### `youtube.rs` — `YouTubeProvider` (motor principal)
- YouTube Data API v3 con **API key** (`YOUTUBE_API_KEY`), nunca OAuth ni cookies.
- `search`: `search.list` con `videoCategoryId=10` (música) + `videos.list` en lote para
  duraciones (ISO 8601 → segundos). Miniatura `i.ytimg.com/vi/<id>/hqdefault.jpg`.
- `resolve`: comprueba que el vídeo existe.
- Cachés `moka` de 1 h (búsqueda y detalles), **en memoria por réplica**.
- **Coste de cuota:** `search.list` = 100 unidades → ~100 búsquedas/día con la cuota
  gratuita de 10 000. Cada pista que el usuario reproduce sin `videoId` previo dispara
  una búsqueda desde el front. Es el cuello de botella real de escalado.

### `spotify.rs` — `SpotifyProvider` (desactivado)
Client Credentials (token cacheado tras `RwLock` con doble comprobación), búsqueda y
resolve, embed `open.spotify.com/embed/track/<id>`, cachés 1 h. Se activa solo con
`SPOTIFY_CLIENT_ID`. El widget de Spotify no es controlable desde la UI de Tidol.

### `soundcloud.rs` — `SoundCloudProvider` (desactivado)
API pública con `client_id`, embed `w.soundcloud.com/player`. Mismo problema de control.

### `archive.rs` — `ArchiveProvider` (siempre activo)
- `advancedsearch.php` restringido a colecciones con licencia CC/PD, metadata por item,
  `preview_url` = `https://archive.org/download/<id>/<fichero>` (streaming **legal**).
- Cachés de 6 h, timeout 15 s.
- Ojo: el front de Internet Archive (`InternetArchivePage.jsx`) consulta
  `archive.org/metadata` **directamente desde el navegador**, no a través de este proveedor.

---

## Plugins FFI (`.so`)

Ruta: `tidol-workspace/plugins/`. Crates `cdylib` con un ABI C mínimo:
`get_provider_name() -> *mut c_char`, función principal, `free_plugin_string(ptr)`.
Todos devuelven JSON en un `CString` que el llamador debe liberar con `free_plugin_string`.

| Plugin | Exporta | Qué hace | Estado |
|--------|---------|----------|--------|
| `provider-lyrics` | `fetch_lyrics(track, artist)` | LRCLIB (reqwest blocking) | `TidolCore::new` lo **carga** desde `$PLUGINS_DIR/libprovider_lyrics.so`, pero `get_lyrics` llama a LRCLIB directamente → **nunca se invoca** |
| `provider-archive` | `search_track(query, proxy)`, `get_stream_url(...)` | Internet Archive "track-resolved lossless" (busca solo por la **última palabra** de la query) | Compilado y copiado a la imagen; **nadie lo carga** (lo sustituye `providers/archive.rs`) |
| `provider-jamendo` | `search_track`, `get_stream_url` | Jamendo API v3 (FLAC > OGG > MP3); `JAMENDO_CLIENT_ID` con un client_id de demo hardcodeado como fallback | Compilado y copiado; **nadie lo carga** |

Los tres tienen `#![allow(clippy::not_unsafe_ptr_arg_deref)]` a propósito (los símbolos
son `extern "C"` con punteros crudos). `provider-lyrics` hace `unwrap()` en
`CString::new` y deref de punteros sin comprobar nulos.

**Decisión pendiente:** o se conectan de verdad (p.ej. Jamendo como segunda fuente legal
de audio directo) o se eliminan del workspace y del `Dockerfile`. Ver [12](12-pendientes-y-deuda-tecnica.md).

### `provider-ai` (C++/CUDA, NO es miembro del workspace)
`plugins/provider-ai/`: `ai_plugin.cpp` envuelve **whisper.cpp** con CUDA (FFI
`get_provider_name`, `init_ai_model`, transcripción de WAV). `CMakeLists.txt` está
afinado para la máquina del dev (i7-9700 AVX2, RTX 2080 cc 7.5, `-march=native`).
Incluye `whisper.cpp/` y `models/` vendorizados (~6,5 GB en disco, git-ignorados;
excluidos de Docker y del rsync del deploy). Era la pieza que alineaba letras palabra
por palabra (`lyrics_status = whisper_synced`) sobre audio descargado; **ese uso ya no
es legal**. Si se reactiva, solo con audio de Internet Archive/Jamendo
([02](02-reglas-y-convenciones.md#1-reglas-legales-absolutas)). El vendorizado contiene
un ejemplo upstream con yt-dlp (`examples/yt-wsp.sh`): ignóralo, no lo uses.

---

## `bad_engine`

Ruta: `tidol-workspace/bad_engine/` (crate **fuera** del workspace de Cargo; tiene su
propio `target/`). Binario que recibe `TARGET_MBID`, `TARGET_ARTIST`, `TARGET_TITLE`
por entorno, busca la letra **plana** en LRCLIB y la escribe en `track_links`.

- `main.rs`: pool, guarda "si ya hay `lyrics_json`, salir", ejecuta el pipeline.
  Tiene defaults de prueba (un mbid/artista/título concretos) si faltan las variables.
- `orchestrator.rs`: `process_new_track` → `lyrics_fetcher::fetch_plain_lyrics` → `UPDATE`.
- `lyrics_fetcher.rs`: cliente LRCLIB (sin timeout).

**Lo lanza** `trigger_bad_engine_prefetch` (en `tidol-core/src/orchestrator.rs`) para las
3 primeras pistas de "Volver a escuchar" cuyo `lyrics_status` sea `pending`/`not_found`/
`plain_only`/NULL.

**Problemas conocidos (está roto de hecho):**
1. El `UPDATE` escribe `status = 'synced'`, una columna que **no existe** en
   `track_links` → la consulta falla. El camino de error hace otro `UPDATE … SET status = 'failed'` que también falla.
2. Aunque funcionara, guarda `lyrics_status = 'plain'` y un JSON `{status,type,lyrics}`,
   mientras `catalog.rs::get_lyrics` espera `plain_only` con un **array de líneas**.
3. No está en la imagen Docker (`.dockerignore` excluye `bad_engine/`) → en producción el
   prefetch siempre se omite con un `warn`.
4. El backend ya obtiene letras de LRCLIB bajo demanda, y el front las pide al web
   component; `bad_engine` es redundante. **Candidato claro a eliminación** (junto con
   `trigger_bad_engine_prefetch` y `PREFETCH_INFLIGHT`).
