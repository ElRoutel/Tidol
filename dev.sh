#!/usr/bin/env bash
# =========================================================================
# dev.sh — arranca Tidol en LOCAL (backend tidol-server + frontend Vite).
#
#   ./dev.sh            backend + frontend (Ctrl-C para todo)
#   ./dev.sh backend    solo tidol-server
#   ./dev.sh frontend   solo Vite (espera un backend ya levantado)
#   ./dev.sh check      solo comprueba requisitos (BD, .env, puertos)
#
# Variables opcionales: PORT (backend, 3000), VITE_PORT (5173), RELEASE=1
# (compila el backend en release; más lento de compilar, más fiel a prod).
#
# Por qué existe: arrancar a mano obligaba a recordar el orden (BD viva →
# server → esperar migraciones → Vite) y era fácil quedarse con un backend que
# "arranca" pero da 500 en toda ruta autenticada por faltar JWT_SECRET. La
# prueba de vida es la MISMA que usa deploy.sh: GET /api/v1/auth/me sin token
# debe responder 401 (un 500 ahí = JWT roto).
#
# No arranca MariaDB: necesita sudo (`sudo systemctl start mariadb`) y no
# queremos un script que pida contraseñas. Solo comprueba que responde.
# =========================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WS="$ROOT/tidol-workspace"
FRONT="$WS/tidol-frontend"
LOG_DIR="$WS/target/dev-logs"
PORT="${PORT:-3000}"
VITE_PORT="${VITE_PORT:-5173}"
MODE="${1:-all}"

c_ok=$'\e[32m'; c_warn=$'\e[33m'; c_err=$'\e[31m'; c_dim=$'\e[2m'; c_off=$'\e[0m'
ok()   { printf '%s[ok]%s %s\n' "$c_ok" "$c_off" "$*"; }
warn() { printf '%s[!!]%s %s\n' "$c_warn" "$c_off" "$*"; }
die()  { printf '%s[xx]%s %s\n' "$c_err" "$c_off" "$*" >&2; exit 1; }

# ── Requisitos ────────────────────────────────────────────────────────────
check_env() {
    [[ -f "$WS/.env" ]] || die "falta $WS/.env (DATABASE_URL y JWT_SECRET como mínimo; ver docs-agentes/11)"
    grep -qE '^DATABASE_URL=.+' "$WS/.env" || die "DATABASE_URL no está en tidol-workspace/.env"
    if grep -qE '^JWT_SECRET=.+' "$WS/.env"; then
        ok ".env con DATABASE_URL y JWT_SECRET"
    else
        warn "JWT_SECRET vacío: el server arrancará pero toda ruta autenticada dará 500"
    fi
    grep -qE '^YOUTUBE_API_KEY=.+' "$WS/.env" || warn "sin YOUTUBE_API_KEY: no habrá reproducción de YouTube"
}

# host y puerto de DATABASE_URL (mysql://user:pass@host:port/db), sin imprimir credenciales.
db_host_port() {
    local url host_port
    url="$(grep -E '^DATABASE_URL=' "$WS/.env" | head -1 | cut -d= -f2- | tr -d '"'"'")"
    host_port="${url##*@}"; host_port="${host_port%%/*}"
    DB_HOST="${host_port%%:*}"
    if [[ "$host_port" == *:* ]]; then DB_PORT="${host_port##*:}"; else DB_PORT=3306; fi
    [[ "$DB_HOST" == "localhost" ]] && DB_HOST=127.0.0.1
    return 0
}

check_db() {
    db_host_port
    if (exec 3<>"/dev/tcp/$DB_HOST/$DB_PORT") 2>/dev/null; then
        ok "MariaDB responde en $DB_HOST:$DB_PORT"
    else
        die "MariaDB no responde en $DB_HOST:$DB_PORT → sudo systemctl start mariadb"
    fi
}

port_free() { ! (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }

check_port() {
    port_free "$1" || die "el puerto $1 ya está en uso ($2). ¿Otra instancia? → ss -ltnp | grep :$1"
}

# ── Procesos ──────────────────────────────────────────────────────────────
PIDS=()
cleanup() {
    trap - INT TERM EXIT
    if ((${#PIDS[@]})); then
        echo; printf '%sparando servicios…%s\n' "$c_dim" "$c_off"
        kill "${PIDS[@]}" 2>/dev/null || true
        wait "${PIDS[@]}" 2>/dev/null || true
    fi
}
trap cleanup INT TERM EXIT

start_backend() {
    check_port "$PORT" "backend"
    mkdir -p "$LOG_DIR"
    local profile_flag=() bin_dir=debug
    if [[ "${RELEASE:-0}" == 1 ]]; then profile_flag=(--release); bin_dir=release; fi

    printf '%scompilando tidol-server (%s)…%s\n' "$c_dim" "$bin_dir" "$c_off"
    (cd "$WS" && cargo build -q -p tidol-server "${profile_flag[@]}") || die "falló la compilación"

    # Se ejecuta el binario ya compilado (no `cargo run`) desde tidol-workspace/:
    # dotenvy lee el .env del CWD y las cachés de disco (covers/) son relativas a él.
    (cd "$WS" && PORT="$PORT" exec "$WS/target/$bin_dir/tidol-server") \
        >"$LOG_DIR/backend.log" 2>&1 &
    PIDS+=($!)
    local pid=$!

    # Espera la prueba de vida (incluye migraciones de arranque en TidolCore::new).
    local code=000
    for _ in $(seq 1 60); do
        kill -0 "$pid" 2>/dev/null || { tail -n 30 "$LOG_DIR/backend.log" >&2; die "tidol-server terminó al arrancar (log arriba)"; }
        code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/api/v1/auth/me" || true)"
        [[ "$code" != 000 ]] && break
        sleep 0.5
    done
    case "$code" in
        401) ok "backend vivo en http://localhost:$PORT  (auth/me sin token → 401)" ;;
        500) warn "backend responde 500 en auth/me: JWT_SECRET roto o BD caída (ver $LOG_DIR/backend.log)" ;;
        000) die "el backend no respondió en 30 s (ver $LOG_DIR/backend.log)" ;;
        *)   warn "auth/me respondió $code (se esperaba 401)" ;;
    esac
    printf '%slogs: tail -f %s%s\n' "$c_dim" "$LOG_DIR/backend.log" "$c_off"
}

start_frontend() {
    check_port "$VITE_PORT" "Vite"
    command -v npm >/dev/null || die "npm no está instalado"
    if [[ ! -d "$FRONT/node_modules" ]]; then
        printf '%snpm install (primera vez)…%s\n' "$c_dim" "$c_off"
        (cd "$FRONT" && npm install --no-audit --no-fund) || die "falló npm install"
    fi
    port_free "$PORT" && warn "no hay backend en :$PORT; Vite hará proxy de /api a la nada"
    (cd "$FRONT" && exec npm run dev -- --port "$VITE_PORT" --strictPort) &
    PIDS+=($!)
    ok "frontend en http://localhost:$VITE_PORT  (proxy /api → :3000)"
}

# ── Main ─────────────────────────────────────────────────────────────────
case "$MODE" in
    check)
        check_env; check_db
        port_free "$PORT" && ok "puerto $PORT libre" || warn "puerto $PORT ocupado"
        port_free "$VITE_PORT" && ok "puerto $VITE_PORT libre" || warn "puerto $VITE_PORT ocupado"
        trap - EXIT; exit 0 ;;
    backend)  check_env; check_db; start_backend ;;
    frontend) start_frontend ;;
    all)      check_env; check_db; start_backend; start_frontend ;;
    -h|--help|help) sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; trap - EXIT; exit 0 ;;
    *) die "modo desconocido '$MODE' (all | backend | frontend | check)" ;;
esac

printf '%sCtrl-C para parar.%s\n' "$c_dim" "$c_off"
# Si cualquiera de los procesos muere, se para todo (evita un Vite huérfano
# haciendo proxy a un backend caído).
wait -n "${PIDS[@]}" || true
warn "un servicio terminó; parando el resto"
