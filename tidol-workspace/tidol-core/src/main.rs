// =========================================================================
// Tidol Core — Legal Embed Architecture
// =========================================================================
mod auth;
mod error;
mod library;
mod media;
mod models;
mod orchestrator;
mod providers;
mod proxy;
mod user_data;

use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, HeaderValue, StatusCode},
    response::IntoResponse,
    routing::{delete, get, post, put},
    Json, Router,
};
use dotenvy::dotenv;
use providers::ProviderOrchestrator;
use proxy::ProxyRotator;
use serde::Deserialize;
use sqlx::mysql::MySqlPoolOptions;
use sqlx::MySqlPool;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::TcpListener;
use tower_governor::{governor::GovernorConfigBuilder, GovernorLayer};
use tracing::{info, warn};
use unicode_normalization::UnicodeNormalization;

// -------------------------------------------------------------------------
// CARGADOR DINÁMICO FFI: LETRAS (legal — scraping de letras públicas)
// -------------------------------------------------------------------------
struct DynamicLyricsProvider {
    pub name: String,
    fetch_lyrics_fn: unsafe extern "C" fn(
        *const std::ffi::c_char,
        *const std::ffi::c_char,
    ) -> *mut std::ffi::c_char,
    free_string_fn: unsafe extern "C" fn(*mut std::ffi::c_char),
    _lib: libloading::Library,
}

impl DynamicLyricsProvider {
    pub fn new(path: &str) -> Result<Self, Box<dyn std::error::Error>> {
        unsafe {
            let lib = libloading::Library::new(path)?;
            let name_fn: libloading::Symbol<unsafe extern "C" fn() -> *mut std::ffi::c_char> =
                lib.get(b"get_provider_name")?;
            let free_string_fn: unsafe extern "C" fn(*mut std::ffi::c_char) =
                *lib.get(b"free_plugin_string")?;

            let name_ptr = name_fn();
            if name_ptr.is_null() {
                return Err("Null pointer from plugin".into());
            }

            let name = std::ffi::CStr::from_ptr(name_ptr)
                .to_string_lossy()
                .into_owned();
            free_string_fn(name_ptr);

            let fetch_lyrics_fn = *lib.get(b"fetch_lyrics")?;

            Ok(Self {
                name,
                fetch_lyrics_fn,
                free_string_fn,
                _lib: lib,
            })
        }
    }

    pub fn fetch_lyrics(&self, track_name: &str, artist_name: &str) -> String {
        unsafe {
            let c_track = std::ffi::CString::new(track_name).unwrap_or_default();
            let c_artist = std::ffi::CString::new(artist_name).unwrap_or_default();
            let res_ptr = (self.fetch_lyrics_fn)(c_track.as_ptr(), c_artist.as_ptr());

            if res_ptr.is_null() {
                return r#"{"status":"error"}"#.to_string();
            }

            let res = std::ffi::CStr::from_ptr(res_ptr)
                .to_string_lossy()
                .into_owned();
            (self.free_string_fn)(res_ptr);
            res
        }
    }
}

// -------------------------------------------------------------------------
// ESTADO GLOBAL
// -------------------------------------------------------------------------
#[derive(Clone)]
pub struct AppState {
    db: MySqlPool,
    rotator: Arc<ProxyRotator>,
    lyrics_provider: Arc<Option<DynamicLyricsProvider>>,
    pub orchestrator: Arc<orchestrator::MetadataOrchestrator>,
    pub embed_orchestrator: Arc<ProviderOrchestrator>,
}

#[derive(Deserialize)]
pub struct TrackClickPayload {
    pub query: String,
    pub track_id: String,
    pub track_name: String,
    pub artist_name: String,
    pub cover_art_url: String,
    pub source_link: String,
}

fn normalize_query(query: &str) -> String {
    query
        .trim()
        .to_lowercase()
        .nfd()
        .filter(|c| c.is_ascii_alphanumeric() || c.is_whitespace())
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<&str>>()
        .join(" ")
}

#[derive(Deserialize)]
pub struct PaginationQuery {
    limit: Option<u32>,
    offset: Option<u32>,
}

// =========================================================================
// HANDLERS: ARTISTA / ÁLBUM (MusicBrainz — Legal)
// =========================================================================
async fn get_artist_details_handler(
    State(state): State<AppState>,
    Path(mbid): Path<String>,
) -> Json<serde_json::Value> {
    match state.orchestrator.get_artist_details(&mbid).await {
        Ok(res) => Json(serde_json::json!(res)),
        Err(e) => Json(serde_json::json!({ "status": "error", "message": e.to_string() })),
    }
}

async fn artist_discography_handler(
    State(state): State<AppState>,
    Path(mbid): Path<String>,
) -> Json<serde_json::Value> {
    match state
        .orchestrator
        .get_artist_discography(&mbid, &state.db)
        .await
    {
        Ok(res) => Json(serde_json::json!(res)),
        Err(e) => {
            info!("Error in artist_discography_handler: {}", e);
            Json(serde_json::json!({ "status": "error", "message": e.to_string() }))
        }
    }
}

async fn album_details_handler(
    State(state): State<AppState>,
    Path(mbid): Path<String>,
) -> impl axum::response::IntoResponse {
    match state.orchestrator.get_album_details(&mbid, &state.db).await {
        Ok(res) => (axum::http::StatusCode::OK, Json(serde_json::json!(res))).into_response(),
        Err(e) => {
            info!("Error in album_details_handler for mbid {}: {}", mbid, e);
            (
                axum::http::StatusCode::NOT_FOUND,
                Json(serde_json::json!({ "status": "error", "message": e.to_string() })),
            )
                .into_response()
        }
    }
}

async fn report_cover_404_handler(
    State(state): State<AppState>,
    Path(mbid): Path<String>,
) -> impl axum::response::IntoResponse {
    let res = sqlx::query("UPDATE albums SET cover_status = 'not_found' WHERE mbid = ?")
        .bind(&mbid)
        .execute(&state.db)
        .await;

    match res {
        Ok(_) => (
            axum::http::StatusCode::OK,
            Json(serde_json::json!({ "status": "success" })),
        )
            .into_response(),
        Err(e) => {
            info!("Error reporting 404 for album cover {}: {}", mbid, e);
            (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "status": "error" })),
            )
                .into_response()
        }
    }
}

#[derive(serde::Deserialize)]
pub struct RadioQuery {
    pub artist: String,
    pub title: String,
    pub limit: Option<u8>,
}

async fn radio_handler(
    State(state): State<AppState>,
    Query(query): Query<RadioQuery>,
) -> impl axum::response::IntoResponse {
    let limit = query.limit.unwrap_or(10);
    match state
        .orchestrator
        .get_similar_tracks(&query.artist, &query.title, limit, &state.db)
        .await
    {
        Ok(tracks) => (
            axum::http::StatusCode::OK,
            Json(serde_json::json!({ "status": "success", "tracks": tracks })),
        )
            .into_response(),
        Err(e) => {
            info!("Error in radio_handler: {}", e);
            (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "status": "error", "message": e.to_string() })),
            )
                .into_response()
        }
    }
}

// =========================================================================
// HANDLER: BÚSQUEDA (MusicBrainz Catalog — Legal)
// =========================================================================
async fn search_handler(
    State(state): State<AppState>,
    Path(raw_query): Path<String>,
    Query(pagination): Query<PaginationQuery>,
) -> Json<serde_json::Value> {
    let query = normalize_query(&raw_query);
    info!("[API] Search: '{}'", query);

    if query.is_empty() {
        return Json(serde_json::json!({ "status": "error", "message": "Empty search" }));
    }

    // Clamp: limit=0 provocaba división entre cero al calcular la página
    // (offset / limit) y >255 truncaba en el cast a u8 de MusicBrainz.
    let limit = pagination.limit.unwrap_or(20).clamp(1, 50);
    let offset = pagination.offset.unwrap_or(0).min(10_000);

    match state
        .orchestrator
        .search_catalog(&query, limit, offset)
        .await
    {
        Ok(res) => Json(serde_json::json!(res)),
        Err(e) => Json(serde_json::json!({ "status": "error", "message": e.to_string() })),
    }
}

// =========================================================================
// HANDLER: EMBED SEARCH (Multi-platform — Legal via official APIs)
// =========================================================================
#[derive(Deserialize)]
pub struct EmbedSearchQuery {
    pub q: String,
    pub limit: Option<u32>,
}

async fn embed_search_handler(
    State(state): State<AppState>,
    Query(params): Query<EmbedSearchQuery>,
) -> impl IntoResponse {
    let limit = params.limit.unwrap_or(10);
    let tracks = state
        .embed_orchestrator
        .search_all(&params.q, limit)
        .await;

    (
        StatusCode::OK,
        Json(serde_json::json!({
            "status": "success",
            "tracks": tracks
        })),
    )
}

// =========================================================================
// HANDLER: EMBED RESOLVE (Get embed info for a specific track)
// =========================================================================
async fn embed_resolve_handler(
    State(state): State<AppState>,
    Path(platform_id): Path<String>,
) -> impl IntoResponse {
    match state.embed_orchestrator.resolve(&platform_id).await {
        Ok(info) => (
            StatusCode::OK,
            Json(serde_json::json!({
                "status": "success",
                "embed": info
            })),
        )
            .into_response(),
        Err(e) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({
                "status": "error",
                "message": e.to_string()
            })),
        )
            .into_response(),
    }
}

// =========================================================================
// HANDLER: CLICK REGISTRATION
// =========================================================================
async fn click_handler(
    State(state): State<AppState>,
    Json(payload): Json<TrackClickPayload>,
) -> Json<serde_json::Value> {
    let normalized_query = normalize_query(&payload.query);

    if payload.track_id.trim().is_empty()
        || payload.track_name.trim().is_empty()
        || payload.query.trim().is_empty()
    {
        return Json(serde_json::json!({ "status": "error", "message": "Invalid payload" }));
    }

    let _ = sqlx::query!(
        r#"INSERT INTO trackMetadata (trackId, trackName, artistName, coverArtUrl, sourceLink, isCached)
        VALUES (?, ?, ?, ?, ?, 1) ON DUPLICATE KEY UPDATE trackName = VALUES(trackName),
        artistName = VALUES(artistName), coverArtUrl = VALUES(coverArtUrl), sourceLink = VALUES(sourceLink), isCached = 1"#,
        payload.track_id,
        payload.track_name,
        payload.artist_name,
        payload.cover_art_url,
        payload.source_link
    )
    .execute(&state.db)
    .await;

    let _ = sqlx::query!(
        r#"INSERT INTO searchClicks (queryNormalized, trackId, clicks) VALUES (?, ?, 1)
        ON DUPLICATE KEY UPDATE clicks = clicks + 1"#,
        normalized_query,
        payload.track_id
    )
    .execute(&state.db)
    .await;

    Json(serde_json::json!({ "status": "success", "message": "Click registered" }))
}

// =========================================================================
// HANDLER: LYRICS (LRCLIB — Legal API)
// =========================================================================
fn parse_lrc(lrc: &str) -> Vec<serde_json::Value> {
    let mut result = Vec::new();
    for line in lrc.lines() {
        let line = line.trim();
        if line.starts_with('[') {
            if let Some(close_idx) = line.find(']') {
                let timestamp = &line[1..close_idx];
                let text = line[close_idx + 1..].trim();

                if text.is_empty() {
                    continue;
                }

                let parts: Vec<&str> = timestamp.split(':').collect();
                if parts.len() == 2 {
                    if let Ok(m) = parts[0].parse::<u32>() {
                        let sec_parts: Vec<&str> = parts[1].split('.').collect();
                        if sec_parts.len() == 2 {
                            if let (Ok(s), Ok(ms)) =
                                (sec_parts[0].parse::<u32>(), sec_parts[1].parse::<u32>())
                            {
                                // Normalizar la fracción a centésimas según sus dígitos:
                                // [m:ss.d] son décimas (×10), [m:ss.dd] centésimas,
                                // [m:ss.ddd] milésimas (÷10). Antes ".5" se leía como
                                // 5cs en vez de 50cs y el verso llegaba adelantado.
                                let ms_val = match sec_parts[1].len() {
                                    1 => ms * 10,
                                    3 => ms / 10,
                                    _ => ms,
                                };
                                let total_cs = (m * 60 * 100) + (s * 100) + ms_val;
                                result.push(serde_json::json!({
                                    "start_cs": total_cs,
                                    "word": text
                                }));
                            }
                        } else if sec_parts.len() == 1 {
                            if let Ok(s) = sec_parts[0].parse::<u32>() {
                                let total_cs = (m * 60 * 100) + (s * 100);
                                result.push(serde_json::json!({
                                    "start_cs": total_cs,
                                    "word": text
                                }));
                            }
                        }
                    }
                }
            }
        }
    }
    result
}

async fn get_lyrics_handler(
    State(state): State<AppState>,
    Path(track_id): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let row = sqlx::query_as::<_, (Option<String>, Option<String>, String, String)>(
        "SELECT lyrics_json, lyrics_status, artist, title FROM track_links WHERE mbid = ? LIMIT 1",
    )
    .bind(&track_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("DB Error: {}", e),
        )
    })?;

    let (lyrics_json, lyrics_status, artist, title) = match row {
        Some(r) => r,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                "Track not found in database".to_string(),
            ))
        }
    };

    let status = lyrics_status.as_deref().unwrap_or("pending");

    match status {
        "whisper_synced" => {
            if let Some(ref json_str) = lyrics_json {
                let parsed: serde_json::Value =
                    serde_json::from_str(json_str).unwrap_or(serde_json::json!([]));
                let lines = if let Some(words) = parsed.get("words") {
                    words.clone()
                } else {
                    parsed
                };
                return Ok(Json(
                    serde_json::json!({ "type": "whisper_synced", "lines": lines }),
                ));
            }
        }
        "lrclib_synced" => {
            if let Some(ref json_str) = lyrics_json {
                let parsed: serde_json::Value =
                    serde_json::from_str(json_str).unwrap_or(serde_json::json!([]));
                return Ok(Json(
                    serde_json::json!({ "type": "lrclib_synced", "lines": parsed }),
                ));
            }
        }
        "plain_only" => {
            if let Some(ref json_str) = lyrics_json {
                let parsed: serde_json::Value =
                    serde_json::from_str(json_str).unwrap_or(serde_json::json!([]));
                return Ok(Json(
                    serde_json::json!({ "type": "plain", "lines": parsed }),
                ));
            }
        }
        "not_found" => {
            return Err((
                StatusCode::NOT_FOUND,
                "Lyrics not found (cached negative)".to_string(),
            ));
        }
        _ => {}
    }

    // Fetch from LRCLIB (legal API)
    let lrclib_url = format!(
        "https://lrclib.net/api/search?artist_name={}&track_name={}",
        urlencoding::encode(&artist),
        urlencoding::encode(&title)
    );

    // Timeout explícito: sin él, un LRCLIB caído dejaba la petición colgada.
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(8))
        .build()
        .unwrap_or_default();
    let lrclib_response = client.get(&lrclib_url).send().await;
    let mut lrclib_answered = false;

    if let Ok(resp) = lrclib_response {
        if resp.status().is_success() {
            lrclib_answered = true;
            if let Ok(mut results) = resp.json::<Vec<serde_json::Value>>().await {
                if !results.is_empty() {
                    let first = results.remove(0);

                    if let Some(synced) = first.get("syncedLyrics").and_then(|v| v.as_str()) {
                        if !synced.is_empty() {
                            let parsed_lines = parse_lrc(synced);
                            let json_to_store =
                                serde_json::to_string(&parsed_lines).unwrap_or_default();

                            let _ = sqlx::query(
                                "UPDATE track_links SET lyrics_json = ?, lyrics_status = 'lrclib_synced' WHERE mbid = ?"
                            )
                            .bind(&json_to_store)
                            .bind(&track_id)
                            .execute(&state.db)
                            .await;

                            return Ok(Json(serde_json::json!({
                                "type": "lrclib_synced",
                                "lines": parsed_lines
                            })));
                        }
                    }

                    if let Some(plain) = first.get("plainLyrics").and_then(|v| v.as_str()) {
                        if !plain.is_empty() {
                            let lines: Vec<&str> = plain
                                .lines()
                                .map(|l| l.trim())
                                .filter(|l| !l.is_empty())
                                .collect();
                            let json_to_store = serde_json::to_string(&lines).unwrap_or_default();

                            let _ = sqlx::query(
                                "UPDATE track_links SET lyrics_json = ?, lyrics_status = 'plain_only' WHERE mbid = ?"
                            )
                            .bind(&json_to_store)
                            .bind(&track_id)
                            .execute(&state.db)
                            .await;

                            return Ok(Json(serde_json::json!({
                                "type": "plain",
                                "lines": lines
                            })));
                        }
                    }
                }
            }
        }
    }

    // Solo cachear negativo si LRCLIB respondió correctamente pero sin letra.
    // Un fallo transitorio (timeout/red/rate-limit) deja el estado en 'pending'
    // para reintentar luego (antes cualquier fallo cacheaba un 404 permanente).
    if lrclib_answered {
        let _ = sqlx::query("UPDATE track_links SET lyrics_status = 'not_found' WHERE mbid = ?")
            .bind(&track_id)
            .execute(&state.db)
            .await;
    }

    Err((
        StatusCode::NOT_FOUND,
        "Lyrics not available".to_string(),
    ))
}

// -------------------------------------------------------------------------
// RATE LIMIT ERROR HANDLER
// -------------------------------------------------------------------------
fn rate_limit_error_handler(e: tower_governor::errors::GovernorError) -> axum::response::Response {
    let body = Json(serde_json::json!({
        "status": "error",
        "message": format!("Too many requests: {}", e)
    }));
    (StatusCode::TOO_MANY_REQUESTS, body).into_response()
}

// =========================================================================
// USER ACTIVITY HANDLERS
// =========================================================================
#[derive(serde::Deserialize, Debug)]
pub struct LogPlayPayload {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub cover_url: Option<String>,
}

async fn log_play_handler(
    State(state): State<AppState>,
    Path(mbid): Path<String>,
    axum::extract::Extension(auth_ctx): axum::extract::Extension<crate::auth::AuthContext>,
    payload: Option<axum::Json<LogPlayPayload>>,
) -> impl axum::response::IntoResponse {
    let (mut title, mut artist, cover_url) = match payload {
        Some(axum::Json(p)) => (
            p.title.unwrap_or_else(|| "Unknown".to_string()),
            p.artist.unwrap_or_else(|| "Unknown".to_string()),
            p.cover_url.unwrap_or_default(),
        ),
        None => ("Unknown".to_string(), "Unknown".to_string(), String::new()),
    };

    if title == "Unknown" || title.is_empty() {
        if let Ok(profile) = state
            .orchestrator
            .resolve_full_track(&mbid, &state.db)
            .await
        {
            title = profile.title;
            artist = profile.artist;
        }
    }

    let _ = sqlx::query!(
        r#"
        INSERT INTO track_links (mbid, title, artist, cover_url)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        title = IF(title = 'Unknown' OR title IS NULL, VALUES(title), title),
        artist = IF(artist = 'Unknown' OR artist IS NULL, VALUES(artist), artist),
        cover_url = IF(cover_url = '' OR cover_url IS NULL, VALUES(cover_url), cover_url)
        "#,
        mbid,
        title,
        artist,
        cover_url
    )
    .execute(&state.db)
    .await;

    let res = sqlx::query("INSERT INTO play_history (track_mbid, user_id) VALUES (?, ?)")
        .bind(&mbid)
        .bind(auth_ctx.user_id)
        .execute(&state.db)
        .await;

    match res {
        Ok(_) => (
            axum::http::StatusCode::OK,
            Json(serde_json::json!({ "status": "success" })),
        )
            .into_response(),
        Err(e) => {
            info!("Error logging play for {}: {}", mbid, e);
            (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "status": "error" })),
            )
                .into_response()
        }
    }
}

async fn get_home_dashboard_handler(
    State(state): State<AppState>,
    axum::extract::Extension(auth_ctx): axum::extract::Extension<crate::auth::AuthContext>,
) -> impl axum::response::IntoResponse {
    match state
        .orchestrator
        .get_home_dashboard(&state.db, auth_ctx.user_id)
        .await
    {
        Ok(res) => (axum::http::StatusCode::OK, Json(serde_json::json!(res))).into_response(),
        Err(e) => {
            info!("Error in get_home_dashboard_handler: {}", e);
            (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "status": "error", "message": e.to_string() })),
            )
                .into_response()
        }
    }
}

async fn get_listen_again_handler(
    State(state): State<AppState>,
    axum::extract::Extension(auth_ctx): axum::extract::Extension<crate::auth::AuthContext>,
) -> impl axum::response::IntoResponse {
    match state
        .orchestrator
        .get_listen_again(&state.db, 20, auth_ctx.user_id)
        .await
    {
        Ok(res) => (axum::http::StatusCode::OK, Json(res)).into_response(),
        Err(e) => {
            info!("Error in get_listen_again_handler: {}", e);
            (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "status": "error", "message": e.to_string() })),
            )
                .into_response()
        }
    }
}

async fn hydrate_unknown_tracks(
    db: sqlx::MySqlPool,
    orchestrator: std::sync::Arc<crate::orchestrator::MetadataOrchestrator>,
) {
    let unknown_tracks =
        match sqlx::query!("SELECT mbid FROM track_links WHERE title = 'Unknown' OR title IS NULL")
            .fetch_all(&db)
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
        let _ = orchestrator.resolve_full_track(&row.mbid, &db).await;
        tokio::time::sleep(std::time::Duration::from_millis(1500)).await;
    }

    info!("[Ghost Cleaner] Track hydration complete.");
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
                .unwrap_or_else(|_| "tidol_core=info,tower_http=warn".into()),
        )
        .init();
    info!("=== Starting Tidol Core (Legal Embed Architecture) ===");

    let database_url =
        std::env::var("DATABASE_URL").expect("CRITICAL: DATABASE_URL not set");
    let db_max_connections = std::env::var("DATABASE_MAX_CONNECTIONS")
        .ok()
        .and_then(|v| v.parse::<u32>().ok())
        .unwrap_or(100);
    let pool = MySqlPoolOptions::new()
        .max_connections(db_max_connections)
        .connect(&database_url)
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
    let proxy_urls: Vec<String> = std::env::var("PROXY_POOL")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .map(|s| s.split(',').map(|u| u.trim().to_string()).collect())
        .unwrap_or_else(|| vec!["direct".to_string()]);
    let rotator = Arc::new(ProxyRotator::new(proxy_urls)?);

    // Lyrics plugin (legal — scrapes public lyrics databases)
    let default_plugins_dir = concat!(env!("CARGO_MANIFEST_DIR"), "/../target/debug");
    let plugins_dir = std::env::var("PLUGINS_DIR").unwrap_or_else(|_| default_plugins_dir.to_string());
    info!("[CONFIG] Plugins directory: {}", plugins_dir);

    let lyrics_path = format!("{}/libprovider_lyrics.so", plugins_dir);
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
    let yt_api_key = std::env::var("YOUTUBE_API_KEY").unwrap_or_default();
    if !yt_api_key.is_empty() {
        embed_providers.push(Box::new(providers::youtube::YouTubeProvider::new(yt_api_key)));
        info!("[OK] YouTube provider initialized (Data API v3)");
    } else {
        warn!("[WARN] YOUTUBE_API_KEY not set, YouTube provider disabled");
    }

    // Spotify Web API (Client Credentials)
    let spotify_client_id = std::env::var("SPOTIFY_CLIENT_ID").unwrap_or_default();
    let spotify_client_secret = std::env::var("SPOTIFY_CLIENT_SECRET").unwrap_or_default();
    if !spotify_client_id.is_empty() {
        embed_providers.push(Box::new(providers::spotify::SpotifyProvider::new(
            spotify_client_id,
            spotify_client_secret,
        )));
        info!("[OK] Spotify provider initialized (Web API)");
    } else {
        warn!("[WARN] Spotify credentials not set, provider disabled");
    }

    // SoundCloud
    let sc_client_id = std::env::var("SOUNDCLOUD_CLIENT_ID").unwrap_or_default();
    if !sc_client_id.is_empty() {
        embed_providers.push(Box::new(providers::soundcloud::SoundCloudProvider::new(sc_client_id)));
        info!("[OK] SoundCloud provider initialized");
    } else {
        warn!("[WARN] SOUNDCLOUD_CLIENT_ID not set, SoundCloud disabled");
    }

    // Internet Archive (always available, legal CC/PD content)
    embed_providers.push(Box::new(providers::archive::ArchiveProvider::new()));
    info!("[OK] Internet Archive provider initialized (CC/PD content only)");

    let embed_orchestrator = Arc::new(ProviderOrchestrator::new(embed_providers));

    let app_state = AppState {
        db: pool,
        rotator,
        lyrics_provider: Arc::new(lyrics_provider),
        orchestrator: Arc::new(orchestrator::MetadataOrchestrator::new()),
        embed_orchestrator,
    };

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
            post(auth::register_handler).layer(GovernorLayer {
                config: register_rate_limiter,
            }),
        )
        .route(
            "/api/v1/auth/login",
            post(auth::login_handler).layer(GovernorLayer {
                config: login_rate_limiter,
            }),
        )
        .route("/api/v1/lyrics/:track_id", get(get_lyrics_handler))
        .route("/api/v1/covers/:mbid", get(media::get_cover_handler))
        // Embed endpoints (public so frontend can use without auth for search preview)
        .route("/api/v1/embed/search", get(embed_search_handler))
        .route("/api/v1/embed/resolve/:platform_id", get(embed_resolve_handler));

    // ─── PROTECTED ROUTES ───
    let protected_routes = Router::new()
        .route("/api/v1/home", get(get_home_dashboard_handler))
        .route("/api/v1/tracks/listen-again", get(get_listen_again_handler))
        .route("/api/v1/tracks/:mbid/log-play", post(log_play_handler))
        .route("/api/v1/auth/me", get(auth::me_handler))
        .route("/api/v1/search/:query", get(search_handler))
        .route("/api/v1/artists/:mbid", get(get_artist_details_handler))
        .route(
            "/api/v1/artists/:mbid/discography",
            get(artist_discography_handler),
        )
        .route("/api/v1/albums/:mbid", get(album_details_handler))
        .route(
            "/api/v1/albums/:mbid/report-cover-404",
            post(report_cover_404_handler),
        )
        .route("/api/v1/radio", get(radio_handler))
        .route("/api/v1/search/click", post(click_handler))
        .route("/api/v1/auth/logout", post(auth::logout_handler))
        .route(
            "/api/v1/images/optimize",
            get(media::optimize_image_handler),
        )
        .route(
            "/api/v1/colors/extract",
            post(media::extract_colors_handler),
        )
        // Playlists
        .route(
            "/api/v1/playlists",
            get(user_data::get_playlists_handler).post(user_data::create_playlist_handler),
        )
        .route(
            "/api/v1/playlists/:id",
            get(user_data::get_playlist_handler)
                .patch(user_data::rename_playlist_handler)
                .delete(user_data::delete_playlist_handler),
        )
        .route(
            "/api/v1/playlists/:id/songs",
            get(user_data::get_playlist_songs_handler)
                .post(user_data::add_song_to_playlist_handler),
        )
        .route(
            "/api/v1/playlists/:id/songs/order",
            put(user_data::reorder_playlist_songs_handler),
        )
        .route(
            "/api/v1/playlists/:id/songs/:song_id",
            delete(user_data::remove_song_from_playlist_handler),
        )
        .route(
            "/api/v1/playlists/:id/like",
            post(user_data::toggle_playlist_like_handler),
        )
        // History
        .route("/api/v1/history", get(user_data::get_history_handler))
        .route("/api/v1/history/add", post(user_data::add_history_handler))
        // Likes
        .route(
            "/api/v1/music/songs/likes",
            get(user_data::get_local_likes_handler),
        )
        .route(
            "/api/v1/music/ia/likes",
            get(user_data::get_ia_likes_handler),
        )
        .route(
            "/api/v1/music/likes/detailed",
            get(user_data::get_likes_detailed_handler),
        )
        .route(
            "/api/v1/music/songs/:id/like",
            post(user_data::toggle_local_like_handler).delete(user_data::toggle_local_like_handler),
        )
        .route(
            "/api/v1/music/ia/likes/toggle",
            post(user_data::toggle_ia_like_handler),
        )
        // Library
        .route("/api/v1/albumes", get(library::get_albums_handler))
        .route("/api/v1/music/albums", get(library::get_albums_handler))
        .route(
            "/api/v1/music/albums/:id",
            get(library::get_album_by_id_handler),
        )
        .route(
            "/api/v1/music/albums/:id/songs",
            get(library::get_album_songs_handler),
        )
        .route(
            "/api/v1/music/artists/resolve",
            get(library::resolve_artist_handler),
        )
        .route(
            "/api/v1/music/artists/:id",
            get(library::get_artist_by_id_handler),
        )
        .route(
            "/api/v1/music/artists/:id/songs",
            get(library::get_artist_songs_handler),
        )
        .route(
            "/api/v1/music/home-recommendations",
            get(library::get_home_recommendations_handler),
        )
        .route(
            "/api/v1/music/ia/discoveries",
            get(library::get_ia_discoveries_handler),
        )
        .route_layer(axum::middleware::from_fn_with_state(
            app_state.clone(),
            auth::auth_middleware,
        ));

    let cors = tower_http::cors::CorsLayer::new()
        .allow_origin(tower_http::cors::Any)
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
            // PATCH faltaba: el preflight de renombrar playlist (PATCH
            // /api/v1/playlists/:id) fallaba en cualquier origen cruzado.
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
    let pool_clone = app_state.db.clone();
    let orchestrator_clone = app_state.orchestrator.clone();
    tokio::spawn(async move {
        hydrate_unknown_tracks(pool_clone, orchestrator_clone).await;
    });

    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await?;
    Ok(())
}
