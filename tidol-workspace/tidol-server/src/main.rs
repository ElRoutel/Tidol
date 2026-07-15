// =========================================================================
// Tidol Server — capa de transporte HTTP (Axum) sobre `tidol-core`
// =========================================================================
mod error;
mod handlers;
mod state;

use std::net::SocketAddr;
use std::sync::Arc;

use axum::{
    response::IntoResponse,
    routing::{delete, get, post, put},
    Json, Router,
};
use dotenvy::dotenv;
use tokio::net::TcpListener;
use tower_governor::{governor::GovernorConfigBuilder, GovernorLayer};
use tracing::info;

use tidol_core::{config::CoreConfig, TidolCore};

use state::AppState;

// -------------------------------------------------------------------------
// RATE LIMIT ERROR HANDLER
// -------------------------------------------------------------------------
fn rate_limit_error_handler(e: tower_governor::errors::GovernorError) -> axum::response::Response {
    let body = Json(serde_json::json!({
        "status": "error",
        "message": format!("Too many requests: {}", e)
    }));
    (axum::http::StatusCode::TOO_MANY_REQUESTS, body).into_response()
}

// =========================================================================
// MAIN
// =========================================================================
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "tidol_core=info,tidol_server=info,tower_http=warn".into()),
        )
        .init();
    info!("=== Starting Tidol Core (Legal Embed Architecture) ===");

    // ─── Configuración resuelta desde el entorno ───
    let database_url = std::env::var("DATABASE_URL").expect("CRITICAL: DATABASE_URL not set");
    let database_max_connections = std::env::var("DATABASE_MAX_CONNECTIONS")
        .ok()
        .and_then(|v| v.parse::<u32>().ok())
        .unwrap_or(100);
    let proxy_pool: Vec<String> = std::env::var("PROXY_POOL")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .map(|s| s.split(',').map(|u| u.trim().to_string()).collect())
        .unwrap_or_else(|| vec!["direct".to_string()]);
    // El default se computa en el binario: CARGO_MANIFEST_DIR = tidol-server, y
    // "/../target/debug" resuelve al mismo workspace/target/debug de siempre.
    let default_plugins_dir = concat!(env!("CARGO_MANIFEST_DIR"), "/../target/debug");
    let plugins_dir =
        std::env::var("PLUGINS_DIR").unwrap_or_else(|_| default_plugins_dir.to_string());
    let youtube_api_key = std::env::var("YOUTUBE_API_KEY").unwrap_or_default();
    let spotify_client_id = std::env::var("SPOTIFY_CLIENT_ID").unwrap_or_default();
    let spotify_client_secret = std::env::var("SPOTIFY_CLIENT_SECRET").unwrap_or_default();
    let soundcloud_client_id = std::env::var("SOUNDCLOUD_CLIENT_ID").unwrap_or_default();
    let jwt_secret = std::env::var("JWT_SECRET").ok();

    let config = CoreConfig {
        database_url,
        database_max_connections,
        proxy_pool,
        plugins_dir,
        youtube_api_key,
        spotify_client_id,
        spotify_client_secret,
        soundcloud_client_id,
        jwt_secret,
    };

    // El core abre el pool, ejecuta migraciones, carga plugin y monta proveedores.
    let core = Arc::new(TidolCore::new(config).await?);
    let app_state = AppState { core };

    // Rate limiters
    let register_rate_limiter = Arc::new(
        GovernorConfigBuilder::default()
            .per_second(1)
            .burst_size(5)
            .error_handler(rate_limit_error_handler)
            .finish()
            .unwrap(),
    );

    let login_rate_limiter = Arc::new(
        GovernorConfigBuilder::default()
            .per_second(1)
            .burst_size(2)
            .error_handler(rate_limit_error_handler)
            .finish()
            .unwrap(),
    );

    // ─── PUBLIC ROUTES ───
    let public_routes = Router::new()
        .route(
            "/api/v1/auth/register",
            post(handlers::register_handler).layer(GovernorLayer {
                config: register_rate_limiter,
            }),
        )
        .route(
            "/api/v1/auth/login",
            post(handlers::login_handler).layer(GovernorLayer {
                config: login_rate_limiter,
            }),
        )
        .route("/api/v1/lyrics/:track_id", get(handlers::get_lyrics_handler))
        .route("/api/v1/covers/:mbid", get(handlers::get_cover_handler))
        // Embed endpoints (public so frontend can use without auth for search preview)
        .route("/api/v1/embed/search", get(handlers::embed_search_handler))
        .route(
            "/api/v1/embed/resolve/:platform_id",
            get(handlers::embed_resolve_handler),
        );

    // ─── PROTECTED ROUTES ───
    let protected_routes = Router::new()
        .route("/api/v1/home", get(handlers::get_home_dashboard_handler))
        .route(
            "/api/v1/tracks/listen-again",
            get(handlers::get_listen_again_handler),
        )
        .route(
            "/api/v1/tracks/:mbid/log-play",
            post(handlers::log_play_handler),
        )
        .route(
            "/api/v1/auth/me",
            get(handlers::me_handler).delete(handlers::delete_me_handler),
        )
        .route("/api/v1/search/:query", get(handlers::search_handler))
        .route(
            "/api/v1/artists/:mbid",
            get(handlers::get_artist_details_handler),
        )
        .route(
            "/api/v1/artists/:mbid/discography",
            get(handlers::artist_discography_handler),
        )
        .route("/api/v1/albums/:mbid", get(handlers::album_details_handler))
        .route(
            "/api/v1/albums/:mbid/report-cover-404",
            post(handlers::report_cover_404_handler),
        )
        .route("/api/v1/radio", get(handlers::radio_handler))
        .route("/api/v1/search/click", post(handlers::click_handler))
        .route("/api/v1/auth/logout", post(handlers::logout_handler))
        .route(
            "/api/v1/images/optimize",
            get(handlers::optimize_image_handler),
        )
        .route(
            "/api/v1/colors/extract",
            post(handlers::extract_colors_handler),
        )
        // Playlists
        .route(
            "/api/v1/playlists",
            get(handlers::get_playlists_handler).post(handlers::create_playlist_handler),
        )
        .route(
            "/api/v1/playlists/:id",
            get(handlers::get_playlist_handler)
                .patch(handlers::rename_playlist_handler)
                .delete(handlers::delete_playlist_handler),
        )
        .route(
            "/api/v1/playlists/:id/songs",
            get(handlers::get_playlist_songs_handler)
                .post(handlers::add_song_to_playlist_handler),
        )
        .route(
            "/api/v1/playlists/:id/songs/order",
            put(handlers::reorder_playlist_songs_handler),
        )
        .route(
            "/api/v1/playlists/:id/songs/:song_id",
            delete(handlers::remove_song_from_playlist_handler),
        )
        .route(
            "/api/v1/playlists/:id/like",
            post(handlers::toggle_playlist_like_handler),
        )
        // History
        .route("/api/v1/history", get(handlers::get_history_handler))
        .route("/api/v1/history/add", post(handlers::add_history_handler))
        // Likes
        .route(
            "/api/v1/music/songs/likes",
            get(handlers::get_local_likes_handler),
        )
        .route("/api/v1/music/ia/likes", get(handlers::get_ia_likes_handler))
        .route(
            "/api/v1/music/likes/detailed",
            get(handlers::get_likes_detailed_handler),
        )
        .route(
            "/api/v1/music/songs/:id/like",
            post(handlers::set_local_like_handler).delete(handlers::unset_local_like_handler),
        )
        .route(
            "/api/v1/music/ia/likes/toggle",
            post(handlers::toggle_ia_like_handler),
        )
        // Library
        .route("/api/v1/albumes", get(handlers::get_albums_handler))
        .route("/api/v1/music/albums", get(handlers::get_albums_handler))
        .route(
            "/api/v1/music/albums/:id",
            get(handlers::get_album_by_id_handler),
        )
        .route(
            "/api/v1/music/albums/:id/songs",
            get(handlers::get_album_songs_handler),
        )
        .route(
            "/api/v1/music/artists/resolve",
            get(handlers::resolve_artist_handler),
        )
        .route(
            "/api/v1/music/artists/:id",
            get(handlers::get_artist_by_id_handler),
        )
        .route(
            "/api/v1/music/artists/:id/songs",
            get(handlers::get_artist_songs_handler),
        )
        .route(
            "/api/v1/music/home-recommendations",
            get(handlers::get_home_recommendations_handler),
        )
        .route(
            "/api/v1/music/ia/discoveries",
            get(handlers::get_ia_discoveries_handler),
        )
        .route_layer(axum::middleware::from_fn_with_state(
            app_state.clone(),
            handlers::auth_middleware,
        ));

    let cors = tower_http::cors::CorsLayer::new()
        .allow_origin(tower_http::cors::Any)
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
            // PATCH: el preflight de renombrar playlist (PATCH /api/v1/playlists/:id).
            axum::http::Method::PATCH,
            axum::http::Method::DELETE,
            axum::http::Method::OPTIONS,
        ])
        .allow_headers(tower_http::cors::Any);

    let app = Router::new()
        .merge(public_routes)
        .merge(protected_routes)
        .layer(cors)
        .with_state(app_state.clone());

    let port = std::env::var("PORT").unwrap_or_else(|_| "3000".to_string());
    let bind_addr = format!("0.0.0.0:{}", port);
    let listener = TcpListener::bind(&bind_addr).await?;
    info!("Tidol Core listening on http://localhost:{}", port);

    // Background: hydrate unknown tracks
    let core_bg = app_state.core.clone();
    tokio::spawn(async move {
        core_bg.hydrate_unknown_tracks().await;
    });

    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await?;
    Ok(())
}
