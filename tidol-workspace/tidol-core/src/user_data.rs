use crate::{auth::AuthContext, AppState};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// -------------------------------------------------------------------------
// PAYLOADS
// -------------------------------------------------------------------------
#[derive(Deserialize)]
pub struct CreatePlaylistPayload {
    pub nombre: String,
}

#[derive(Deserialize)]
pub struct AddSongToPlaylistPayload {
    pub cancion_id: String,
    pub song_source: Option<String>,
    pub titulo: String,
    pub artista: String,
    pub portada: String,
    pub url: String,
    pub duracion: Option<i32>,
}

#[derive(Deserialize)]
pub struct AddHistoryPayload {
    pub cancion_id: String,
}

#[derive(Deserialize)]
pub struct ToggleLikePayload {
    pub id: Option<String>,
    pub identifier: Option<String>,
    pub name: Option<String>,
    pub title: Option<String>,
    pub creator: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
}

// -------------------------------------------------------------------------
// MANEJADORES: PLAYLISTS
// -------------------------------------------------------------------------
pub async fn get_playlists_handler(
    State(state): State<AppState>,
    axum::Extension(auth): axum::Extension<AuthContext>,
) -> impl IntoResponse {
    let rows = sqlx::query!(
        "SELECT id, name, created_at FROM playlists WHERE user_id = ? ORDER BY created_at DESC",
        auth.user_id
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let playlists: Vec<serde_json::Value> = rows
        .into_iter()
        .map(|r| {
            serde_json::json!({
                "id": r.id,
                "nombre": r.name,
                "creada_en": r.created_at.map(|dt| dt.unix_timestamp())
            })
        })
        .collect();

    Json(playlists)
}

pub async fn create_playlist_handler(
    State(state): State<AppState>,
    axum::Extension(auth): axum::Extension<AuthContext>,
    Json(payload): Json<CreatePlaylistPayload>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let playlist_id = Uuid::new_v4().to_string();

    sqlx::query!(
        "INSERT INTO playlists (id, user_id, name) VALUES (?, ?, ?)",
        playlist_id,
        auth.user_id,
        payload.nombre
    )
    .execute(&state.db)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Error DB: {}", e),
        )
    })?;

    Ok(Json(serde_json::json!({
        "id": playlist_id,
        "nombre": payload.nombre
    })))
}

pub async fn delete_playlist_handler(
    State(state): State<AppState>,
    Path(playlist_id): Path<String>,
    axum::Extension(auth): axum::Extension<AuthContext>,
) -> impl IntoResponse {
    let result = sqlx::query!(
        "DELETE FROM playlists WHERE id = ? AND user_id = ?",
        playlist_id,
        auth.user_id
    )
    .execute(&state.db)
    .await;

    match result {
        Ok(res) if res.rows_affected() > 0 => (StatusCode::OK, "Eliminado").into_response(),
        _ => (StatusCode::NOT_FOUND, "No encontrado").into_response(),
    }
}

pub async fn get_playlist_songs_handler(
    State(state): State<AppState>,
    Path(playlist_id): Path<String>,
    axum::Extension(auth): axum::Extension<AuthContext>,
) -> impl IntoResponse {
    // Verificar que la playlist pertenezca al usuario
    let playlist = sqlx::query!(
        "SELECT id FROM playlists WHERE id = ? AND user_id = ?",
        playlist_id,
        auth.user_id
    )
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    if playlist.is_none() {
        return (StatusCode::NOT_FOUND, "Playlist no encontrada").into_response();
    }

    let rows = sqlx::query!(
        "SELECT track_id, song_source, title, artist, cover_url, duration FROM playlist_songs WHERE playlist_id = ? ORDER BY added_at DESC",
        playlist_id
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let songs: Vec<serde_json::Value> = rows
        .into_iter()
        .map(|r| {
            serde_json::json!({
                "id": r.track_id,
                "sourceType": r.song_source.unwrap_or_else(|| "local".to_string()),
                "title": r.title,
                "artist": r.artist,
                "artworkUrl": r.cover_url,
                "duration": r.duration
            })
        })
        .collect();

    Json(songs).into_response()
}

pub async fn add_song_to_playlist_handler(
    State(state): State<AppState>,
    Path(playlist_id): Path<String>,
    axum::Extension(auth): axum::Extension<AuthContext>,
    Json(payload): Json<AddSongToPlaylistPayload>,
) -> impl IntoResponse {
    let playlist = sqlx::query!(
        "SELECT id FROM playlists WHERE id = ? AND user_id = ?",
        playlist_id,
        auth.user_id
    )
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    if playlist.is_none() {
        return (StatusCode::NOT_FOUND, "Playlist no encontrada").into_response();
    }

    let source = payload.song_source.unwrap_or_else(|| "local".to_string());
    let duration = payload.duracion.unwrap_or(0);

    let result = sqlx::query!(
        r#"
        INSERT INTO playlist_songs (playlist_id, track_id, song_source, title, artist, cover_url, duration)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE added_at = CURRENT_TIMESTAMP
        "#,
        playlist_id,
        payload.cancion_id,
        source,
        payload.titulo,
        payload.artista,
        payload.portada,
        duration
    )
    .execute(&state.db)
    .await;

    match result {
        Ok(_) => (StatusCode::OK, "Canción añadida").into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Error al añadir canción").into_response(),
    }
}

pub async fn remove_song_from_playlist_handler(
    State(state): State<AppState>,
    Path((playlist_id, track_id)): Path<(String, String)>,
    axum::Extension(auth): axum::Extension<AuthContext>,
) -> impl IntoResponse {
    let playlist = sqlx::query!(
        "SELECT id FROM playlists WHERE id = ? AND user_id = ?",
        playlist_id,
        auth.user_id
    )
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    if playlist.is_none() {
        return (StatusCode::NOT_FOUND, "Playlist no encontrada").into_response();
    }

    let _ = sqlx::query!(
        "DELETE FROM playlist_songs WHERE playlist_id = ? AND track_id = ?",
        playlist_id,
        track_id
    )
    .execute(&state.db)
    .await;

    (StatusCode::OK, "Canción eliminada").into_response()
}

// -------------------------------------------------------------------------
// MANEJADORES: HISTORIAL
// -------------------------------------------------------------------------
pub async fn get_history_handler(
    State(state): State<AppState>,
    axum::Extension(auth): axum::Extension<AuthContext>,
) -> impl IntoResponse {
    let rows = sqlx::query!(
        r#"
        SELECT h.track_id, h.played_at, tm.trackName, tm.artistName, tm.coverArtUrl
        FROM user_history h
        LEFT JOIN trackMetadata tm ON h.track_id = tm.trackId
        WHERE h.user_id = ?
        ORDER BY h.played_at DESC
        LIMIT 50
        "#,
        auth.user_id
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let history: Vec<serde_json::Value> = rows
        .into_iter()
        .map(|r| {
            serde_json::json!({
                "id": r.track_id,
                "title": r.trackName,
                "artist": r.artistName,
                "artworkUrl": r.coverArtUrl,
                "playedAt": r.played_at.map(|dt| dt.unix_timestamp())
            })
        })
        .collect();

    Json(history)
}

pub async fn add_history_handler(
    State(state): State<AppState>,
    axum::Extension(auth): axum::Extension<AuthContext>,
    Json(payload): Json<AddHistoryPayload>,
) -> impl IntoResponse {
    let _ = sqlx::query!(
        "INSERT INTO user_history (user_id, track_id) VALUES (?, ?)",
        auth.user_id,
        payload.cancion_id
    )
    .execute(&state.db)
    .await;

    (StatusCode::OK, "Añadido al historial").into_response()
}

// -------------------------------------------------------------------------
// MANEJADORES: LIKES
// -------------------------------------------------------------------------
pub async fn get_local_likes_handler(
    State(state): State<AppState>,
    axum::Extension(auth): axum::Extension<AuthContext>,
) -> impl IntoResponse {
    let rows = sqlx::query!(
        "SELECT track_id FROM user_likes WHERE user_id = ? AND source = 'local'",
        auth.user_id
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let likes: Vec<String> = rows.into_iter().map(|r| r.track_id).collect();
    Json(likes)
}

pub async fn get_ia_likes_handler(
    State(state): State<AppState>,
    axum::Extension(auth): axum::Extension<AuthContext>,
) -> impl IntoResponse {
    let rows = sqlx::query!(
        "SELECT track_id FROM user_likes WHERE user_id = ? AND source != 'local'",
        auth.user_id
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let likes: Vec<String> = rows.into_iter().map(|r| r.track_id).collect();
    Json(likes)
}

pub async fn toggle_local_like_handler(
    State(state): State<AppState>,
    Path(track_id): Path<String>,
    axum::Extension(auth): axum::Extension<AuthContext>,
) -> impl IntoResponse {
    let existing = sqlx::query!(
        "SELECT track_id FROM user_likes WHERE user_id = ? AND track_id = ?",
        auth.user_id,
        track_id
    )
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    if existing.is_some() {
        let _ = sqlx::query!(
            "DELETE FROM user_likes WHERE user_id = ? AND track_id = ?",
            auth.user_id,
            track_id
        )
        .execute(&state.db)
        .await;
        (StatusCode::OK, Json(serde_json::json!({"liked": false})))
    } else {
        let _ = sqlx::query!(
            "INSERT INTO user_likes (user_id, track_id, source) VALUES (?, ?, 'local')",
            auth.user_id,
            track_id
        )
        .execute(&state.db)
        .await;
        (StatusCode::OK, Json(serde_json::json!({"liked": true})))
    }
}

pub async fn toggle_ia_like_handler(
    State(state): State<AppState>,
    axum::Extension(auth): axum::Extension<AuthContext>,
    Json(payload): Json<ToggleLikePayload>,
) -> impl IntoResponse {
    let track_id = payload
        .id
        .unwrap_or_else(|| payload.identifier.unwrap_or_default());
    if track_id.is_empty() {
        return (StatusCode::BAD_REQUEST, "Missing ID").into_response();
    }

    let existing = sqlx::query!(
        "SELECT track_id FROM user_likes WHERE user_id = ? AND track_id = ?",
        auth.user_id,
        track_id
    )
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    if existing.is_some() {
        let _ = sqlx::query!(
            "DELETE FROM user_likes WHERE user_id = ? AND track_id = ?",
            auth.user_id,
            track_id
        )
        .execute(&state.db)
        .await;
        (StatusCode::OK, Json(serde_json::json!({"liked": false}))).into_response()
    } else {
        let _ = sqlx::query!(
            "INSERT INTO user_likes (user_id, track_id, source) VALUES (?, ?, 'archive')",
            auth.user_id,
            track_id
        )
        .execute(&state.db)
        .await;
        (StatusCode::OK, Json(serde_json::json!({"liked": true}))).into_response()
    }
}
