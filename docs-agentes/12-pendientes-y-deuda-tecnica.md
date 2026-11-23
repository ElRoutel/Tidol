# 12 — Pendientes, bugs conocidos y deuda técnica

[← Índice](INDICE.md)

Lista priorizada a fecha **2026-11-22**. Al resolver algo, **bórralo o márcalo ✅ con la
fecha y el commit**. Las prioridades son una propuesta; el dueño del proyecto decide.

- **P0** seguridad / riesgo real en producción
- **P1** funcionalidad rota o engañosa para el usuario
- **P2** deuda técnica que frena el desarrollo o el escalado
- **P3** limpieza y mejoras deseables

---

## P0 — Seguridad

1. ✅ *2026-11-23* **SSRF en `/covers?fallback=` y `/colors/extract`** — `net::fetch_external_image`:
   solo HTTPS a una lista blanca (`ytimg.com`, `mzstatic.com`, `coverartarchive.org`, `archive.org`,
   `scdn.co`, `sndcdn.com` y subdominios), sin IPs literales/credenciales/puertos ≠ 443, cada
   redirección revalidada, `image/*` y ≤ 5 MB leído por trozos. `/colors/extract` además solo lee
   rutas locales bajo `uploads/` o `covers/` (antes cualquier ruta, `../` incluido). Verificado con un
   listener: 0 conexiones del servidor a 127.0.0.1/::1/169.254.169.254; el fallback de YouTube sigue.
2. **Secretos en ficheros versionados** — ✅ *fuera del árbol 2026-11-23*; ⚠️ **ROTACIÓN PENDIENTE**
   (siguen en el historial de git; hay que darlos por comprometidos):
   - `Caddyfile` (raíz): token de DuckDNS → ahora `{env.DUCKDNS_API_TOKEN}`. **Regenerar en duckdns.org.**
   - `tidol-workspace/test_security.py`: `JWT_SECRET` y credenciales de BD → ahora `os.environ`
     (`DB_URL`, `JWT_SECRET`). **Rotar el `JWT_SECRET`** donde se use (si era el de prod, invalida
     todas las sesiones al cambiarlo: es lo correcto).
   - `compose.yaml`: valores por defecto de `MARIADB_ROOT_PASSWORD` / `MARIADB_PASSWORD` → ahora
     `${VAR:?error}` (obligatorias). La de usuario coincidía con la de desarrollo. **Cambiarlas con
     `ALTER USER` en MariaDB y actualizar el `.env`** (antes de desplegar, comprobar que el `.env` del
     VPS define ambas o el deploy fallará con un mensaje claro).
   - `orchestrator.rs::get_similar_tracks`: clave de Last.fm literal, que era **la que usaba prod**
     (compose no pasaba `LASTFM_API_KEY`) y además viajaba por `http://`. Ahora solo por entorno, por
     HTTPS, y compose la pasa. **Crear una clave nueva y ponerla en el `.env` del VPS** o la radio
     saldrá vacía.
   - `tidol-tv-lite-backup/src/api/axiosConfig.js`: JWT de respaldo escrito en el código → eliminado.
   - `plugins/provider-jamendo`: el client_id de respaldo es el **id de demo público** que documenta
     Jamendo, no una credencial; se deja (el plugin además no se carga).
3. ✅ *2026-11-23* **`/embed/search` pública y sin límite** → ahora protegida (también
   `/embed/resolve`) y con **30 búsquedas/minuto por usuario** (ventana en Redis; sin Redis no hay
   límite compartido, pero ya exige sesión). Verificado: sin token 401; la 31.ª del minuto, 429.
4. ✅ *2026-11-23* **Rate limit de login/registro global** → `SmartIpKeyExtractor` (IP real vía
   `X-Forwarded-For`, que Caddy sobrescribe). Verificado: la ráfaga de una IP da 429 y otra IP entra.
5. ✅ *2026-11-23* **JWT por `?token=`** → el middleware solo acepta `Authorization: Bearer`
   (ningún cliente usaba la query). Test de contrato cambiado a propósito: un token válido por
   query → 401.
6. ✅ *2026-11-23* **CORS `Any`** → sin cabeceras CORS por defecto (front y API comparten origen);
   `ALLOWED_ORIGINS` (lista separada por comas) si algún cliente lo necesita.
7. ✅ *2026-11-23* **Sesiones sin purgar** → `purge_expired_devices` al arrancar y cada 6 h borra los
   devices de más de 8 días (el JWT dura 7). En la BD local borró 66 de 82. Pendiente (no P0): lista
   de sesiones para el usuario y refresh tokens.

## P1 — Funcionalidad rota o engañosa

1. **Subida de música**: `pages/UploadPage.jsx` hace `POST /uploads/musica`, que no existe.
   Decidir: implementarlo (¿solo audio propio/CC?) o quitar la ruta `/upload` del front.
2. **VOX / stems / Spectra**: `hooks/useVoxAudio.ts` (`/api/vox`, `/stems`), `hooks/useLazyCaching.ts`
   (`/spectra/ingest-remote`), parte de `TidolAudioEngine.ts` y el proxy de `vite.config.ts` a
   `:3002` apuntan a servicios que **ya no existen**. `useLazyCaching` se ejecuta en Home e
   InternetArchivePage (peticiones fallidas en cada visita). Eliminar o reimplementar legalmente.
3. **Sugerencias de búsqueda**: `DesktopSearch.jsx` y `MobileHeader.jsx` llaman a
   `/search/suggestions` (404). Implementar en el backend o quitar.
4. **`ArchiveAlbumCard.jsx` llama a `/music/getCover/:id`** (no existe; el componente además está muerto).
5. **Mocks en producción**: `/music/home-recommendations` y `/music/ia/discoveries`
   (`handlers.rs`) devuelven datos de relleno.
6. **Letras duplicadas**: el fullscreen pide `/lyrics/:mbid` y descarta el resultado mientras
   `<am-lyrics>` busca la letra desde el navegador (LRCLIB/Netease). Elegir una fuente
   ([08](08-flujos-reproduccion-portadas-letras.md#3-letras)).
7. **`bad_engine` roto**: escribe en la columna inexistente `track_links.status` y en un formato
   que `get_lyrics` no entiende; tampoco existe en la imagen Docker. Eliminarlo junto con
   `trigger_bad_engine_prefetch`, o arreglarlo (ver [06](06-proveedores-plugins-y-workers.md#bad_engine)).
8. **Cuota de YouTube**: ~100 búsquedas/día. Persistir `videoId` resuelto por mbid (la columna
   `track_links.yt_video_id` ya existe y está sin usar) y reutilizarlo antes de buscar; pedir
   ampliación de cuota. ✅ *2026-11-23*: caché compartida en Redis (búsquedas 7 d, clave
   normalizada): la misma búsqueda ya no se paga una vez por réplica ni tras cada deploy.
9. **Spotify/SoundCloud**: código listo, sin credenciales, y sus widgets no son controlables
   desde la UI. Decidir si se ofrecen como "abrir en la plataforma" o se retiran.
10. **iTunes bloqueado desde el VPS**: las portadas de artista y el paso 3 de `get_cover` fallan
    siempre en prod. ✅ *Mitigado 2026-11-22*: ya no cuesta un timeout por llamada (cortacircuitos
    en `net.rs` + `ITUNES_ENABLED`). Sigue pendiente sustituirlo por fuentes que funcionen
    (Wikidata/Fanart.tv/CAA) para tener portadas de artista.
11. **`report-cover-404`**: `UniversalCard.tsx` lo llama con `track.id` (pistas), pero solo
    actualiza la tabla `albums`; para pistas no hace nada.

## P2 — Deuda técnica

### Backend
- **Código muerto** (borrar o justificar): `get_radio_tracks`, `search_tracks_m3u`,
  `get_album_tracks_m3u`, `ItunesSearchResponse/ItunesTrack` (`orchestrator.rs`);
  `WorkerEvent`, `CanonicalHit`, `LocalSearchSection`, `LocalTrack` (`models.rs`);
  `TidolError::StreamUnavailable`/`Ffi` casi sin productores; `ProxyRotator` y
  `lyrics_provider` cargados pero sin uso; feature `local-library` vacía.
- **Plugins `.so`**: `provider-archive` y `provider-jamendo` se compilan y copian a la imagen
  sin que nadie los cargue (más tiempo de build y superficie). Decidir conectar (Jamendo sería
  una segunda fuente legal de audio directo) o eliminar.
- **`orchestrator.rs` (~1 270 líneas)** mezcla búsqueda, artistas, álbumes, portadas, bio,
  radio, home y prefetch. Partir por dominio como se hizo con `TidolCore`.
- **Path absoluto de la máquina del dev** como fallback en `trigger_bad_engine_prefetch`.
- **`hydrate_unknown_tracks`** se ejecuta en cada réplica al arrancar; debería ser un job único.
- ✅ *2026-11-23*: Redis en uso (`cache.rs`) para YouTube, similares y la ventana global de
  MusicBrainz. Siguen por réplica (menor impacto): Internet Archive y Spotify/SoundCloud.
- **Home "top artists"** une `track_links.artist = artists.name` (por nombre). Guardar `artist_mbid`.
- **Errores tragados**: varios métodos devuelven `Vec` vacío ante error de BD
  (`get_album_songs`, `get_artist_songs`, `get_local_likes`…) — el front no distingue fallo de vacío.
- **Versiones de `reqwest` mezcladas**: 0.11 (core, lyrics, shell), 0.12 (archive, jamendo), 0.13 (bad_engine).
- ✅ *2026-11-23*: `GET /api/v1/health` (toca la BD) + `curl -f` en el HEALTHCHECK del `Dockerfile`.
- `DATABASE_MAX_CONNECTIONS` default 100 en el binario (el `Dockerfile` ya usa 50 como compose, 2026-11-23).
- ✅ *2026-11-22 (rendimiento)*: cliente HTTP compartido (`net.rs`) en vez de uno por petición;
  caché de 6 h para `get_similar_tracks` (Home); CAA en paralelo acotado en `get_cover`;
  backfill de `playlist_songs.position` solo si hace falta; prefetch de `bad_engine` sin coste
  cuando no hay binario.
- ✅ *2026-11-23*: `[profile.release] lto = "thin"` en `tidol-workspace/Cargo.toml` (+2–3,5 % req/s
  en todas las rutas medidas; build limpio 204 → 206 s). `strip` descartado (backtraces legibles).
- ✅ *2026-11-23*: `Dockerfile` con cargo-chef (capa de dependencias cacheada).
- Rendimiento pendiente: el limitador de MusicBrainz ya es global vía Redis
  (verificado: 2 réplicas en carga → exactamente 1 req/s en total).
- ✅ *2026-11-22*: limitador común de MusicBrainz con prioridades (`net.rs`) + pistas de portada
  desde la búsqueda. Benchmark local (20 portadas sin caché + búsqueda simultánea): antes la
  búsqueda salía vacía por 503 y solo 3/20 portadas; ahora la búsqueda trae resultados y la
  portada más lenta pasa de ~40 s (solo limitador) a ~3 s (limitador + pistas).
- ✅ *2026-11-22*: portadas — `Cache-Control` en `/covers` (antes ninguno) y pista firmada en la
  URL en vez de caché en memoria (funciona con 3 réplicas; verificado: búsqueda en una réplica,
  portadas servidas por otra en ≤ 3,4 s; pista falsificada ignorada).
- ✅ *2026-11-22*: portadas fase 3 — mapa persistente `cover_map` + una imagen por portada en
  `covers/art/` + misses compartidos (7 días). Verificado: tras reiniciar, portadas en ≤ 17 ms y
  "sin portada" en ≤ 2 ms sin cascada; un fichero perdido se repara descargando solo esa portada.
  Pendiente: los ~500 `covers/<mbid>.jpg` antiguos (52 % duplicados) siguen ahí; se podrían
  migrar a `covers/art/` con un script que resuelva su `art_key` (no urgente: ~19 MB).
- ✅ *2026-11-22*: `ORDER BY RAND()` de las recomendaciones de reserva de la Home sustituido por
  un pivote UUID aleatorio sobre la PK (rango por índice + vuelta circular).

### Base de datos
- **Tres mecanismos de migración** (arranque del core, `migrations/`, SQL manual) sin tabla de
  versiones. Considerar `sqlx migrate` con migraciones versionadas.
- **Columnas legado** en `track_links` (`direct_stream_url`, `premium_audio_path`,
  `provisional_audio_path`, `soundcloud_track_id`, `genius_id`) y en `trackMetadata`
  (`localAudioPath`, `structuredWordsJson`, …). `yt_video_id` sí podría reutilizarse (P1.8).
- `album_tracks` con PK `track_mbid` impide que una pista esté en dos álbumes.
- `play_history` sin FKs; `artists.image_url` y `cover_url` redundantes; nombres camelCase en
  `trackMetadata`/`searchClicks` frente a snake_case en el resto.
- Confirmar si `cleanup_legacy_tables.sql` ya se ejecutó en producción.

### Frontend
- ~35 ficheros sin importar ([07](07-frontend.md#código-muerto)) y `socket.io-client` sin uso en `package.json`.
- `PlayerContext.tsx` (~940 líneas) concentra demasiado (YouTube, nativo, VOX, MediaSession,
  likes, radio, colores). Extraer la lógica VOX muerta y los likes.
- Mezcla `.jsx`/`.tsx` y `any` frecuentes; `UnifiedTrack` arrastra muchos campos legacy
  (`titulo`, `artista`, `portada`…) que obligan a normalizar en mil sitios.
- Sin tests ni CI.
- `nginx.conf` sin cabeceras de caché (assets con hash podrían ser inmutables; `sw.js` no-cache).
- `pages/ImmersiveLayout.css` duplica `layouts/ImmersiveLayout.css`.

### Infra
- `compose.yaml` llama `tidol-core` al servicio cuyo binario es `tidol-server`.
- Email placeholder en `Caddyfile.prod` (avisos de Let's Encrypt no llegan a nadie).
- Sin backups automáticos documentados de MariaDB ni del volumen `tidol-covers`.
- Sin CI (GitHub Actions) que ejecute `cargo check` offline + tests + `npm run build`.

## P3 — Limpieza y mejoras

- Ordenar la raíz de `tidol-workspace/`: scripts `.py` y SQL sueltos de refactors pasados ([13](13-archivos-legado-y-sueltos.md)).
- `tidol-tv-lite-backup/` versionado (copia entera de un frontend viejo) y `tidol-tv-lite/` sin fuentes.
- `README.md` de la raíz es en realidad el del frontend: escribir un README real del monorepo
  que apunte a este directorio.
- Completar los comandos `NotImplemented` de `tidol-shell` ([09](09-tidol-shell.md)).
- `bad_engine` usa `println!` en lugar de `tracing` y su cliente LRCLIB no tiene timeout.
- `tidol-core/postgresql_migration.sql`: decidir si la migración a PostgreSQL sigue en el plan; si no, borrar.
- Valorar un `CLAUDE.md` en la raíz que enlace a `docs-agentes/INDICE.md` para que los agentes lo carguen automáticamente.
