#!/usr/bin/env bash
# =============================================================================
# TidolCore — Script de despliegue al VPS
#
# Uso: ./deploy.sh [--full | --update] [--skip-check] [--prune]
#   --full        : instalación / despliegue completo. Si la BD está vacía,
#                   importa schema_full.sql. Aplica migraciones.
#   --update      : actualización. NO bootstrapea el esquema: si la BD está
#                   vacía aborta (síntoma de que apuntas a la BD equivocada).
#   --skip-check  : omite la compilación local de verificación (más rápido,
#                   más ciego: una caché .sqlx desincronizada se descubriría
#                   ya en el VPS, tras minutos de build).
#   --prune       : antes de construir, libera espacio en el VPS
#                   (docker system prune -af). Útil cuando / se llena.
#
# Orden deliberado: se CONSTRUYE antes de tocar la BD. El build ya no depende
# de una MariaDB viva (SQLx compila offline desde `.sqlx/`), así que un build
# roto ya no deja producción a medias.
# =============================================================================
set -euo pipefail

VPS="mi-vps"
REMOTE_DIR="/mnt/storage"
LOCAL_ROOT="$(cd "$(dirname "$0")" && pwd)"
PROD_URL="https://tidol.duckdns.org"

# Espacio libre mínimo en el disco donde Docker construye. OJO: NO es `/`. En
# este VPS el data-root está movido a /mnt/storage/docker (el disco de 100 GB),
# precisamente porque el / de 20 GB se llenaba y mataba los builds. El script lo
# pregunta en caliente (`docker info`) en vez de suponerlo: si algún día vuelve a
# /var/lib/docker, el chequeo sigue apuntando al sitio correcto.
# La caché de build de Rust engorda rápido (hoy ~35 GB), de ahí el margen.
MIN_FREE_MB_DOCKER=8000

MODE="--full"
SKIP_CHECK=0
PRUNE=0
for arg in "$@"; do
    case "$arg" in
        --full|--update) MODE="$arg" ;;
        --skip-check)    SKIP_CHECK=1 ;;
        --prune)         PRUNE=1 ;;
        *) echo "argumento desconocido: $arg"; sed -n '2,20p' "$0"; exit 2 ;;
    esac
done

say()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok()   { printf '    \033[32m✓\033[0m %s\n' "$*"; }
die()  { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

say "Modo: $MODE"

# ---------------------------------------------------------------------------
# 0. Pre-vuelo LOCAL — fallar aquí es gratis; fallar en el VPS cuesta minutos
# ---------------------------------------------------------------------------
say "Pre-vuelo local"

# 0.a SSH primero: sin esto, el rsync moriría a medias con un error opaco.
#     (El firewall del VPS filtra el 22 por IP: si cambia tu IP pública, hay
#     que volver a permitirla en el security group.)
if ! ssh -o ConnectTimeout=10 -o BatchMode=yes "$VPS" true 2>/dev/null; then
    MI_IP="$(curl -4 -s --max-time 8 https://ifconfig.me || echo '¿?')"
    die "no hay SSH con '$VPS'.
       El puerto 22 del VPS está filtrado por IP y tu IP pública actual es: $MI_IP
       Permítela en el firewall/security group (puerto 22) y reintenta."
fi
ok "SSH con $VPS"

# 0.b El build del VPS compila SQLx contra la caché `.sqlx/`. Si esa caché no
#     coincide con las queries del código, el build falla EN EL VPS tras varios
#     minutos. Reproducimos aquí, en frío, esa misma compilación.
[ -d "$LOCAL_ROOT/tidol-workspace/.sqlx" ] || die "no existe tidol-workspace/.sqlx (la caché offline de SQLx). Genérala con: cargo sqlx prepare --workspace"
if [ "$SKIP_CHECK" -eq 0 ]; then
    echo "    Compilando en modo offline (igual que el Dockerfile)…"
    if ! (cd "$LOCAL_ROOT/tidol-workspace" && SQLX_OFFLINE=true cargo check -q --bin tidol-server 2>&1); then
        die "la compilación offline falla: la caché .sqlx no coincide con el código.
       Regenérala contra tu BD de desarrollo y commitea el resultado:
           cd tidol-workspace && cargo sqlx prepare --workspace"
    fi
    ok "compila offline con la caché .sqlx (el build del VPS no necesitará BD)"
else
    ok "compilación local omitida (--skip-check)"
fi

# ---------------------------------------------------------------------------
# 1. Rsync
#
# OJO: NUNCA añadir --delete. El .env de producción vive SOLO en el VPS
# ($REMOTE_DIR/.env) y no existe en el árbol local: --delete lo borraría.
#
# Los excludes importan: sin ellos se suben ~915 MB por despliegue
# (tidol-tv-lite* = 709 MB, el target/ de provider-ai…), y nada de eso entra
# siquiera al contexto de Docker (ver .dockerignore). Con estos, ~47 MB.
# ---------------------------------------------------------------------------
say "Sincronizando código → $VPS:$REMOTE_DIR"
rsync -az --info=stats1,progress2 \
    --exclude='.git/' \
    --exclude='tidol-workspace/target/' \
    --exclude='node_modules/' \
    --exclude='tidol-workspace/tidol-frontend/dist/' \
    --exclude='tidol-workspace/tidol-tv-lite/' \
    --exclude='tidol-workspace/tidol-tv-lite-backup/' \
    --exclude='tidol-workspace/plugins/provider-ai/' \
    --exclude='tidol-workspace/venv/' \
    --exclude='tidol-workspace/.venv/' \
    --exclude='tidol-workspace/storage/' \
    --exclude='tidol-workspace/covers/' \
    --exclude='tidol-workspace/bad_engine/' \
    "$LOCAL_ROOT/" "$VPS:$REMOTE_DIR/"
ok "código sincronizado"

# ---------------------------------------------------------------------------
# 2. Build + arranque en el VPS
# ---------------------------------------------------------------------------
say "Construyendo y levantando en el VPS"

ssh "$VPS" DEPLOY_MODE="$MODE" DO_PRUNE="$PRUNE" MIN_FREE_MB_DOCKER="$MIN_FREE_MB_DOCKER" bash << 'REMOTE'
set -euo pipefail
cd /mnt/storage

ok()  { printf '    \033[32m✓\033[0m %s\n' "$*"; }
die() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

# ── 2.a El .env y su contenido ──────────────────────────────────────────────
# No basta con que exista: un JWT_SECRET vacío o con el placeholder deja el
# servidor arrancado y "healthy" pero devolviendo 500 en TODA ruta autenticada
# (el core hace `jwt_secret.ok_or(AuthError::Internal)`). Es el fallo más
# silencioso que tiene este despliegue; por eso se valida antes de construir.
[ -f .env ] || die "no existe /mnt/storage/.env en el VPS.
       1. Copia la plantilla:  scp .env.production mi-vps:/mnt/storage/.env
       2. Rellena los valores: ssh mi-vps 'nano /mnt/storage/.env'"

set -a; source ./.env; set +a

for VAR in JWT_SECRET MARIADB_PASSWORD MARIADB_ROOT_PASSWORD; do
    VAL="${!VAR:-}"
    [ -n "$VAL" ]                  || die "$VAR está vacía en /mnt/storage/.env"
    case "$VAL" in
        CAMBIA_ESTO*) die "$VAR sigue con el placeholder de la plantilla en /mnt/storage/.env" ;;
    esac
done
ok ".env válido (JWT_SECRET y credenciales de BD presentes)"

REPLICAS="${TIDOL_REPLICAS:-1}"
MAXCONN="${DATABASE_MAX_CONNECTIONS:-50}"
TOTAL_CONN=$((REPLICAS * MAXCONN))
ok "réplicas=$REPLICAS × pool=$MAXCONN → $TOTAL_CONN conexiones a MariaDB"

# ── 2.b Disco ───────────────────────────────────────────────────────────────
# El build muere con "No space left on device" si se llena el disco donde Docker
# guarda su data-root. Ese disco NO es necesariamente `/`: aquí está movido a
# /mnt/storage/docker. Se lo preguntamos a Docker en vez de suponerlo.
DOCKER_DIR=$(docker info -f '{{.DockerRootDir}}' 2>/dev/null || echo /var/lib/docker)
free_mb() { df -Pm "$DOCKER_DIR" | awk 'NR==2 {print $4}'; }

FREE_MB=$(free_mb)
if [ "${DO_PRUNE:-0}" = "1" ]; then
    echo "    Liberando espacio (docker system prune -af)…"
    docker system prune -af --volumes=false >/dev/null || true
    FREE_MB=$(free_mb)
fi
if [ "$FREE_MB" -lt "$MIN_FREE_MB_DOCKER" ]; then
    die "solo quedan ${FREE_MB} MB libres en $DOCKER_DIR (mínimo ${MIN_FREE_MB_DOCKER} MB).
       El build de Rust morirá a mitad. Libera espacio y reintenta:
           ./deploy.sh $DEPLOY_MODE --prune
       o a mano:  ssh mi-vps 'docker builder prune -af'   (la caché de build es
       lo que más engorda: hoy son decenas de GB)"
fi
ok "espacio en $DOCKER_DIR: ${FREE_MB} MB libres"

# ── 2.c Build (SIN BD: SQLx compila offline desde .sqlx/) ───────────────────
# Se construye ANTES de tocar la BD: si el build falla, producción sigue
# exactamente como estaba.
echo ""
echo "--- Construyendo imágenes Docker (sin BD; SQLx offline)…"
docker compose build
ok "imágenes construidas"

# ── 2.d Base de datos ───────────────────────────────────────────────────────
echo ""
echo "--- Arrancando MariaDB y Redis…"
docker compose up -d mariadb redis

# OJO: este script llega a bash por stdin (heredoc del ssh). Todo
# `docker compose exec -T` SIN redirección de entrada se come el stdin, es
# decir, EL RESTO DE ESTE SCRIPT (el deploy terminaba "bien" sin migrar ni
# arrancar). De ahí los `</dev/null` y los `< fichero` de aquí abajo.
echo "--- Esperando a que MariaDB esté lista…"
RETRIES=30
until docker compose exec -T mariadb healthcheck.sh --connect --innodb_initialized </dev/null 2>/dev/null; do
    RETRIES=$((RETRIES - 1))
    [ "$RETRIES" -le 0 ] && die "MariaDB no arrancó a tiempo."
    echo "    Esperando… ($RETRIES intentos restantes)"
    sleep 5
done
ok "MariaDB lista"

# La contraseña va por MYSQL_PWD y no en la línea de comandos: así no aparece
# en el `ps` del VPS ni se rompe si lleva caracteres raros.
db() { docker compose exec -T -e MYSQL_PWD="$MARIADB_PASSWORD" mariadb \
           mariadb -u tidol_admin tidol "$@"; }

# El pool total no puede superar el max_connections real del servidor, o las
# réplicas empiezan a recibir "Too many connections" bajo carga.
MAXC=$(db --skip-column-names -e "SELECT @@max_connections;" </dev/null 2>/dev/null | tr -d '[:space:]')
if [ -n "$MAXC" ] && [ "$TOTAL_CONN" -gt "$MAXC" ]; then
    die "el pool total ($TOTAL_CONN = $REPLICAS réplicas × $MAXCONN) supera el
       max_connections de MariaDB ($MAXC). Baja DATABASE_MAX_CONNECTIONS o
       TIDOL_REPLICAS en /mnt/storage/.env."
fi
ok "pool total $TOTAL_CONN ≤ max_connections $MAXC"

TABLE_COUNT=$(db --skip-column-names -e \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='tidol';" \
    </dev/null 2>/dev/null | tr -d '[:space:]')
TABLE_COUNT="${TABLE_COUNT:-0}"

if [ "$TABLE_COUNT" = "0" ]; then
    if [ "$DEPLOY_MODE" = "--update" ]; then
        die "la BD 'tidol' está VACÍA y estás en --update.
       Un --update nunca bootstrapea el esquema (si la BD está vacía es que algo
       va mal: volumen equivocado, BD recreada…). Si es una instalación nueva:
           ./deploy.sh --full"
    fi
    echo "--- BD vacía: importando schema_full.sql…"
    db < schema_full.sql
    ok "esquema importado"
else
    ok "la BD ya tiene $TABLE_COUNT tabla(s)"
fi

# Migraciones idempotentes, en orden de nombre.
if compgen -G "migrations/*.sql" > /dev/null; then
    for MIGRATION in migrations/*.sql; do
        echo "--- Migración: $MIGRATION"
        db < "$MIGRATION"
    done
    ok "migraciones aplicadas"
fi

# ── 2.e Arranque ────────────────────────────────────────────────────────────
echo ""
echo "--- Levantando todos los servicios…"
docker compose up -d --remove-orphans
ok "servicios levantados"

# ── 2.f Verificación REAL ───────────────────────────────────────────────────
# `docker compose ps` no prueba nada: la HEALTHCHECK de la imagen hace
# `curl / ` (que responde 404) sin -f, así que el contenedor sale "healthy"
# aunque la app esté rota. La prueba de verdad: una ruta protegida SIN token
# debe devolver 401. Si devuelve 500, el JWT_SECRET no sirve; si no conecta,
# el backend está caído.
#
# Se pregunta con `curl` DESDE el propio contenedor tidol-core (su imagen
# runtime instala curl; la de caddy es alpine/busybox y su wget no soporta -S).
# `--index 1` es obligatorio: con TIDOL_REPLICAS>1 el servicio está escalado y
# `exec` sin índice falla.
echo ""
echo "--- Verificando el backend…"
CODE=""
for _ in $(seq 1 20); do
    CODE=$(docker compose exec -T --index 1 tidol-core \
        curl -s -o /dev/null -w '%{http_code}' --max-time 5 \
        http://localhost:8080/api/v1/auth/me </dev/null 2>/dev/null || true)
    # 000 = curl no pudo conectar todavía (el proceso aún no escucha).
    [ -n "$CODE" ] && [ "$CODE" != "000" ] && break
    sleep 3
done

case "$CODE" in
    401) ok "/api/v1/auth/me sin token → 401 (backend vivo y JWT operativo)" ;;
    500) die "/api/v1/auth/me devuelve 500: el backend arranca pero el JWT_SECRET
       no es válido. Revisa JWT_SECRET en /mnt/storage/.env.
       Logs:  ssh mi-vps 'cd /mnt/storage && docker compose logs --tail=50 tidol-core'" ;;
    ""|000)
         docker compose ps
         die "el backend no responde. Logs:
       ssh mi-vps 'cd /mnt/storage && docker compose logs --tail=80 tidol-core'" ;;
    *)   echo "    (aviso: /api/v1/auth/me devolvió $CODE, esperaba 401)" ;;
esac

echo ""
echo "--- Estado final:"
docker compose ps
REMOTE

# ---------------------------------------------------------------------------
# 3. Verificación desde fuera (lo que verá un usuario real)
# ---------------------------------------------------------------------------
say "Verificando desde internet"

FRONT=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$PROD_URL/" || echo "000")
API=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$PROD_URL/api/v1/auth/me" || echo "000")

[ "$FRONT" = "200" ] && ok "frontend  $PROD_URL/ → 200" \
                     || echo "    ✗ frontend $PROD_URL/ → $FRONT"
[ "$API" = "401" ]   && ok "API       $PROD_URL/api/v1/auth/me → 401 (correcto sin token)" \
                     || echo "    ✗ API $PROD_URL/api/v1/auth/me → $API (esperaba 401)"

if [ "$FRONT" = "200" ] && [ "$API" = "401" ]; then
    say "Despliegue completado — $PROD_URL"
else
    die "el despliegue terminó pero la verificación externa falla (frontend=$FRONT, api=$API).
       Revisa:  ssh $VPS 'cd $REMOTE_DIR && docker compose logs --tail=80'"
fi
