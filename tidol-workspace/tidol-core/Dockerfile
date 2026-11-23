# =============================================================================
# STAGE 0: chef — toolchain + cargo-chef (capa estable, se reutiliza siempre)
# =============================================================================
# Por qué cargo-chef: antes había un único `COPY . .` seguido de `cargo build`,
# así que CUALQUIER cambio en el código invalidaba la capa y cada deploy
# recompilaba las ~200 dependencias desde cero (~3,5 min de los ~3,5 min de
# compilación, medido en local con 8 núcleos; bastante más en el VPS). Con
# cargo-chef las dependencias se compilan en su propia capa, que solo se
# invalida si cambian Cargo.toml / Cargo.lock.
#
# Se usa cargo-chef (capas normales) y NO `RUN --mount=type=cache`: las cache
# mounts exigen BuildKit/buildx, y no está garantizado en todas las máquinas
# que construyen esta imagen (en la del dev falta el plugin buildx).
#
# Versión fijada: 0.1.72 (2025-07-01) es anterior a Rust 1.89 (2025-08-07), así
# que con --locked todas sus dependencias compilan con la toolchain de abajo.
# cargo-chef no declara rust-version: no subirla sin probar el build.
FROM rust:1.89-slim-bookworm AS chef
WORKDIR /workspace

RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

RUN cargo install cargo-chef --version 0.1.72 --locked

# =============================================================================
# STAGE 1a: planner — "receta" de dependencias (Cargo.toml/Cargo.lock del workspace)
# =============================================================================
FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

# =============================================================================
# STAGE 1b: builder — dependencias (capa cacheada) y luego el código propio
# =============================================================================
FROM chef AS builder

# Los macros `sqlx::query!` se resuelven contra la caché offline commiteada en
# `.sqlx/`, NO contra una BD viva. Antes el build recibía un `DATABASE_URL` y
# compilaba online (de ahí el `network: host` del compose y el 3306 publicado):
# una MariaDB caída o lenta rompía la compilación. Si el build falla con
# "set DATABASE_URL to use query macros online", la caché está desincronizada:
#   cargo sqlx prepare --workspace   (y commitea `.sqlx/`)
ENV SQLX_OFFLINE=true

# Dependencias de TODO el workspace (servidor y plugins) con el mismo perfil de
# release (lto = "thin") que el build final. Esta capa solo cambia si cambia
# recipe.json, es decir, si cambian las dependencias.
COPY --from=planner /workspace/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json

# Código propio (filtrado por .dockerignore; incluye `.sqlx/`).
COPY . .

# El binario HTTP vive en el crate `tidol-server` (dominio = lib `tidol-core`,
# HTTP = bin `tidol-server` tras el split de arquitectura).
RUN cargo build --release --bin tidol-server
RUN cargo build --release -p provider-archive \
                           -p provider-jamendo \
                           -p provider-lyrics

# =============================================================================
# STAGE 2: Runtime — minimal image (no Python, no ffmpeg, no yt-dlp)
# =============================================================================
FROM debian:bookworm-slim AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Main binary
COPY --from=builder /workspace/target/release/tidol-server /app/tidol-server

# Plugin shared libraries
RUN mkdir -p /app/plugins
COPY --from=builder /workspace/target/release/libprovider_archive.so  /app/plugins/
COPY --from=builder /workspace/target/release/libprovider_jamendo.so  /app/plugins/
COPY --from=builder /workspace/target/release/libprovider_lyrics.so   /app/plugins/

# Non-root user
RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -m -s /bin/bash appuser && \
    mkdir -p /app/covers && \
    chown -R appuser:appgroup /app

# El VOLUME hereda el propietario del directorio en la imagen; al declararlo
# tras el chown, un volumen nuevo nace como appuser (uid 10001) y la caché de
# portadas es escribible por el proceso no-root.
VOLUME ["/app/covers"]

USER appuser

ENV APP_ENV=production \
    PORT=8080 \
    RUST_LOG=info \
    PLUGINS_DIR=/app/plugins \
    DATABASE_MAX_CONNECTIONS=50

EXPOSE 8080

# DATABASE_MAX_CONNECTIONS: antes 100 aquí y 50 en compose. Con 3 réplicas,
# 100 × 3 = 300 conexiones superan las 151 de MariaDB por defecto; compose lo
# fija igualmente, pero el default de la imagen no debe ser el valor peligroso.

# Healthcheck contra /api/v1/health, que hace `SELECT 1` en la BD (200 / 503).
# Antes hacía `curl -s http://localhost:8080/` (404) SIN -f, que termina con
# código 0 ante CUALQUIER respuesta HTTP: el contenedor salía "healthy" con la
# app rota. Con -f, un 503 (BD inalcanzable) o un 5xx = unhealthy.
# (La prueba de vida de deploy.sh —auth/me sin token → 401— sigue aparte: esa
# comprueba el enrutado y el middleware de auth desde fuera.)
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD ["curl", "-fsS", "--max-time", "4", "-o", "/dev/null", "http://localhost:8080/api/v1/health"]

ENTRYPOINT ["/app/tidol-server"]
