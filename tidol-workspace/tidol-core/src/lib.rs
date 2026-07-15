// =========================================================================
// Tidol Core — Legal Embed Architecture (biblioteca de dominio)
//
// Este crate NO depende de `axum`: contiene únicamente la lógica de dominio
// (consultas sqlx, llamadas reqwest a APIs, orquestación de metadatos,
// proveedores, criptografía/JWT de auth, procesamiento de imágenes y tipos de
// dominio). El transporte HTTP vive en el binario `tidol-server`.
// =========================================================================
pub mod config;
pub mod error;
pub mod lyrics;
pub mod models;
pub mod orchestrator;
pub mod providers;
pub mod proxy;

// Bloques `impl TidolCore` repartidos por dominio (Rust lo permite dentro del
// mismo crate). Cada módulo aporta sus métodos + tipos de dominio/errores.
mod auth;
mod catalog;
mod library;
mod media;
mod user_data;

use std::sync::Arc;

use sqlx::mysql::MySqlPoolOptions;
use sqlx::MySqlPool;
use tracing::{info, warn};

use config::CoreConfig;
use error::TidolError;
use lyrics::DynamicLyricsProvider;
use orchestrator::MetadataOrchestrator;
use providers::ProviderOrchestrator;
use proxy::ProxyRotator;

// ── Re-exports públicos que consume el binario (tidol-server) ──
pub use auth::{
    AuthContext, AuthError, Claims, DeleteAccountError, LoginError, LoginPayload, LogoutError,
    MeError, RegisterError, RegisterPayload,
};
pub use catalog::{normalize_query, LogPlayPayload, LyricsError, TrackClickPayload};
pub use library::SearchQuery;
pub use media::{Colors, ColorsResponse, CoverOutcome, ExtractColorsPayload, OptimizeError};
pub use user_data::{
    json_id_to_string, AddHistoryPayload, AddSongError, AddSongToPlaylistPayload,
    CreatePlaylistPayload, LikesDetailedQuery, RenameError, RenamePlaylistPayload, ReorderError,
    ReorderPlaylistPayload, ToggleIaLikeError, ToggleLikePayload, TogglePlaylistLikeError,
};

// -------------------------------------------------------------------------
// ESTADO / NÚCLEO DE DOMINIO
// -------------------------------------------------------------------------
/// Núcleo de dominio de Tidol. Agrupa el pool de BD, el rotador de proxies, el
/// plugin de letras, el orquestador de metadatos y el orquestador de embeds.
/// El binario lo envuelve en `Arc` dentro de su `AppState`.
pub struct TidolCore {
    pub(crate) db: MySqlPool,
    #[allow(dead_code)]
    pub(crate) rotator: Arc<ProxyRotator>,
    #[allow(dead_code)]
    pub(crate) lyrics_provider: Arc<Option<DynamicLyricsProvider>>,
    pub(crate) orchestrator: Arc<MetadataOrchestrator>,
    pub(crate) embed_orchestrator: Arc<ProviderOrchestrator>,
    #[allow(dead_code)]
    pub(crate) config: CoreConfig,
}

impl TidolCore {
    /// Construye el núcleo: abre el pool, ejecuta las migraciones idempotentes de
    /// arranque, carga el plugin de letras y monta los proveedores de embed.
    pub async fn new(config: CoreConfig) -> Result<Self, TidolError> {
        let pool = MySqlPoolOptions::new()
            .max_connections(config.database_max_connections)
            .connect(&config.database_url)
            .await?;
        info!("[OK] Database connection established.");

        // Ensure track_links table exists
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS track_links (
                mbid VARCHAR(36) PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                artist VARCHAR(255) NOT NULL,
                yt_video_id VARCHAR(50) DEFAULT NULL,
                genius_id VARCHAR(50) DEFAULT NULL,
                cover_url TEXT DEFAULT NULL,
                lyrics_json LONGTEXT DEFAULT NULL,
                lyrics_status VARCHAR(50) DEFAULT 'pending',
                last_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )",
        )
        .execute(&pool)
        .await?;

        // Migración idempotente: orden estable (position) y URL de reproducción
        // directa (url, p.ej. Internet Archive) en playlist_songs. El backfill
        // asigna 1..N por fecha de añadido solo a filas sin posición.
        sqlx::query(
            "ALTER TABLE playlist_songs
                ADD COLUMN IF NOT EXISTS position INT NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS url TEXT DEFAULT NULL",
        )
        .execute(&pool)
        .await?;
        sqlx::query(
            "UPDATE playlist_songs ps
             JOIN (
                 SELECT playlist_id, track_id,
                        ROW_NUMBER() OVER (PARTITION BY playlist_id ORDER BY added_at ASC) AS rn
                 FROM playlist_songs
             ) x ON ps.playlist_id = x.playlist_id AND ps.track_id = x.track_id
             SET ps.position = x.rn
             WHERE ps.position = 0",
        )
        .execute(&pool)
        .await?;

        // Proxy rotator (still useful for outbound API calls)
        let rotator = Arc::new(
            ProxyRotator::new(config.proxy_pool.clone())
                .map_err(|e| TidolError::Config(e.to_string()))?,
        );

        // Lyrics plugin (legal — scrapes public lyrics databases)
        info!("[CONFIG] Plugins directory: {}", config.plugins_dir);
        let lyrics_path = format!("{}/libprovider_lyrics.so", config.plugins_dir);
        let lyrics_provider = match DynamicLyricsProvider::new(&lyrics_path) {
            Ok(prov) => {
                info!("[OK] Lyrics plugin '{}' loaded.", prov.name);
                Some(prov)
            }
            Err(e) => {
                warn!("[WARN] Lyrics plugin not available: {}", e);
                None
            }
        };

        // ─── EMBED PROVIDERS (Legal Official APIs) ───
        let mut embed_providers: Vec<Box<dyn providers::MusicProvider>> = Vec::new();

        // YouTube Data API v3
        if !config.youtube_api_key.is_empty() {
            embed_providers.push(Box::new(providers::youtube::YouTubeProvider::new(
                config.youtube_api_key.clone(),
            )));
            info!("[OK] YouTube provider initialized (Data API v3)");
        } else {
            warn!("[WARN] YOUTUBE_API_KEY not set, YouTube provider disabled");
        }

        // Spotify Web API (Client Credentials)
        if !config.spotify_client_id.is_empty() {
            embed_providers.push(Box::new(providers::spotify::SpotifyProvider::new(
                config.spotify_client_id.clone(),
                config.spotify_client_secret.clone(),
            )));
            info!("[OK] Spotify provider initialized (Web API)");
        } else {
            warn!("[WARN] Spotify credentials not set, provider disabled");
        }

        // SoundCloud
        if !config.soundcloud_client_id.is_empty() {
            embed_providers.push(Box::new(providers::soundcloud::SoundCloudProvider::new(
                config.soundcloud_client_id.clone(),
            )));
            info!("[OK] SoundCloud provider initialized");
        } else {
            warn!("[WARN] SOUNDCLOUD_CLIENT_ID not set, SoundCloud disabled");
        }

        // Internet Archive (always available, legal CC/PD content)
        embed_providers.push(Box::new(providers::archive::ArchiveProvider::new()));
        info!("[OK] Internet Archive provider initialized (CC/PD content only)");

        let embed_orchestrator = Arc::new(ProviderOrchestrator::new(embed_providers));

        Ok(Self {
            db: pool,
            rotator,
            lyrics_provider: Arc::new(lyrics_provider),
            orchestrator: Arc::new(MetadataOrchestrator::new()),
            embed_orchestrator,
            config,
        })
    }

    /// Núcleo real sin conexión viva a BD, para pruebas: el pool es perezoso y
    /// apunta a `config.database_url` (típicamente un puerto cerrado), así los
    /// caminos que tocan BD fallan igual que con una BD caída — sin mocks. No
    /// ejecuta migraciones ni carga plugins/proveedores.
    #[cfg(any(test, feature = "test-util"))]
    pub fn new_disconnected(config: CoreConfig) -> Self {
        let pool = MySqlPoolOptions::new()
            .max_connections(config.database_max_connections)
            // Fallo rápido: sin esto, cada camino de BD esperaría los 30 s del
            // acquire_timeout por defecto reintentando contra el puerto cerrado.
            .acquire_timeout(std::time::Duration::from_millis(500))
            .connect_lazy(&config.database_url)
            .expect("connect_lazy no valida la conexión; solo puede fallar por URL malformada");

        let rotator = Arc::new(
            ProxyRotator::new(config.proxy_pool.clone())
                .expect("proxy_pool de prueba no vacío"),
        );

        Self {
            db: pool,
            rotator,
            lyrics_provider: Arc::new(None),
            orchestrator: Arc::new(MetadataOrchestrator::new()),
            embed_orchestrator: Arc::new(ProviderOrchestrator::new(Vec::new())),
            config,
        }
    }

    /// Tarea de fondo: rellena pistas "Unknown" en track_links resolviéndolas
    /// contra el orquestador de metadatos (con throttling).
    pub async fn hydrate_unknown_tracks(&self) {
        let unknown_tracks = match sqlx::query!(
            "SELECT mbid FROM track_links WHERE title = 'Unknown' OR title IS NULL"
        )
        .fetch_all(&self.db)
        .await
        {
            Ok(rows) => rows,
            Err(_) => return,
        };

        if unknown_tracks.is_empty() {
            return;
        }

        info!(
            "[Ghost Cleaner] Hydrating {} unknown tracks",
            unknown_tracks.len()
        );

        for row in unknown_tracks {
            let _ = self
                .orchestrator
                .resolve_full_track(&row.mbid, &self.db)
                .await;
            tokio::time::sleep(std::time::Duration::from_millis(1500)).await;
        }

        info!("[Ghost Cleaner] Track hydration complete.");
    }
}
