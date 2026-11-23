# Tidol — instrucciones para agentes

**Antes de explorar el código, lee `docs-agentes/INDICE.md`.** Es la guía del proyecto:
estado actual, arquitectura, qué hace cada fichero y la deuda técnica priorizada. Desde el
índice, ve solo al documento del tema que vas a tocar.

## Reglas que no se negocian (detalle en `docs-agentes/02-reglas-y-convenciones.md`)

- **Legal, embed-only:** nunca yt-dlp/youtube-dl/Piped/Invidious/cookies/librespot ni
  endpoints que sirvan o proxeen audio con copyright. Audio directo solo de Internet Archive
  (CC/PD). Reproducción de YouTube/Spotify/SoundCloud = su IFrame oficial.
- **SQLx offline:** si cambias una `sqlx::query!`, ejecuta
  `cd tidol-workspace && cargo sqlx prepare --workspace` y commitea `.sqlx/`.
- **Cambio de esquema:** migración idempotente (`migrations/` y/o `TidolCore::new`) +
  `cargo sqlx prepare` + actualizar `schema_full.sql`.
- **Deploy:** nunca añadir `--delete` al rsync de `deploy.sh`; la prueba de vida es
  `GET /api/v1/auth/me` sin token → 401.
- Los tests de "línea base" fijan status y cuerpos HTTP que el frontend consume: no los
  cambies para que pasen sin revisar el consumidor.
- No escribas secretos en el repo ni en `docs-agentes/`.
- Comentarios y commits en español; los comentarios explican el porqué (y el bug que lo motivó).

## Estructura mínima

- `tidol-workspace/` — workspace de Cargo (`tidol-core` lib, `tidol-server` bin HTTP,
  `tidol-shell` REPL, `plugins/`) y `tidol-frontend/` (React + Vite).
- Raíz — `compose.yaml`, `Caddyfile.prod`, `deploy.sh`, `schema_full.sql`, `migrations/`.

## Mantener la documentación

Si cambias la arquitectura o resuelves un pendiente, actualiza el documento afectado de
`docs-agentes/` (y su línea en `INDICE.md`; tacha lo resuelto en
`12-pendientes-y-deuda-tecnica.md`).
