#!/usr/bin/env bash
# =============================================================================
# TidolCore — Script de despliegue al VPS
# Uso: ./deploy.sh [--full | --update]
#   --full    : primera instalación (sincroniza todo, construye, lanza)
#   --update  : actualización (solo sincroniza y reconstruye imágenes cambiadas)
# =============================================================================
set -euo pipefail

VPS="mi-vps"
REMOTE_DIR="/opt/tidolcore"
LOCAL_WORKSPACE="$(cd "$(dirname "$0")" && pwd)"
MODE="${1:---full}"

echo "==> Modo: $MODE"
echo "==> Sincronizando código al VPS ($VPS:$REMOTE_DIR)..."

# ---------------------------------------------------------------------------
# 1. Rsync: excluye artefactos pesados
# ---------------------------------------------------------------------------
rsync -avz --progress \
    --exclude='tidol-workspace/target/' \
    --exclude='tidol-workspace/tidol-frontend/node_modules/' \
    --exclude='tidol-workspace/tidol-frontend/dist/' \
    --exclude='tidol-workspace/plugins/provider-ai/models/' \
    --exclude='tidol-workspace/venv/' \
    --exclude='tidol-workspace/.venv/' \
    --exclude='tidol-workspace/storage/' \
    --exclude='tidol-workspace/covers/' \
    --exclude='tidol-workspace/bad_engine/' \
    --exclude='.git/' \
    "$LOCAL_WORKSPACE/" \
    "$VPS:$REMOTE_DIR/"

echo ""
echo "==> Código sincronizado."

# ---------------------------------------------------------------------------
# 2. Verificar .env en el VPS
# ---------------------------------------------------------------------------
ENV_EXISTS=$(ssh "$VPS" "test -f $REMOTE_DIR/.env && echo yes || echo no")
if [ "$ENV_EXISTS" = "no" ]; then
    echo ""
    echo "AVISO: No existe $REMOTE_DIR/.env en el VPS."
    echo "       1. Copia la plantilla:  scp $LOCAL_WORKSPACE/.env.production $VPS:$REMOTE_DIR/.env"
    echo "       2. Edita los valores:   ssh $VPS 'nano $REMOTE_DIR/.env'"
    echo "       3. Vuelve a ejecutar:   ./deploy.sh $MODE"
    exit 1
fi

# ---------------------------------------------------------------------------
# 3. Build y arranque en el VPS
# ---------------------------------------------------------------------------
echo ""
echo "==> Construyendo imágenes y levantando servicios en el VPS..."

# Pasamos MODE como variable al script remoto
ssh "$VPS" DEPLOY_MODE="$MODE" bash << 'REMOTE'
set -euo pipefail
cd /opt/tidolcore

# Cargar variables de entorno del .env
set -a; source .env; set +a

# En un full deploy (o si MariaDB no está corriendo): arrancar BD primero
# El build del backend necesita MariaDB en 127.0.0.1:3306 (network: host)
MARIADB_RUNNING=$(docker ps -q -f name=tidol-mariadb 2>/dev/null || true)

if [ "$DEPLOY_MODE" = "--full" ] || [ -z "$MARIADB_RUNNING" ]; then
    echo "--- Arrancando MariaDB (necesaria para compilar SQLx)..."
    docker compose up -d mariadb redis

    echo "--- Esperando que MariaDB esté lista..."
    RETRIES=30
    until docker compose exec -T mariadb healthcheck.sh --connect --innodb_initialized 2>/dev/null; do
        RETRIES=$((RETRIES - 1))
        if [ "$RETRIES" -le 0 ]; then
            echo "ERROR: MariaDB no arrancó a tiempo."
            exit 1
        fi
        echo "    Esperando... ($RETRIES intentos restantes)"
        sleep 5
    done
    echo "--- MariaDB lista."

    echo "--- Verificando esquema de BD..."
    TABLE_COUNT=$(docker compose exec -T mariadb \
        mysql -u tidol_admin -p"${MARIADB_PASSWORD}" tidol \
        -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='tidol';" \
        --skip-column-names 2>/dev/null || echo "0")
    TABLE_COUNT=$(echo "$TABLE_COUNT" | tr -d '[:space:]')

    if [ "$TABLE_COUNT" = "0" ]; then
        echo "    BD vacía — importando schema_full.sql..."
        docker compose exec -T mariadb \
            mysql -u tidol_admin -p"${MARIADB_PASSWORD}" tidol \
            < schema_full.sql
        echo "    Esquema importado correctamente."
    else
        echo "    BD ya tiene $TABLE_COUNT tabla(s), omitiendo importación."
    fi
fi

echo ""
echo "--- Construyendo imágenes Docker..."
docker compose build

echo ""
echo "--- Levantando todos los servicios..."
docker compose up -d --remove-orphans

echo ""
echo "--- Estado final de los contenedores:"
docker compose ps
REMOTE

echo ""
echo "==> Despliegue completado."
echo "==> Disponible en: https://tidol.duckdns.org"
