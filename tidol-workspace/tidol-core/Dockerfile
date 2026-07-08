# =============================================================================
# STAGE 1: Builder — Rust compilation
# =============================================================================
FROM rust:1.89-slim-bookworm AS builder
WORKDIR /workspace

RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy the workspace (filtered by .dockerignore)
COPY . .

# SQLx compile-time database URL
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}

# Build the main binary and plugins in release mode.
# El binario HTTP vive ahora en el crate `tidol-server` (dominio = lib
# `tidol-core`, HTTP = bin `tidol-server` tras el split de arquitectura).
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
    DATABASE_MAX_CONNECTIONS=100

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -s --max-time 4 http://localhost:8080/ -o /dev/null && exit 0 || exit 1

ENTRYPOINT ["/app/tidol-server"]
