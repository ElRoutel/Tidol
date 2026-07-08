#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# BD de prueba dedicada para `cargo test -p tidol-core --features db-tests`.
#
# Levanta una MariaDB desechable SIN root del sistema (datadir bajo target/,
# git-ignorado), clona el ESQUEMA (sin datos) de la BD de desarrollo declarada
# en .env, y deja lista la URL que esperan las pruebas:
#
#   ./scripts/test-db.sh start
#   TIDOL_TEST_DATABASE_URL='mysql://root@127.0.0.1:3307/tidol_test' \
#       cargo test -p tidol-core --features db-tests
#   ./scripts/test-db.sh stop
#
# Nunca toca la BD de desarrollo (solo la lee con mariadb-dump --no-data) ni,
# por supuesto, producción.
# ---------------------------------------------------------------------------
set -euo pipefail

BASE="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$BASE/target/test-db"
DATADIR="$DIR/data"
SOCK="$DIR/mariadb.sock"
PIDFILE="$DIR/mariadb.pid"
PORT="${TIDOL_TEST_DB_PORT:-3307}"
DBNAME="tidol_test"

start() {
    mkdir -p "$DIR"
    if [ ! -d "$DATADIR" ]; then
        echo "[test-db] Inicializando datadir…"
        mariadb-install-db --datadir="$DATADIR" \
            --auth-root-authentication-method=normal >/dev/null
    fi

    if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
        echo "[test-db] Ya está corriendo (pid $(cat "$PIDFILE"))."
    else
        echo "[test-db] Arrancando mariadbd en 127.0.0.1:$PORT…"
        mariadbd --datadir="$DATADIR" --socket="$SOCK" --pid-file="$PIDFILE" \
            --port="$PORT" --bind-address=127.0.0.1 \
            --skip-grant-tables=0 --log-error="$DIR/mariadb.err" &
        for _ in $(seq 1 50); do
            mariadb --socket="$SOCK" -u root -e "SELECT 1" >/dev/null 2>&1 && break
            sleep 0.2
        done
        mariadb --socket="$SOCK" -u root -e "SELECT 1" >/dev/null \
            || { echo "[test-db] mariadbd no respondió; ver $DIR/mariadb.err"; exit 1; }
    fi

    mariadb --socket="$SOCK" -u root \
        -e "CREATE DATABASE IF NOT EXISTS $DBNAME CHARACTER SET utf8mb4"

    # Clonar SOLO el esquema desde la BD de desarrollo (.env).
    DEV_URL="$(grep '^DATABASE_URL=' "$BASE/.env" | cut -d= -f2-)"
    DEV_USER="$(echo "$DEV_URL" | sed 's|mysql://\([^:]*\):.*|\1|')"
    DEV_PASS="$(echo "$DEV_URL" | sed 's|mysql://[^:]*:\([^@]*\)@.*|\1|')"
    DEV_DB="$(echo "$DEV_URL" | sed 's|.*/\([^/?]*\).*|\1|')"
    echo "[test-db] Clonando esquema de '$DEV_DB' → '$DBNAME'…"
    mariadb-dump --no-data --skip-comments -u "$DEV_USER" -p"$DEV_PASS" "$DEV_DB" \
        | mariadb --socket="$SOCK" -u root "$DBNAME"

    echo "[test-db] Lista: mysql://root@127.0.0.1:$PORT/$DBNAME"
}

stop() {
    if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
        kill "$(cat "$PIDFILE")"
        echo "[test-db] Parada."
    else
        echo "[test-db] No estaba corriendo."
    fi
}

case "${1:-start}" in
    start) start ;;
    stop) stop ;;
    *) echo "uso: $0 {start|stop}"; exit 1 ;;
esac
