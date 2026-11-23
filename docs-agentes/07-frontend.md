# 07 — Frontend (`tidol-frontend`)

[← Índice](INDICE.md) · Ruta: `tidol-workspace/tidol-frontend/` · Todas las rutas de abajo son relativas a `src/` salvo que se diga otra cosa.

SPA **React 19 + Vite 8 + TypeScript 6 (mezclado con JSX)**, Tailwind 3, framer-motion,
react-router 7, axios, PWA (`vite-plugin-pwa`). Estética glassmorphism / Apple Music.
Producción: build estático servido por **Nginx** detrás de Caddy (mismo origen que la API).

## Raíz del proyecto

| Fichero | Qué hace / por qué |
|---------|--------------------|
| `package.json` | scripts `dev`, `build` (`tsc -b && vite build`), `lint`, `preview`. Dependencias notables: `@uimaxbai/am-lyrics` (letras), `react-window` (listas virtualizadas), `react-slick` + `slick-carousel`, `react-swipeable`, `lucide-react` + `react-icons`. **`socket.io-client` no se usa** en ningún fichero. |
| `vite.config.ts` | PWA `registerType: 'autoUpdate'`, solo precache estático (sin runtimeCaching). Proxy de dev: `/api`, `/uploads`, `/stems` → `http://localhost:3000` (el backend local); `/spectra`, `/api/spectra` → `:3002` (servicio **inexistente**). `allowedHosts` incluye dominios LAN, DuckDNS y trycloudflare. |
| `Dockerfile` | `node:20-alpine` → `npm install && npm run build` → `nginx:alpine`. |
| `nginx.conf` | SPA fallback `try_files … /index.html`. Sin cabeceras de caché para assets ni para `sw.js`. |
| `index.html` | `viewport-fit=cover` (PWA edge-to-edge), `theme-color #030303`. |
| `tailwind.config.js`, `postcss.config.js`, `eslint.config.js`, `tsconfig*.json` | configuración estándar. |
| `README.md` / `README.es.md` | genéricos (también copiados en la raíz del repo). |
| `public/` | iconos PWA, `default-album.png` (**es una rana**: la portada por defecto), `default_cover.*`, logos. |

## Arranque y providers (`main.tsx`, `App.tsx`)

```
BrowserRouter
 └ AuthProvider            (context/AuthContext.tsx)
    └ PlayerProvider       (context/PlayerContext.tsx)
       └ PlaylistProvider  (context/PlaylistContext.tsx)
          └ App → ContextMenuProvider → <Routes>
```

Rutas (`App.tsx`, todas con `lazy()`):
- Públicas bajo `AuthLayout`: `/login`, `/register`, `/terms`, `/privacy`.
- Protegidas (`ProtectedRoute` **definido inline en `App.tsx`**) bajo `ImmersiveLayout`:
  `/`, `/search`, `/upload`, `/library`, `/profile`, `/album/:id`, `/artist/:id`,
  `/ia-album/:identifier`, `/playlist/:id`. Fallback `*` → `/`.

## API

- `api/axiosConfig.js`: instancia `baseURL: '/api/v1'`, **timeout 15 s**. Interceptor de
  request añade `Authorization: Bearer <localStorage.token>` solo a peticiones propias.
  Interceptor de respuesta: **401 → borra el token y redirige a `/login`**.
- `api/searchCache.js`: **sin uso**.

## Contextos

| Fichero | Responsabilidad |
|---------|-----------------|
| `context/AuthContext.tsx` | token/device en `localStorage`; valida con `GET /auth/me` al cargar. Solo un **401** cierra sesión (un fallo de red usa el username cacheado). `login`/`register` envían `device_name` derivado del user-agent. |
| `context/PlayerContext.tsx` (~940 líneas) | **Corazón del reproductor.** Cola, pista actual, play/pause/seek/next/prev, shuffle/repeat, radio, likes, MediaSession, log-play, colores, VOX. Monta el **`YouTubeEmbed` oculto global** y usa `TidolAudioEngine` para audio nativo. Expone 4 contextos: el monolítico (`usePlayer`) y tres segmentados para evitar re-renders: `usePlayerState`, `usePlayerActions` (identidad estable), `usePlayerProgress` (motion values a 60 fps). Detalle en [08](08-flujos-reproduccion-portadas-letras.md). |
| `context/PlaylistContext.tsx` | CRUD de playlists contra el backend. `localStorage` es **solo caché de lectura**; ninguna escritura se da por buena sin confirmación del servidor. Normaliza duraciones/portadas de objetos crudos. |
| `context/ContextMenuContext.tsx` | estado global del menú contextual (posición, item, opciones extra inyectadas por el llamador). |

## Motor de reproducción (`engine/`)

| Fichero | Qué hace |
|---------|----------|
| `engine/embedResolver.ts` | `resolvePlayback(track)`: audio legal directo (IA/blob/local) → `archive`; YouTube ya resuelto → `youtube`; resto → `GET /embed/search` y primer resultado de YouTube. `canonicalPlatform()`. |
| `engine/TidolAudioEngine.ts` | Motor de `<audio>` nativo **dual-player con crossfade** (para Internet Archive/local) + restos de lógica VOX (URLs de stems). |
| `engine/backgroundKeepAlive.ts` | `<audio>` en loop con un seno de 50 Hz a −50 dBFS en 16-bit (inaudible) para que Chrome Android no congele la pestaña con el IFrame de YouTube en background. Explica por qué 8-bit sonaba a alarma. |

## Hooks (`hooks/`)

| Hook | Uso |
|------|-----|
| `useSearch.ts` | búsqueda (`GET /search/:q`), historial local de búsquedas, mapeo a `UnifiedTrack`, `POST /search/click`. |
| `useHome.js` | `GET /home` + `GET /music/albums`; caché en memoria por chip (stale-while-revalidate); rellena "Selección rápida" con fallbacks. |
| `useLibrary.js` | pestañas de Biblioteca; usa `likes/detailed`; distingue error de red de "vacío". |
| `useLongPress.ts`, `useContextMenuTrigger.ts` | long-press táctil (iOS no dispara `contextmenu`) + clic derecho → menú global; suprime el click sintético y el doble disparo en Android. |
| `useVoxAudio.ts` | karaoke por stems con Web Audio (`/api/vox/process`, `/stems/...`). **Backend inexistente** → no funciona. |
| `useLazyCaching.ts` | ingesta a "Spectra" (`/spectra/ingest-remote`). **Backend inexistente.** Lo usan Home e InternetArchivePage. |
| `useKaraokeSync.ts` | **sin uso** (era de `KaraokeView`). |

## Layouts y páginas

- `layouts/ImmersiveLayout.jsx` (+ `.css`): shell de la app autenticada: `Sidebar`
  (desktop), `MobileHeader` / `DesktopHeader`, `PlayerSheet` (mini-player + fullscreen),
  `ContextMenu`, `AddToPlaylistModal`, `AmbientBackground`. Detecta páginas con fondo propio.
- `layouts/AuthLayout.jsx`: marco de login/registro/legal.

| Página | Qué hace | Backend |
|--------|----------|---------|
| `pages/HomePage.tsx` (+ `components/home/views/HomeAllView.jsx`) | Home: "Volver a escuchar", selección rápida, shelves | `/home`, `/music/albums`, `/tracks/listen-again` |
| `pages/SearchPage.tsx` | búsqueda con `UniversalCard` / `ArtistCard` | `/search/:q` |
| `pages/ArtistPage.tsx` | perfil + discografía | `/artists/:mbid/discography` |
| `pages/AlbumPage.jsx` | detalle de álbum, play, report de portada | `/albums/:mbid` |
| `pages/InternetArchivePage.jsx` | item de archive.org con audio directo | **`archive.org/metadata` directo desde el navegador** |
| `pages/LibraryPage.jsx` | playlists y likes (lista virtualizada) | `/playlists`, `/music/likes/detailed` |
| `pages/PlaylistPage.jsx` | detalle, drag&drop, likes, renombrar, borrar | `/playlists/:id…` |
| `pages/ProfilePage.jsx` | perfil y **borrado de cuenta** | `DELETE /auth/me` |
| `pages/UploadPage.jsx` | subir música | `/albumes`, **`POST /uploads/musica` (no existe)** |
| `pages/LoginPage.jsx`, `RegisterPage.jsx`, `TermsPage.jsx`, `PrivacyPage.jsx` | auth y legales | `/auth/*` |

CSS de páginas: `Library.css`, `search.css`, `terms.css`, `upload.css`, `ImmersiveLayout.css`
(este último duplicado en `pages/` y `layouts/`). **No importados:** `HomePage.css`, `Auth.css`, `App.css`.

## Reproductor (UI)

- `components/PlayerSheet.jsx`: hoja deslizable (framer-motion) que contiene el mini
  `PlayerBar` y el `FullScreenPlayer`. Usa `y` **numérico en px** (no `calc(dvh)`): ese era
  el bug de la "pantalla negra" al cerrar.
- `components/PlayerBar.jsx`: barra/píldora inferior. Tocar una zona **no interactiva**
  abre el fullscreen (único punto de apertura, evita doble toggle).
- `components/FullScreenPlayer.jsx` (+ `.css`): portada, controles, cola, letra
  (`AmLyricsView`), acento de color por pista, gestos (abajo cierra, arriba abre cola).
- `components/AmLyricsView.jsx`: wrapper del web component `<am-lyrics>`; offset de
  sincronía por pista en `localStorage`; loop rAF que alimenta el tiempo; clic en verso = seek.
- `components/embeds/YouTubeEmbed.tsx`: wrapper de la IFrame API de YouTube con handle
  imperativo (play/pause/seek/volume). Los demás (`SpotifyEmbed`, `SoundCloudEmbed`,
  `ArchiveAudio`, y el barrel `index.ts`) **no se usan** fuera del barrel.

## Menú contextual

`components/ContextMenu.jsx` (render vía `Portal`) + `ContextMenuContext` + los dos hooks
de long-press. Acciones: reproducir, añadir a cola/playlist, ir a artista/álbum, quitar de
playlist (opción inyectada), acciones de álbum (carga lazy con `utils/albumTracks.js`).

## Componentes vivos (resto)

`Sidebar`, `MobileHeader` (+ `MobileDrawer`), `DesktopHeader` (+ `DesktopSearch`),
`SearchInput`, `Shelf`, `VirtualSongList` + `LibraryItem`, `LikeButton`, `MiniVisualizer`,
`ConfirmModal`, `PlaylistNameModal`, `AddToPlaylistModal`, `AmbientBackground`, `Portal`,
`AlbumCard.jsx` (en ArtistPage, junto a `cards/AlbumCard.tsx`), `ArtistCard.jsx`,
`cards/UniversalCard.tsx`, `cards/ArtistCard.tsx`, `cards/ListenAgainCard.jsx`,
`cards/QuickSelectionCard.jsx`, `skeletons/SkeletonSongList.jsx`.
Nota: `DesktopSearch` y `MobileHeader` llaman a `/search/suggestions`, que **no existe**.

## Tipos y utilidades

- `types/music.ts`: **`UnifiedTrack`** (contrato universal de pista, inspirado en el `Song`
  de MusicKit: `id`, `trackName`, `artistName`, `coverArtUrl`, `platform`, `sourceType`,
  `playbackUrl`, `previewUrl`, `videoId`, `attributes`… + campos legacy). `types/index.ts`: sin uso.
- `utils/trackNormalization.ts`: `normalizeTrack()` de cualquier forma (API, IA, playlist) a `UnifiedTrack`.
- `utils/coverArt.ts`: `getCoverSrc()` (fuente única de portada) y `getColorSourceSrc()` (same-origin para canvas).
- `utils/extractColors.ts`: paleta en el cliente (histograma cuantizado en canvas).
- `utils/imageUtils.js`: `getOptimizedImageUrl()` → `/api/v1/images/optimize` (solo rutas locales).
- `utils/albumTracks.js`: normaliza tracks de `GET /albums/:id` y carga lazy.
- `utils/toast.ts`: avisos efímeros (inserta texto, nunca HTML).
- `utils/artwork.ts`: placeholders `{w}x{h}` estilo MusicKit (solo lo usa `SmartArtwork`, muerto).
- `utils/trackAdapters.ts`: **sin uso**.

## Estilos

`main.tsx` importa `styles/design-system.css` e `index.css` (que hace `@import` de
`styles/design-tokens.css`). `styles/glass.css` (glassmorphism) se importa en casi todas
las páginas; `styles/cards.css` solo desde cards muertas; `styles/animations.css` sin uso.
`AppBlur.css` lo importa `App.tsx`.

## Build y PWA

- `npm run build` → `dist/`. La PWA se auto-actualiza, pero un service worker viejo
  (p.ej. de una sesión de dev en `localhost:3000`) puede servir un bundle obsoleto: fue la
  causa de "portadas erróneas / rana". Remedio del usuario: DevTools → Application →
  Service Workers → Unregister + Clear site data.

## Código muerto

Nadie importa estos ficheros (verificado con grep de imports, nov-2026). Son candidatos a
borrar, pero confirma antes con un grep por si se añadió un uso:

```
api/searchCache.js                     components/HomeShelf.jsx
components/BottomNav.jsx               components/IaAlbumCard.jsx
components/Card.jsx                    components/InstallPrompt.jsx
components/DynamicBackground.jsx (+ workers/bgWorker.js, solo lo usa este)
components/FilterChips.jsx             components/KaraokeView.jsx (sustituido por AmLyricsView)
components/FullScreenPlayerLyrics.css  components/LiquidFilter.jsx
components/GlobalBackground.jsx        components/MobileMenuSheet.jsx
components/MobileNav.jsx               components/OptimizedImage.jsx
components/ProtectedRoute.jsx (duplicado del inline de App.tsx)
components/SongListItem.jsx            components/ViewControls.jsx
components/WaveformCanvas.jsx          components/audio/MiniWaveform.jsx
components/cards/{ArchiveAlbumCard,LocalAlbumCard,LocalArtistCard,LocalSongCard,SongGridCard,SongShelfCard}.jsx
components/common/SmartArtwork.tsx     components/embeds/{index.ts,SpotifyEmbed,SoundCloudEmbed,ArchiveAudio}
components/home/{ChipsCarousel,ListGrid,MediaCarousel,SectionBlock}.jsx
hooks/useKaraokeSync.ts                types/index.ts
utils/trackAdapters.ts                 utils/artwork.ts (solo vía SmartArtwork)
styles/animations.css                  pages/{HomePage,Auth}.css, App.css
reproductorestiloapple.html            (prototipo HTML "Bundled Page" del player estilo Apple)
pages/favImage.jpg                     (sin referencias)
```

Además, en `FullScreenPlayer.jsx` el estado `lyricsData` se sigue pidiendo a
`/lyrics/:mbid` pero **ya no se pinta** (solo se usan `lyricsLoading`/`lyricsError` como
puerta): las letras visibles las busca el web component. Ver [08](08-flujos-reproduccion-portadas-letras.md#3-letras).
