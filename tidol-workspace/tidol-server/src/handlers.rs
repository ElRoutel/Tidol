use axum::{
    body::Body,
    extract::{Path, Query, State},
    http::{header, header::AUTHORIZATION, Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Extension, Json,
};
use serde::Deserialize;
use serde_json::json;
use tracing::info;

use tidol_core::models::{AlbumResponse, ArtistResponse};
use tidol_core::{
    normalize_query, AddHistoryPayload, AddSongError, AddSongToPlaylistPayload, AuthContext,
    AuthError, Colors, ColorsResponse, CoverOutcome, CreatePlaylistPayload, ExtractColorsPayload,
    LikesDetailedQuery, LoginError, LoginPayload, LogPlayPayload, LogoutError, LyricsError, MeError,
    OptimizeError, RegisterError, RegisterPayload, RenameError, RenamePlaylistPayload,
    ReorderError, ReorderPlaylistPayload, SearchQuery, ToggleIaLikeError, ToggleLikePayload,
    TogglePlaylistLikeError, TrackClickPayload,
};

use crate::error::ServerError;
use crate::state::AppState;

// =========================================================================
// QUERY / PAYLOAD STRUCTS (extractores — puramente de transporte)
// =========================================================================
#[derive(Deserialize)]
pub struct PaginationQuery {
    limit: Option<u32>,
    offset: Option<u32>,
}

#[derive(Deserialize)]
pub struct RadioQuery {
    pub artist: String,
    pub title: String,
    pub limit: Option<u8>,
}

#[derive(Deserialize)]
pub struct EmbedSearchQuery {
    pub q: String,
    pub limit: Option<u32>,
}

#[derive(Deserialize)]
pub struct OptimizeQuery {
    path: String,
    w: Option<u32>,
    #[allow(dead_code)]
    q: Option<u32>,
}

#[derive(Deserialize)]
pub struct CoverQuery {
    /// URL de respaldo (p.ej. miniatura de YouTube) si CAA/MusicBrainz/iTunes fallan.
    pub fallback: Option<String>,
}

// =========================================================================
// AUTH: MIDDLEWARE + HANDLERS
// =========================================================================
pub async fn auth_middleware(
    State(state): State<AppState>,
    mut req: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    let auth_header = req
        .headers()
        .get(AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "));

    let query_token = req.uri().query().and_then(|q| {
        q.split('&')
            .find(|pair| pair.starts_with("token="))
            .map(|pair| pair.trim_start_matches("token="))
    });

    let token_val = match (auth_header, query_token) {
        (Some(t), _) if !t.trim().is_empty() => t.trim().to_string(),
        (_, Some(t)) if !t.trim().is_empty() => t.trim().to_string(),
        _ => return Err(StatusCode::UNAUTHORIZED),
    };

    let ctx = state.core.authenticate(&token_val).await.map_err(|e| match e {
        AuthError::Unauthorized => StatusCode::UNAUTHORIZED,
        AuthError::Internal => StatusCode::INTERNAL_SERVER_ERROR,
    })?;

    req.extensions_mut().insert(ctx);

    Ok(next.run(req).await)
}

fn register_err(e: RegisterError) -> (StatusCode, String) {
    let status = match &e {
        RegisterError::InvalidUsername
        | RegisterError::PasswordTooShort
        | RegisterError::InvalidDevice => StatusCode::BAD_REQUEST,
        RegisterError::UsernameTaken => StatusCode::CONFLICT,
        _ => StatusCode::INTERNAL_SERVER_ERROR,
    };
    (status, e.to_string())
}

pub async fn register_handler(
    State(state): State<AppState>,
    Json(payload): Json<RegisterPayload>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    state
        .core
        .register(payload)
        .await
        .map(Json)
        .map_err(register_err)
}

fn login_err(e: LoginError) -> (StatusCode, String) {
    let status = match &e {
        LoginError::InvalidCredentials | LoginError::InvalidDevice => StatusCode::BAD_REQUEST,
        LoginError::BadLogin => StatusCode::UNAUTHORIZED,
        _ => StatusCode::INTERNAL_SERVER_ERROR,
    };
    (status, e.to_string())
}

pub async fn login_handler(
    State(state): State<AppState>,
    Json(payload): Json<LoginPayload>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    state.core.login(payload).await.map(Json).map_err(login_err)
}

pub async fn me_handler(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthContext>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    state.core.me(&auth).await.map(Json).map_err(|e| {
        let status = match &e {
            MeError::Db(_) => StatusCode::INTERNAL_SERVER_ERROR,
            MeError::NotFound => StatusCode::UNAUTHORIZED,
        };
        (status, e.to_string())
    })
}

pub async fn logout_handler(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthContext>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    state.core.logout(&auth).await.map(Json).map_err(|e| {
        let status = match &e {
            LogoutError::Db(_) => StatusCode::INTERNAL_SERVER_ERROR,
            LogoutError::AlreadyClosed => StatusCode::UNAUTHORIZED,
        };
        (status, e.to_string())
    })
}

// =========================================================================
// CATÁLOGO: ARTISTA / ÁLBUM / BÚSQUEDA / RADIO (MusicBrainz — Legal)
// =========================================================================
pub async fn get_artist_details_handler(
    State(state): State<AppState>,
    Path(mbid): Path<String>,
) -> Json<serde_json::Value> {
    match state.core.get_artist_details(&mbid).await {
        Ok(res) => Json(json!(res)),
        Err(e) => Json(json!({ "status": "error", "message": e.to_string() })),
    }
}

pub async fn artist_discography_handler(
    State(state): State<AppState>,
    Path(mbid): Path<String>,
) -> impl IntoResponse {
    match state.core.get_artist_discography(&mbid).await {
        Ok(res) => (StatusCode::OK, Json(json!(res))).into_response(),
        Err(e) => {
            info!("Error in artist_discography_handler: {}", e);
            // 502 y no 200: con 200 el frontend renderizaba una página vacía.
            (
                StatusCode::BAD_GATEWAY,
                Json(json!({ "status": "error", "message": e.to_string() })),
            )
                .into_response()
        }
    }
}

pub async fn album_details_handler(
    State(state): State<AppState>,
    Path(mbid): Path<String>,
) -> impl IntoResponse {
    match state.core.get_album_details(&mbid).await {
        Ok(res) => (StatusCode::OK, Json(json!(res))).into_response(),
        Err(e) => {
            info!("Error in album_details_handler for mbid {}: {}", mbid, e);
            (
                StatusCode::NOT_FOUND,
                Json(json!({ "status": "error", "message": e.to_string() })),
            )
                .into_response()
        }
    }
}

pub async fn report_cover_404_handler(
    State(state): State<AppState>,
    Path(mbid): Path<String>,
) -> impl IntoResponse {
    match state.core.report_cover_404(&mbid).await {
        Ok(_) => (StatusCode::OK, Json(json!({ "status": "success" }))).into_response(),
        Err(e) => {
            info!("Error reporting 404 for album cover {}: {}", mbid, e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "status": "error" })),
            )
                .into_response()
        }
    }
}

pub async fn radio_handler(
    State(state): State<AppState>,
    Query(query): Query<RadioQuery>,
) -> impl IntoResponse {
    let limit = query.limit.unwrap_or(10);
    match state
        .core
        .get_similar_tracks(&query.artist, &query.title, limit)
        .await
    {
        Ok(tracks) => (
            StatusCode::OK,
            Json(json!({ "status": "success", "tracks": tracks })),
        )
            .into_response(),
        Err(e) => {
            info!("Error in radio_handler: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "status": "error", "message": e.to_string() })),
            )
                .into_response()
        }
    }
}

pub async fn search_handler(
    State(state): State<AppState>,
    Path(raw_query): Path<String>,
    Query(pagination): Query<PaginationQuery>,
) -> Json<serde_json::Value> {
    let query = normalize_query(&raw_query);
    info!("[API] Search: '{}'", query);

    if query.is_empty() {
        return Json(json!({ "status": "error", "message": "Empty search" }));
    }

    // Clamp: limit=0 provocaba división entre cero; >255 truncaba en el cast a u8.
    let limit = pagination.limit.unwrap_or(20).clamp(1, 50);
    let offset = pagination.offset.unwrap_or(0).min(10_000);

    match state.core.search_catalog(&query, limit, offset).await {
        Ok(res) => Json(json!(res)),
        Err(e) => Json(json!({ "status": "error", "message": e.to_string() })),
    }
}

// =========================================================================
// EMBED (APIs oficiales — Legal)
// =========================================================================
pub async fn embed_search_handler(
    State(state): State<AppState>,
    Query(params): Query<EmbedSearchQuery>,
) -> impl IntoResponse {
    let limit = params.limit.unwrap_or(10);
    let tracks = state.core.embed_search(&params.q, limit).await;

    (
        StatusCode::OK,
        Json(json!({
            "status": "success",
            "tracks": tracks
        })),
    )
}

pub async fn embed_resolve_handler(
    State(state): State<AppState>,
    Path(platform_id): Path<String>,
) -> impl IntoResponse {
    match state.core.resolve_embed(&platform_id).await {
        Ok(embed) => (
            StatusCode::OK,
            Json(json!({ "status": "success", "embed": embed })),
        )
            .into_response(),
        Err(e) => (
            StatusCode::NOT_FOUND,
            Json(json!({ "status": "error", "message": e.to_string() })),
        )
            .into_response(),
    }
}

pub async fn click_handler(
    State(state): State<AppState>,
    Json(payload): Json<TrackClickPayload>,
) -> Json<serde_json::Value> {
    if state.core.register_click(payload).await {
        Json(json!({ "status": "success", "message": "Click registered" }))
    } else {
        Json(json!({ "status": "error", "message": "Invalid payload" }))
    }
}

// =========================================================================
// LETRAS (LRCLIB — Legal API)
// =========================================================================
pub async fn get_lyrics_handler(
    State(state): State<AppState>,
    Path(track_id): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    state.core.get_lyrics(&track_id).await.map(Json).map_err(|e| {
        let status = match &e {
            LyricsError::Db(_) => StatusCode::INTERNAL_SERVER_ERROR,
            _ => StatusCode::NOT_FOUND,
        };
        (status, e.to_string())
    })
}

// =========================================================================
// ACTIVIDAD DE USUARIO: LOG PLAY / HOME / LISTEN AGAIN
// =========================================================================
pub async fn log_play_handler(
    State(state): State<AppState>,
    Path(mbid): Path<String>,
    Extension(auth_ctx): Extension<AuthContext>,
    payload: Option<Json<LogPlayPayload>>,
) -> impl IntoResponse {
    let payload = payload.map(|Json(p)| p);
    match state.core.log_play(&mbid, auth_ctx.user_id, payload).await {
        Ok(_) => (StatusCode::OK, Json(json!({ "status": "success" }))).into_response(),
        Err(e) => {
            info!("Error logging play for {}: {}", mbid, e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "status": "error" })),
            )
                .into_response()
        }
    }
}

pub async fn get_home_dashboard_handler(
    State(state): State<AppState>,
    Extension(auth_ctx): Extension<AuthContext>,
) -> impl IntoResponse {
    match state.core.get_home_dashboard(auth_ctx.user_id).await {
        Ok(res) => (StatusCode::OK, Json(json!(res))).into_response(),
        Err(e) => {
            info!("Error in get_home_dashboard_handler: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "status": "error", "message": e.to_string() })),
            )
                .into_response()
        }
    }
}

pub async fn get_listen_again_handler(
    State(state): State<AppState>,
    Extension(auth_ctx): Extension<AuthContext>,
) -> impl IntoResponse {
    match state.core.get_listen_again(auth_ctx.user_id).await {
        Ok(res) => (StatusCode::OK, Json(res)).into_response(),
        Err(e) => {
            info!("Error in get_listen_again_handler: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "status": "error", "message": e.to_string() })),
            )
                .into_response()
        }
    }
}

// =========================================================================
// MEDIA: OPTIMIZAR IMAGEN / EXTRAER COLORES / PORTADAS
// =========================================================================
pub async fn optimize_image_handler(
    State(state): State<AppState>,
    Query(query): Query<OptimizeQuery>,
) -> impl IntoResponse {
    match state.core.optimize_image(&query.path, query.w).await {
        Ok(bytes) => ([(header::CONTENT_TYPE, "image/jpeg")], bytes).into_response(),
        Err(OptimizeError::InvalidPath) => {
            (StatusCode::BAD_REQUEST, "Invalid image path").into_response()
        }
        Err(OptimizeError::NotFound) => (StatusCode::NOT_FOUND, "Image not found").into_response(),
        Err(OptimizeError::Encode) => {
            (StatusCode::INTERNAL_SERVER_ERROR, "Error optimizing image").into_response()
        }
    }
}

pub async fn extract_colors_handler(
    State(state): State<AppState>,
    Json(payload): Json<ExtractColorsPayload>,
) -> impl IntoResponse {
    let colors: Colors = state.core.extract_colors(payload).await;
    Json(ColorsResponse {
        success: true,
        colors,
    })
}

pub async fn get_cover_handler(
    State(state): State<AppState>,
    Path(mbid): Path<String>,
    Query(q): Query<CoverQuery>,
) -> impl IntoResponse {
    match state.core.get_cover(&mbid, q.fallback).await {
        CoverOutcome::InvalidId => (StatusCode::BAD_REQUEST, "Invalid id").into_response(),
        CoverOutcome::Image(bytes) => (
            StatusCode::OK,
            [(header::CONTENT_TYPE, "image/jpeg")],
            bytes,
        )
            .into_response(),
        CoverOutcome::Default(Some(bytes)) => (
            StatusCode::OK,
            [(header::CONTENT_TYPE, "image/jpeg")],
            bytes,
        )
            .into_response(),
        CoverOutcome::Default(None) => {
            (StatusCode::NOT_FOUND, "Cover not found").into_response()
        }
    }
}

// =========================================================================
// PLAYLISTS
// =========================================================================
pub async fn get_playlists_handler(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthContext>,
) -> impl IntoResponse {
    Json(state.core.get_playlists(auth.user_id).await)
}

pub async fn create_playlist_handler(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthContext>,
    Json(payload): Json<CreatePlaylistPayload>,
) -> Result<Json<serde_json::Value>, ServerError> {
    let value = state.core.create_playlist(auth.user_id, payload).await?;
    Ok(Json(value))
}

pub async fn delete_playlist_handler(
    State(state): State<AppState>,
    Path(playlist_id): Path<String>,
    Extension(auth): Extension<AuthContext>,
) -> impl IntoResponse {
    if state.core.delete_playlist(auth.user_id, &playlist_id).await {
        (StatusCode::OK, "Eliminado").into_response()
    } else {
        (StatusCode::NOT_FOUND, "No encontrado").into_response()
    }
}

pub async fn get_playlist_handler(
    State(state): State<AppState>,
    Path(playlist_id): Path<String>,
    Extension(auth): Extension<AuthContext>,
) -> impl IntoResponse {
    match state.core.get_playlist(auth.user_id, &playlist_id).await {
        Some(v) => Json(v).into_response(),
        None => (StatusCode::NOT_FOUND, "Playlist no encontrada").into_response(),
    }
}

pub async fn toggle_playlist_like_handler(
    State(state): State<AppState>,
    Path(playlist_id): Path<String>,
    Extension(auth): Extension<AuthContext>,
) -> impl IntoResponse {
    match state.core.toggle_playlist_like(auth.user_id, &playlist_id).await {
        Ok(v) => Json(v).into_response(),
        Err(TogglePlaylistLikeError::NotFound) => {
            (StatusCode::NOT_FOUND, "Playlist no encontrada").into_response()
        }
        Err(TogglePlaylistLikeError::Db) => {
            (StatusCode::INTERNAL_SERVER_ERROR, "Error DB").into_response()
        }
    }
}

pub async fn rename_playlist_handler(
    State(state): State<AppState>,
    Path(playlist_id): Path<String>,
    Extension(auth): Extension<AuthContext>,
    Json(payload): Json<RenamePlaylistPayload>,
) -> impl IntoResponse {
    match state.core.rename_playlist(auth.user_id, &playlist_id, payload).await {
        Ok(v) => Json(v).into_response(),
        Err(e) => {
            let status = match &e {
                RenameError::EmptyName => StatusCode::BAD_REQUEST,
                RenameError::NotFound => StatusCode::NOT_FOUND,
                RenameError::Db(_) => StatusCode::INTERNAL_SERVER_ERROR,
            };
            (status, e.to_string()).into_response()
        }
    }
}

pub async fn get_playlist_songs_handler(
    State(state): State<AppState>,
    Path(playlist_id): Path<String>,
    Extension(_auth): Extension<AuthContext>,
) -> impl IntoResponse {
    match state.core.get_playlist_songs(&playlist_id).await {
        Some(songs) => Json(songs).into_response(),
        None => (StatusCode::NOT_FOUND, "Playlist no encontrada").into_response(),
    }
}

pub async fn add_song_to_playlist_handler(
    State(state): State<AppState>,
    Path(playlist_id): Path<String>,
    Extension(auth): Extension<AuthContext>,
    Json(payload): Json<AddSongToPlaylistPayload>,
) -> impl IntoResponse {
    match state.core.add_song_to_playlist(auth.user_id, &playlist_id, payload).await {
        Ok(v) => Json(v).into_response(),
        Err(AddSongError::NotFound) => {
            (StatusCode::NOT_FOUND, "Playlist no encontrada").into_response()
        }
        Err(AddSongError::Insert) => {
            (StatusCode::INTERNAL_SERVER_ERROR, "Error al añadir canción").into_response()
        }
    }
}

pub async fn reorder_playlist_songs_handler(
    State(state): State<AppState>,
    Path(playlist_id): Path<String>,
    Extension(auth): Extension<AuthContext>,
    Json(payload): Json<ReorderPlaylistPayload>,
) -> impl IntoResponse {
    match state
        .core
        .reorder_playlist_songs(auth.user_id, &playlist_id, payload.order)
        .await
    {
        Ok(v) => Json(v).into_response(),
        Err(ReorderError::Invalid) => (StatusCode::BAD_REQUEST, "Orden inválido").into_response(),
        Err(ReorderError::NotFound) => {
            (StatusCode::NOT_FOUND, "Playlist no encontrada").into_response()
        }
        Err(ReorderError::Db) => (StatusCode::INTERNAL_SERVER_ERROR, "Error DB").into_response(),
    }
}

pub async fn remove_song_from_playlist_handler(
    State(state): State<AppState>,
    Path((playlist_id, track_id)): Path<(String, String)>,
    Extension(auth): Extension<AuthContext>,
) -> impl IntoResponse {
    if state
        .core
        .remove_song_from_playlist(auth.user_id, &playlist_id, &track_id)
        .await
    {
        (StatusCode::OK, "Canción eliminada").into_response()
    } else {
        (StatusCode::NOT_FOUND, "Playlist no encontrada").into_response()
    }
}

// =========================================================================
// HISTORIAL
// =========================================================================
pub async fn get_history_handler(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthContext>,
) -> impl IntoResponse {
    Json(state.core.get_history(auth.user_id).await)
}

pub async fn add_history_handler(Json(payload): Json<AddHistoryPayload>) -> impl IntoResponse {
    // Deprecado (no-op): se mantiene la ruta por compatibilidad; ya no escribe nada.
    if payload
        .cancion_id
        .as_ref()
        .and_then(tidol_core::json_id_to_string)
        .is_none()
    {
        return (StatusCode::BAD_REQUEST, "cancion_id requerido").into_response();
    }
    (StatusCode::OK, "OK").into_response()
}

// =========================================================================
// LIKES
// =========================================================================
pub async fn get_likes_detailed_handler(
    State(state): State<AppState>,
    Query(q): Query<LikesDetailedQuery>,
    Extension(auth): Extension<AuthContext>,
) -> impl IntoResponse {
    Json(state.core.get_likes_detailed(auth.user_id, q.source).await)
}

pub async fn get_local_likes_handler(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthContext>,
) -> impl IntoResponse {
    Json(state.core.get_local_likes(auth.user_id).await)
}

pub async fn get_ia_likes_handler(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthContext>,
) -> impl IntoResponse {
    Json(state.core.get_ia_likes(auth.user_id).await)
}

pub async fn toggle_local_like_handler(
    State(state): State<AppState>,
    Path(track_id): Path<String>,
    Extension(auth): Extension<AuthContext>,
) -> impl IntoResponse {
    (
        StatusCode::OK,
        Json(state.core.toggle_local_like(auth.user_id, &track_id).await),
    )
}

pub async fn toggle_ia_like_handler(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthContext>,
    Json(payload): Json<ToggleLikePayload>,
) -> impl IntoResponse {
    match state.core.toggle_ia_like(auth.user_id, payload).await {
        Ok(v) => (StatusCode::OK, Json(v)).into_response(),
        Err(ToggleIaLikeError::MissingId) => {
            (StatusCode::BAD_REQUEST, "Missing ID").into_response()
        }
    }
}

// =========================================================================
// LIBRARY (BD local: álbumes / artistas)
// =========================================================================
pub async fn get_albums_handler(
    State(state): State<AppState>,
) -> Result<Json<Vec<AlbumResponse>>, StatusCode> {
    state.core.get_albums().await.map(Json).map_err(|e| {
        tracing::error!("Error consultando álbumes: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })
}

pub async fn get_album_by_id_handler(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<AlbumResponse>, StatusCode> {
    match state.core.get_album_by_id(&id).await {
        Ok(Some(a)) => Ok(Json(a)),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

pub async fn get_album_songs_handler(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    Json(state.core.get_album_songs(&id).await)
}

pub async fn resolve_artist_handler(
    State(state): State<AppState>,
    Query(query): Query<SearchQuery>,
) -> Result<Json<ArtistResponse>, StatusCode> {
    match state.core.resolve_artist(query.name).await {
        Ok(Some(a)) => Ok(Json(a)),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

pub async fn get_artist_by_id_handler(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ArtistResponse>, StatusCode> {
    match state.core.get_artist_by_id(&id).await {
        Ok(Some(a)) => Ok(Json(a)),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

pub async fn get_artist_songs_handler(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    Json(state.core.get_artist_songs(&id).await)
}

pub async fn get_home_recommendations_handler() -> impl IntoResponse {
    // MOCK: Home recommendations stub
    Json(json!([]))
}

pub async fn get_ia_discoveries_handler() -> impl IntoResponse {
    // MOCK: IA discoveries stub
    Json(json!([]))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{routing::get, Router};
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;
    use tidol_core::{config::CoreConfig, Claims, TidolCore};
    use tower::ServiceExt;

    const SECRET: &str = "secreto-middleware";

    /// Estado real con núcleo desconectado: el middleware ejecuta la
    /// validación JWT auténtica; solo la verificación del device en BD falla
    /// (como con una BD caída), y ese caso mapeaba a 500 también en la base.
    fn test_state() -> AppState {
        AppState {
            core: Arc::new(TidolCore::new_disconnected(CoreConfig {
                database_url: "mysql://user:pass@127.0.0.1:1/nodb".into(),
                database_max_connections: 1,
                proxy_pool: vec!["direct".into()],
                plugins_dir: "/nonexistent".into(),
                youtube_api_key: String::new(),
                spotify_client_id: String::new(),
                spotify_client_secret: String::new(),
                soundcloud_client_id: String::new(),
                jwt_secret: Some(SECRET.into()),
            })),
        }
    }

    /// Router mínimo con la MISMA construcción que main.rs: ruta protegida por
    /// `route_layer(from_fn_with_state(auth_middleware))`. `hit` delata si la
    /// petición llegó al handler.
    fn protected_app(state: AppState, hit: Arc<AtomicBool>) -> Router {
        let handler = move || {
            let hit = hit.clone();
            async move {
                hit.store(true, Ordering::SeqCst);
                "ok"
            }
        };
        Router::new()
            .route("/protected", get(handler))
            .route_layer(axum::middleware::from_fn_with_state(
                state.clone(),
                auth_middleware,
            ))
            .with_state(state)
    }

    fn make_token(secret: &str, exp_offset_secs: i64) -> String {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        let claims = Claims {
            sub: 7,
            device_id: "dev-1".into(),
            exp: (now + exp_offset_secs) as usize,
            iat: now as usize,
        };
        jsonwebtoken::encode(
            &jsonwebtoken::Header::default(),
            &claims,
            &jsonwebtoken::EncodingKey::from_secret(secret.as_bytes()),
        )
        .unwrap()
    }

    async fn hit_protected(app: Router, auth: Option<&str>, uri: &str) -> StatusCode {
        let mut req = Request::builder().uri(uri);
        if let Some(a) = auth {
            req = req.header(AUTHORIZATION, a);
        }
        let resp = app.oneshot(req.body(Body::empty()).unwrap()).await.unwrap();
        resp.status()
    }

    // Comportamiento de la línea base (auth_middleware @ e46be8bb):
    // sin token → 401; token no decodificable → 401; error de BD → 500.
    // En todos los casos el handler NO debe ejecutarse.

    #[tokio::test]
    async fn sin_token_401_y_handler_no_corre() {
        let hit = Arc::new(AtomicBool::new(false));
        let app = protected_app(test_state(), hit.clone());
        let status = hit_protected(app, None, "/protected").await;
        assert_eq!(status, StatusCode::UNAUTHORIZED);
        assert!(!hit.load(Ordering::SeqCst), "el handler se ejecutó sin auth");
    }

    #[tokio::test]
    async fn bearer_vacio_401() {
        let hit = Arc::new(AtomicBool::new(false));
        let app = protected_app(test_state(), hit.clone());
        let status = hit_protected(app, Some("Bearer "), "/protected").await;
        assert_eq!(status, StatusCode::UNAUTHORIZED);
        assert!(!hit.load(Ordering::SeqCst));
    }

    #[tokio::test]
    async fn token_basura_en_header_401() {
        let hit = Arc::new(AtomicBool::new(false));
        let app = protected_app(test_state(), hit.clone());
        let status = hit_protected(app, Some("Bearer garbage"), "/protected").await;
        assert_eq!(status, StatusCode::UNAUTHORIZED);
        assert!(!hit.load(Ordering::SeqCst));
    }

    #[tokio::test]
    async fn token_basura_por_query_401() {
        // La base también aceptaba ?token= como transporte del token.
        let hit = Arc::new(AtomicBool::new(false));
        let app = protected_app(test_state(), hit.clone());
        let status = hit_protected(app, None, "/protected?token=garbage").await;
        assert_eq!(status, StatusCode::UNAUTHORIZED);
        assert!(!hit.load(Ordering::SeqCst));
    }

    #[tokio::test]
    async fn token_expirado_401() {
        let hit = Arc::new(AtomicBool::new(false));
        let app = protected_app(test_state(), hit.clone());
        let tok = make_token(SECRET, -3600);
        let status =
            hit_protected(app, Some(&format!("Bearer {tok}")), "/protected").await;
        assert_eq!(status, StatusCode::UNAUTHORIZED);
        assert!(!hit.load(Ordering::SeqCst));
    }

    #[tokio::test]
    async fn firma_invalida_401() {
        let hit = Arc::new(AtomicBool::new(false));
        let app = protected_app(test_state(), hit.clone());
        let tok = make_token("otro-secreto", 3600);
        let status =
            hit_protected(app, Some(&format!("Bearer {tok}")), "/protected").await;
        assert_eq!(status, StatusCode::UNAUTHORIZED);
        assert!(!hit.load(Ordering::SeqCst));
    }

    #[tokio::test]
    async fn token_valido_con_bd_caida_500_sin_ejecutar_handler() {
        // decode OK → verificación de device contra BD inalcanzable → 500,
        // idéntico al mapeo de error de BD del middleware original.
        let hit = Arc::new(AtomicBool::new(false));
        let app = protected_app(test_state(), hit.clone());
        let tok = make_token(SECRET, 3600);
        let status =
            hit_protected(app, Some(&format!("Bearer {tok}")), "/protected").await;
        assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
        assert!(!hit.load(Ordering::SeqCst));
    }
}
