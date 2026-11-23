# 02 — Reglas y convenciones (léelo antes de cambiar nada)

[← Índice](INDICE.md)

## 1. Reglas legales absolutas

El dueño del proyecto las fijó el 29-jun-2026 como **no negociables**:

1. **Nunca** propongas ni uses `yt-dlp`, `youtube-dl`, `rusty_ytdl`, Piped, Invidious,
   cookies de YouTube, PO tokens, librespot, desencriptado de Deezer ni nada parecido.
2. **Nunca** crees endpoints que sirvan o proxeen audio con copyright. La única fuente de
   audio directo permitida es **Internet Archive** (CC / dominio público). Jamendo
   (licencias CC) también se considera legal, pero hoy no está conectado.
3. Usa **solo APIs oficiales y documentadas** (YouTube Data API v3 con *API key*, Spotify
   Web API, etc.). Reproducción de YouTube/Spotify/SoundCloud = **su IFrame oficial**.
4. Si algún día vuelve la alineación por IA (Whisper, `plugins/provider-ai`), debe correr
   **solo** sobre audio de Internet Archive/Jamendo, nunca sobre audio descargado.
5. La estética **glassmorphism** es un valor de marca: no la elimines al rediseñar.

Corolario práctico: el endpoint `/api/v1/stream/` y similares **no deben volver**.
`embedResolver.ts` ignora explícitamente URLs `/api/v1/stream/` legadas.

## 2. Estilo y convenciones de código

- **Español** en comentarios, mensajes de error de dominio y commits (los nombres de
  funciones/tipos están en inglés). Mantén el idioma del fichero que tocas.
- Los comentarios explican el **porqué** y suelen contar el bug que motivó el cambio
  ("Antes … ; ahora …"). Es una convención fuerte del repo: **sigue haciéndolo** y no
  borres esos comentarios al refactorizar salvo que el código que explican desaparezca.
- Commits estilo *conventional commits* en español: `feat(scope): …`, `fix(scope): …`,
  `refactor(core/server): …`, `chore: …`.
- Rust:
  - `tracing` para logs (no `println!`) en core/server/shell. `bad_engine` aún usa `println!`.
  - Toda llamada HTTP saliente lleva **timeout explícito** (fue fuente de cuelgues).
  - `tidol-shell` tiene `#![deny(clippy::unwrap_used)]`: **cero pánicos** provocables
    desde el prompt.
  - Errores de dominio como enums (`thiserror`), cada uno documenta a qué status HTTP se
    mapea; el **mensaje (`Display`) es el cuerpo** de la respuesta.
- Frontend: mezcla de `.jsx` y `.tsx`. El código nuevo tiende a TypeScript. Hay Tailwind
  + CSS propio (`styles/design-system.css`, `glass.css`, `design-tokens.css`).

## 3. Contratos de "línea base"

Muchos tests llevan comentarios del tipo *"línea base (`e46be8bb`)"*. Significa: el
refactor core/server **no debía cambiar ningún comportamiento observable** respecto al
commit `e46be8bb`, y los tests fijan exactamente:

- los **status HTTP** de cada error (p.ej. sin `JWT_SECRET` → 500, no 401),
- los **cuerpos** (p.ej. `create_playlist` con error de BD devuelve **texto plano**
  `"Error DB: {e}"`, no JSON),
- los textos `Display` de `TidolError`,
- la semántica de `parse_lrc` (décimas/centésimas/milésimas),
- los parámetros de argon2 (`Argon2::default()`: Argon2id v19, m=19456, t=2, p=1).

El frontend depende de esas formas. Si necesitas cambiar un contrato, **cambia el test
a propósito** y revisa el consumidor en el front; no lo "arregles" para que pase.

## 4. Reglas operativas aprendidas a golpes

- **Si cambias una `sqlx::query!`**, regenera la caché: `cd tidol-workspace && cargo sqlx
  prepare --workspace` (contra la BD de desarrollo ya migrada) y **commitea `.sqlx/`**. Si
  no, el build del VPS falla tras varios minutos. Ver [05](05-base-de-datos.md).
- **Cambio de esquema** = (1) `ALTER` en la BD local, (2) migración idempotente en
  `TidolCore::new` (`ADD COLUMN IF NOT EXISTS` + backfill) y/o fichero en `migrations/`,
  (3) `cargo sqlx prepare --workspace`, (4) actualizar `schema_full.sql`.
- **Nunca** añadas `--delete` al `rsync` de `deploy.sh`: el `.env` de producción solo
  existe en el VPS y se borraría.
- **Chequeos de disco en el VPS**: pregunta a `docker info -f '{{.DockerRootDir}}'`,
  no mires `/` (Docker y containerd viven en `/mnt/storage`).
- **No re-resuelvas portadas en masa vía iTunes**: bloquea IPs y una vez anuló portadas
  buenas (se restauró desde backup).
- **No ejecutes `cargo run` desde el servidor** para tareas de fondo (llenaba el disco);
  se ejecuta el binario precompilado (`BAD_ENGINE_BIN`).
- La prueba de vida buena del deploy es `GET /api/v1/auth/me` **sin token → 401**. Un 500
  ahí significa JWT roto (el healthcheck de Docker no lo detecta).
- No metas secretos en el repo ni en estos documentos.
