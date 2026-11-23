# 10 — Infraestructura y despliegue

[← Índice](INDICE.md)

## El VPS

- Alias SSH **`mi-vps`** (usuario `admin`, sudo sin contraseña). Prod: `https://tidol.duckdns.org`.
- Directorio de despliegue: **`/mnt/storage`** (ahí viven `compose.yaml`, el código y el `.env` real).
- Dos discos: `/` de **20 GB** y `/mnt/storage` de **100 GB**. Docker (`data-root`) **y**
  containerd (`root`) se movieron a `/mnt/storage` (jul-2026) porque los builds de Rust
  llenaban `/`. **Para chequear disco, pregunta a `docker info -f '{{.DockerRootDir}}'`**.
- Lo que engorda es la **caché de build** (decenas de GB). Mantenimiento:
  `docker builder prune -af`, `docker image prune -f`.
- El puerto 22 está **filtrado por IP** en el firewall/security group: si cambia la IP
  pública del dev, hay que permitirla de nuevo (`deploy.sh` lo detecta y lo dice).

## Compose

`compose.yaml` (raíz), proyecto `tidolcore`, red `tidol-net`:

| Servicio | Imagen | Notas |
|----------|--------|-------|
| `mariadb` | `mariadb:11.4` | solo `127.0.0.1:3306`; volumen `mariadb-data`; healthcheck oficial |
| `redis` | `redis:7.4-alpine` | `maxmemory 512mb allkeys-lru`; **el backend no lo usa** |
| `tidol-core` | build `tidol-workspace` + `tidol-core/Dockerfile` → `tidolcore/backend` | réplicas `${TIDOL_REPLICAS:-1}`, límites 2 CPU / 1 GB; volúmenes `tidol-covers:/app/covers`, `tidol-storage:/app/storage`; solo `expose 8080` |
| `tidol-frontend` | build `tidol-workspace/tidol-frontend` → `tidolcore/frontend` | Nginx :80 |
| `caddy` | `caddy:2.9-alpine` | publica 80/443/443udp; monta `Caddyfile.prod` |

Ojo: el **servicio se llama `tidol-core`** aunque el binario ya es `tidol-server`.
Los fallbacks de contraseña de MariaDB en el compose son valores fijos (ver [12](12-pendientes-y-deuda-tecnica.md#p0--seguridad)).

### Imagen del backend (`tidol-workspace/tidol-core/Dockerfile`)
1. `rust:1.89-slim-bookworm`, `COPY . .` (filtrado por `tidol-workspace/.dockerignore`, que
   excluye frontends, `bad_engine`, `*.py`, `*.sh`, `target/`, `provider-ai/models`…).
2. `SQLX_OFFLINE=true` → `cargo build --release --bin tidol-server` y los tres plugins.
3. Runtime `debian:bookworm-slim` + `curl`; usuario no-root `appuser` (uid 10001);
   `VOLUME /app/covers` declarado **después** del `chown` para que el volumen nazca escribible.
4. `ENTRYPOINT /app/tidol-server`, `PORT=8080`, `PLUGINS_DIR=/app/plugins`.

### Imagen del frontend
`tidol-frontend/Dockerfile`: `node:20-alpine` build → `nginx:alpine` con `nginx.conf` (fallback SPA).

## Caddy

- **`Caddyfile.prod`** (producción): `tidol.duckdns.org` con TLS automático (HTTP-01),
  h1/h2/h3, `/api/*` → `tidol-core:8080` con `lb_policy least_conn` y timeouts
  (read/write 30 s), resto → `tidol-frontend:80`, gzip/zstd, HSTS preload, nosniff,
  `X-Frame-Options SAMEORIGIN`. El `email` global es un placeholder (`admin@tidol.example.com`).
- **`Caddyfile`** + **`Dockerfile.caddy`** (desarrollo en la LAN): Caddy compilado con el
  plugin DNS de DuckDNS; `tidol.lan` redirige a DuckDNS y DuckDNS hace proxy a
  `127.0.0.1:5173` (el Vite dev server). **Contiene el token de DuckDNS en claro**.
- `root.crt`: certificado raíz (probablemente la CA local de Caddy para `tidol.lan`).

## `deploy.sh`

Uso: `./deploy.sh [--full | --update] [--skip-check] [--prune]` desde la raíz del repo.

1. **Pre-vuelo local**: SSH con `mi-vps`; existe `.sqlx/`; `cargo check --bin tidol-server`
   en modo offline (salvo `--skip-check`) para no descubrir una caché rota en el VPS.
2. **rsync** del repo a `/mnt/storage` con excludes (`.git`, `target`, `node_modules`,
   `dist`, `tidol-tv-lite*`, `provider-ai`, `venv`, `storage`, `covers`, `bad_engine`).
   **Nunca `--delete`** (borraría el `.env` del VPS).
3. En el VPS (script por heredoc):
   - valida `.env`: `JWT_SECRET`, `MARIADB_PASSWORD`, `MARIADB_ROOT_PASSWORD` no vacíos ni `CAMBIA_ESTO…`;
   - calcula `TIDOL_REPLICAS × DATABASE_MAX_CONNECTIONS`;
   - comprueba espacio libre (≥ 8 GB) en el `DockerRootDir` (`--prune` limpia antes);
   - **construye antes de tocar la BD** (si el build falla, prod sigue igual);
   - arranca MariaDB/Redis, espera healthcheck, valida pool ≤ `max_connections`;
   - BD vacía: `--full` importa `schema_full.sql`; `--update` **aborta** (síntoma de BD equivocada);
   - aplica `migrations/*.sql` en orden;
   - `docker compose up -d --remove-orphans`;
   - verificación real: `curl /api/v1/auth/me` desde el contenedor (`--index 1`) debe dar **401**.
4. Verificación externa: `GET /` → 200 y `/api/v1/auth/me` → 401 por internet.

Todos los `docker compose exec -T` llevan `</dev/null` o `< fichero`: sin eso se comían el
stdin del heredoc y el resto del script no se ejecutaba (bug real, commit `4f6d2dae`).

## Variables de entorno

Plantilla: **`.env.production`** (raíz, versionada, solo placeholders `CAMBIA_ESTO…`).
El `.env` real vive **solo** en `/mnt/storage/.env` del VPS.

| Variable | Uso |
|----------|-----|
| `MARIADB_ROOT_PASSWORD`, `MARIADB_PASSWORD` | credenciales de MariaDB |
| `DATABASE_MAX_CONNECTIONS` | pool **por réplica** (50 por defecto en compose) |
| `JWT_SECRET` | firma de tokens (`openssl rand -base64 64`) |
| `RUST_LOG`, `TIDOL_REPLICAS` | logs y nº de réplicas |
| `YOUTUBE_API_KEY` | Data API v3 (**sin ella no hay reproducción de YouTube**) |
| `SPOTIFY_CLIENT_ID/SECRET`, `SOUNDCLOUD_CLIENT_ID` | vacíos hoy |
| `PROXY_POOL` | proxies de salida (sin uso real) |
| `DUCKDNS_API_TOKEN` | DNS challenge (solo el Caddy de dev lo necesitaría) |
| `LASTFM_API_KEY` | radio y recomendaciones (Last.fm, por HTTPS). Sin ella, radio vacía y Home con recomendaciones aleatorias. Compose la pasa desde 2026-11-23 (antes no, y se usaba una clave escrita en el código) |
| `MARIADB_ROOT_PASSWORD`, `MARIADB_PASSWORD` | **obligatorias** (`${VAR:?}` en compose desde 2026-11-23: si faltan, el deploy falla con un mensaje claro) |
| `DUCKDNS_API_TOKEN` | solo el `Caddyfile` de desarrollo (reto DNS de DuckDNS) |
| (no en la plantilla) `JAMENDO_CLIENT_ID`, `BAD_ENGINE_BIN` | plugins/prefetch sin uso en prod |
| (no en la plantilla) `ITUNES_ENABLED` | `false`/`0` desactiva iTunes en el core (recomendado en el VPS, donde está bloqueado); sin ella, un cortacircuitos lo omite 10 min tras cada fallo |

En local, `tidol-workspace/.env` (git-ignorado) aporta `DATABASE_URL` y demás.

## Trampas conocidas

- ✅ **Healthcheck** (arreglado 2026-11-23): antes hacía `curl -s http://localhost:8080/` (404) sin
  `-f` y el contenedor salía *healthy* con la app rota. Ahora `curl -f` contra **`GET /api/v1/health`**
  (`SELECT 1` en la BD con timeout de 2 s → 200, o 503). Ojo: la prueba de vida de `deploy.sh`
  (`/auth/me` sin token → 401) sigue aparte y **no** detecta un `JWT_SECRET` roto ni la BD caída
  (sin token el middleware responde 401 antes de mirar nada).
- **Build con cargo-chef** (2026-11-23): las dependencias se compilan en una capa propia que solo se
  invalida si cambian `Cargo.toml`/`Cargo.lock`; un cambio de código ya no recompila las ~200
  dependencias. Se eligió cargo-chef (capas normales) y no `RUN --mount=type=cache` porque este
  exige BuildKit/buildx, que no está en todas las máquinas. `cargo-chef` fijado a 0.1.72 (anterior a
  Rust 1.89): no subirlo sin probar el build.
- **Sin `JWT_SECRET`** el servidor arranca y responde, pero toda ruta autenticada da 500.
- **Perfil de release**: `lto = "thin"` en el `Cargo.toml` del workspace (los perfiles de los
  miembros se ignoran). El build del VPS usa Rust 1.89: `tidol-core` declara `rust-version = "1.89"`
  para que Cargo no elija dependencias que solo compilan en el Rust más nuevo del dev.
- **Pool × réplicas**: 100 × 3 = 300 > 151 `max_connections` por defecto de MariaDB.
- **Cachés**: YouTube y pistas similares tienen un segundo nivel en **Redis** compartido por las
  réplicas (`REDIS_URL`, ver [03](03-backend-tidol-core.md#cachers)); el límite de MusicBrainz usa
  una ventana global en Redis. Siguen siendo por réplica: misses de portadas en memoria (30 min,
  pero también en `cover_map`), Internet Archive y el dedupe de prefetch. Si Redis cae, el backend
  sigue funcionando solo con memoria (no hay que reiniciarlo: reconecta solo).
- **`hydrate_unknown_tracks`** corre en cada réplica al arrancar.
- **Volumen de portadas** compartido por todas las réplicas (escrituras concurrentes al mismo fichero posibles).
