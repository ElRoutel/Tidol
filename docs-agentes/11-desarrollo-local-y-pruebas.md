# 11 — Desarrollo local y pruebas

[← Índice](INDICE.md)

## Requisitos

- Rust (la imagen usa 1.89), `sqlx-cli 0.9` (`~/.cargo/bin/cargo-sqlx`) para regenerar `.sqlx/`.
- MariaDB local con la BD `tidol` (usuario `tidol_admin`, con permisos **solo** sobre `tidol.*`).
- Node 20+ para el frontend.
- `tidol-workspace/.env` (git-ignorado) con al menos `DATABASE_URL` y `JWT_SECRET`;
  opcionalmente `YOUTUBE_API_KEY` para poder reproducir.

## Arranque rápido: `dev.sh` (raíz del repo)

```bash
./dev.sh            # backend + frontend; Ctrl-C para todo
./dev.sh backend    # solo tidol-server (compila y ejecuta el binario desde tidol-workspace/)
./dev.sh frontend   # solo Vite
./dev.sh check      # .env, MariaDB y puertos, sin arrancar nada
```
Comprueba `.env` y que MariaDB responda (no la arranca: `sudo systemctl start mariadb`),
espera la misma prueba de vida que el deploy (`/auth/me` → 401) y deja el log en
`tidol-workspace/target/dev-logs/backend.log`. `PORT`, `VITE_PORT` y `RELEASE=1` opcionales.

**Trampa:** con MariaDB ≥ 11.4 en local, `cargo sqlx prepare` puede fallar con
*"Transport endpoint is not connected (os error 107)"* (negociación TLS de sqlx-cli). Solución
sin tocar el `.env`: `DATABASE_URL="${DATABASE_URL}?ssl-mode=disabled" cargo sqlx prepare --workspace`.
El servidor (sqlx 0.7) conecta sin problema.

## Backend

```bash
cd tidol-workspace
cargo build                       # no necesita BD (SQLX_OFFLINE=true en .cargo/config.toml)
cargo run -p tidol-server         # escucha en :3000 por defecto (PORT)
cargo build -p provider-lyrics    # si quieres que cargue el plugin desde target/debug
```

- El binario es **`tidol-server`** (no `tidol-core`, que es una lib).
- `PLUGINS_DIR` por defecto apunta a `tidol-workspace/target/debug`.
- Al arrancar ejecuta las migraciones idempotentes de `TidolCore::new` sobre tu BD.
- Si cambias una `query!`: `cargo sqlx prepare --workspace` (necesita tu BD ya migrada) y
  commitea `.sqlx/`. Sin eso, `cargo build` falla en limpio.

## Frontend

```bash
cd tidol-workspace/tidol-frontend
npm install
npm run dev      # Vite en 0.0.0.0:5173; proxy /api → http://localhost:3000
npm run build    # tsc -b && vite build
npm run lint
```

Si "ves cosas viejas" en el navegador: es el service worker de la PWA. Unregister + Clear
site data.

## REPL

```bash
cargo run -p tidol-shell                        # modo local sobre la BD del .env
cargo run -p tidol-shell -- --remote prod       # modo prod (token en el keyring)
```
Ver [09](09-tidol-shell.md).

## Pruebas

| Suite | Comando | Necesita |
|-------|---------|----------|
| Unitarias del core (errores, auth/JWT/argon2, `parse_lrc`, `normalize_query`, media, user_data) | `cargo test -p tidol-core` | nada (usan `new_disconnected`: pool perezoso a un puerto cerrado) |
| Server (mapeo `ServerError`, middleware de auth de extremo a extremo) | `cargo test -p tidol-server` | nada (feature `test-util`) |
| Shell (parser que nunca paniquea, ejecución con mocks) | `cargo test -p tidol-shell` | nada |
| Proveedores (urls de embed, etc.) | incluidas en `cargo test -p tidol-core` | nada |
| **Integración con BD** (`tidol-core/tests/db_integration.rs`) | ver abajo | MariaDB desechable |

Integración:
```bash
cd tidol-workspace
./scripts/test-db.sh start     # MariaDB sin root en 127.0.0.1:3307, datadir en target/test-db,
                               # esquema clonado de la BD dev con --no-data
TIDOL_TEST_DATABASE_URL='mysql://root@127.0.0.1:3307/tidol_test' \
    cargo test -p tidol-core --features db-tests
./scripts/test-db.sh stop
```
La suite se niega a correr si la URL no contiene `test`. No hay sudo sin contraseña en la
máquina del dev y `tidol_admin` no puede crear BDs: por eso existe la instancia desechable.

**No hay tests de frontend** (ni Vitest ni Playwright) ni CI configurado: todo se verifica
a mano. `tidol-workspace/test_security.py` es un script manual antiguo (y contiene
credenciales; ver [12](12-pendientes-y-deuda-tecnica.md#p0--seguridad)).

## Comprobación antes de commitear (lo que hace el deploy)

```bash
cd tidol-workspace && SQLX_OFFLINE=true cargo check -q --bin tidol-server
cargo test -p tidol-core -p tidol-server -p tidol-shell
cd tidol-frontend && npm run build
```
