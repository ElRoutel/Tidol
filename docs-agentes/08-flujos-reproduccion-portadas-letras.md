# 08 — Flujos transversales: reproducción, portadas, colores y letras

[← Índice](INDICE.md)

Estos tres flujos cruzan backend y frontend y son donde más bugs ha habido. Los
comentarios del código cuentan cada bug; aquí está el mapa.

## 1. Reproducción

**Ficheros:** `tidol-frontend/src/context/PlayerContext.tsx` (orquesta),
`engine/embedResolver.ts` (decide la fuente), `components/embeds/YouTubeEmbed.tsx`
(IFrame API), `engine/TidolAudioEngine.ts` (audio nativo), `engine/backgroundKeepAlive.ts`.
Backend: `GET /api/v1/embed/search` → `providers/youtube.rs`.

```
playSong(track, queue)
  └ startPlayback(track)                     seq = ++playbackSeqRef  (token de generación)
      ├ resolvePlayback(track)               embedResolver.ts
      │   1. ¿audio legal directo? (IA preview/playback, blob:, local) → {mode:'archive', audioUrl}
      │   2. ¿platform youtube con id?                                → {mode:'youtube', videoId}
      │   3. GET /embed/search?q="<artista> <título>"&limit=5         → 1er resultado youtube
      ├ si seq cambió mientras tanto → descartar (evita que gane la resolución más lenta)
      ├ youtube: pausa el engine nativo, startKeepAlive(), monta/reutiliza el IFrame oculto;
      │          onReady → setVolume + play
      └ archive: pausa YouTube, stopKeepAlive(), engine.playTrack({...track, playbackUrl})
```

- **YouTube es el motor principal** (decisión del dueño). El IFrame es global y oculto,
  controlado por la UI propia. Abrir `youtube.com/embed/<id>` directamente en la barra
  de direcciones da "Error 153": es normal, no es un bug de Tidol.
- **Internet Archive / local** usan `<audio>` nativo con crossfade dual-player.
- VOX, crossfade y espectro **solo** funcionan con audio nativo (un IFrame cross-origin no
  se puede "tapear" con Web Audio).
- Spotify/SoundCloud: no hay ruta de reproducción controlable; están fuera del flujo.
- `repeat one` se implementa en `onStateChange('ended')`; `next` usa refs para no
  capturar closures viejos.
- **Telemetría:** `POST /tracks/:mbid/log-play` una vez por pista (dedupe por mbid; antes
  se registraba 3-4 veces y además se duplicaba en `/history/add`, hoy no-op).
- **Radio:** `GET /radio?artist&title` (Last.fm similar) → añade a la cola con `sourceType: 'radio'`.

### Reproducción en segundo plano
- Los navegadores móviles pausan el `<video>` del IFrame al ocultar la página. El
  contexto guarda la **intención** del usuario (`intendedPlayingRef`) y, si la pausa no la
  pidió él y `document.hidden`, reanuda: primero síncrono, luego un reintento a 300 ms,
  máximo 10 intentos; el presupuesto se reinicia en cada `visibilitychange`.
- `backgroundKeepAlive.ts` mantiene la pestaña "audible" (Chrome Android no la congela).
  Tiene que arrancar **dentro del gesto del usuario** (política de autoplay).
- **MediaSession**: metadata con la misma portada que la UI, acciones play/pause/next/
  prev/seek (cada registro en try/catch), `setPositionState` al cambiar de estado y cada ~5 s.

## 2. Portadas

**Backend** — `GET /api/v1/covers/:mbid?fallback=<url>&c=<pista>&s=<firma>` → `tidol-core/src/media.rs::get_cover`:

```
validar mbid (charset seguro, anti path-traversal)            → 400 si no
¿covers/<mbid>.jpg en disco? (formato antiguo, una copia por pista) → servirla
¿miss reciente en COVER_MISSES (30 min, por réplica)?          → default
0. cover_map (BD, compartido): art_key → covers/art/<art_key>.jpg (si falta el fichero,
   se re-descarga SOLO esa portada); NULL de < 7 días → default sin cascada
¿pista c/s con firma HMAC válida? (la pone la búsqueda)        → saltar 1 y el lookup de 2
1. Cover Art Archive /release/<mbid>/front, /release-group/<mbid>/front (en paralelo)
2. Candidatos = la pista, o un lookup a MusicBrainz (limitador común, prioridad de fondo)
   puntuados por cover_candidates (Official + Album + fecha antigua; excluir
   Compilation/Live/DJ-mix/Remix…; exigir mismo artista) → CAA con concurrencia 4
   en orden de puntuación (si la candidata ya está en covers/art se usa sin red)
   → primer acierto: covers/art/<art_key>.jpg (atómico, una vez por portada) + cover_map
3. iTunes (texto fuzzy; NO se cachea en disco)               ← cortacircuitos; bloqueado desde el VPS
4. fallback=<url> (p.ej. miniatura de YouTube) descargada y servida same-origin (NO se cachea)
nada → registrar miss en memoria y en cover_map (salvo si MB dio 503) → covers/default.jpg o 404
```

**Pista firmada (`?c=r.<release>,g.<release-group>&s=<hmac>`).** `search_catalog` ya recibe los
releases de cada grabación y los mete en el `coverUrl` de cada resultado
(`cover_url_for_search`); `c=-` = sin candidatos (falla al instante). Va en la URL y no en
memoria porque en prod hay 3 réplicas (`least_conn`): una caché en memoria solo acertaba
~1/3. La **firma es obligatoria** (HMAC-SHA256 con `JWT_SECRET`, dominio
`tidol-cover-hint-v1`, ligada al mbid): `/covers` es pública y lo encontrado se cachea en disco
para todos, así que una pista sin firmar permitiría envenenar la portada de cualquier mbid. Sin
`JWT_SECRET` no se generan ni aceptan pistas. Los ids se validan como UUID: solo salen URLs de
coverartarchive.org.

**Caché HTTP** (`handlers::get_cover_handler`): portada canónica `max-age=604800` (7 días),
respaldo iTunes/`fallback` `max-age=3600` (`CoverOutcome::Fallback`), default/404 `max-age=600`.
Antes no había `Cache-Control` y el navegador repetía cada portada en cada render.

**Frontend** — `utils/coverArt.ts::getCoverSrc(track)` es la **fuente única de verdad**:
`resolvedCover` congelado en el contexto → portada propia de la pista
(`coverArtUrl`/`cover_url`/…) → `/api/v1/covers/:mbid` → `/default-album.png` (la rana).
`PlayerContext` congela la portada una vez por pista para que barra, fullscreen y
lockscreen muestren exactamente la misma. La miniatura de YouTube va a `ytThumbnail`
(no pisa `coverArtUrl`) y solo se usa como último `?fallback=`.

Otros caminos de portada:
- `track_links.cover_url` (lo rellena `log_play`/`resolve_full_track`, a veces con iTunes).
- `albums.cover_url` + `cover_status = 'not_found'` (el front lo marca con
  `POST /albums/:mbid/report-cover-404` cuando la imagen falla).
- Portada de artista: iTunes en `search_catalog` / `get_artist_*`.

**Lecciones registradas:**
- iTunes devolvía compilaciones/playlists como primer match ("CLASSY 101" → "Today's Hits").
  Se corrigió a `entity=song` comparando título. **No hagas barridos masivos con iTunes**.
- La mayoría de "portadas erróneas" reportadas eran un **service worker viejo** sirviendo un
  bundle que pedía covers a `localhost:3000`.

## Colores

Extracción **en el cliente** (`utils/extractColors.ts`, histograma cuantizado en canvas)
para no cargar al backend. Para que el canvas no quede *tainted* se lee siempre una URL
**same-origin**: `getColorSourceSrc()` → `/api/v1/covers/:mbid?fallback=<portada real>`.
`POST /api/v1/colors/extract` (backend, color-thief) existe pero ya no se usa.

## 3. Letras

Hay **dos sistemas** y hoy solo uno se ve:

1. **Lo que se ve:** `components/AmLyricsView.jsx` envuelve el web component
   `<am-lyrics>` (`@uimaxbai/am-lyrics`), que **busca la letra por su cuenta desde el
   navegador** (LRCLIB / Netease) con título, artista, álbum, duración e ISRC. Un loop rAF le
   pasa `currentTime` (con un offset ajustable por pista guardado en `localStorage`); clic en un
   verso hace seek. Introducido en sep-2026 (commits `a3a0edfa`..`5c593f57`).
2. **Lo que ya no se pinta:** `GET /api/v1/lyrics/:track_id` (`catalog.rs::get_lyrics`):
   LRCLIB en el servidor, parseo LRC a `[{start_cs, word}]`, caché en `track_links.lyrics_json`
   con `lyrics_status`. `FullScreenPlayer.jsx` **todavía lo llama** al abrir el fullscreen, pero
   el resultado (`lyricsData`) no se renderiza; solo sus flags de carga/error condicionan el panel.
   `KaraokeView.jsx` (que sí pintaba este formato) quedó sin uso.

Consecuencias / decisiones pendientes ([12](12-pendientes-y-deuda-tecnica.md)):
- Doble búsqueda de letras por pista (servidor + cliente) y dependencia de un servicio de
  terceros (Netease) llamado desde el navegador del usuario.
- O se alimenta `<am-lyrics>` con la letra del backend (si el componente lo permite), o se
  deja de llamar a `/lyrics` en el fullscreen.
- `bad_engine` y el plugin `provider-lyrics` son restos de este sistema (ver [06](06-proveedores-plugins-y-workers.md)).
- Bug histórico resuelto: las pistas de "Volver a escuchar" solo traían `trackId`, no `id`
  → no se pedían letras. Por eso en el código verás siempre `id || trackId`.
