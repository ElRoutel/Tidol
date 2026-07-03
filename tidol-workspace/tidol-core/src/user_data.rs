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
    // Tolerante: el frontend puede enviar el id como string o como número. Aceptamos
    // ambos (y ausencia) para no devolver un 422 opaco; validamos en el handler.
    #[serde(default)]
    pub cancion_id: Option<serde_json::Value>,
}

#[derive(Deserialize)]
pub struct RenamePlaylistPayload {
    pub nombre: String,
}

/// Convierte un id JSON (string o número) a String no vacío.
fn json_id_to_string(v: &serde_json::Value) -> Option<String> {
    let s = match v {
        serde_json::Value::String(s) => s.clone(),
        serde_json::Value::Number(n) => n.to_string(),
        _ => return None,
    };
    if s.trim().is_empty() { None } else { Some(s) }
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
    // Enriquecido: dueño, nº de canciones, duración total, likes y portada
    // (primera canción). Antes solo {id, nombre} y la Library mostraba
    // "0 canciones" y sin imagen para todo.
    let rows = sqlx::query!(
        r#"
        SELECT
            p.id, p.name, p.created_at,
            u.username AS owner,
            (SELECT COUNT(*) FROM playlist_songs ps WHERE ps.playlist_id = p.id) AS song_count,
            (SELECT CAST(COALESCE(SUM(ps.duration), 0) AS SIGNED) FROM playlist_songs ps WHERE ps.playlist_id = p.id) AS total_duration,
            (SELECT COUNT(*) FROM playlist_likes pl WHERE pl.playlist_id = p.id) AS likes,
            (SELECT ps.cover_url FROM playlist_songs ps WHERE ps.playlist_id = p.id ORDER BY ps.added_at ASC LIMIT 1) AS cover_url
        FROM playlists p
        JOIN users u ON u.id = p.user_id
        WHERE p.user_id = ?
        ORDER BY p.created_at DESC
        "#,
        auth.user_id
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_else(|e| {
        // No silenciar: antes un fallo de DB devolvía lista vacía sin rastro.
        tracing::error!("user_data: error de DB en listado de playlists: {}", e);
        Vec::new()
    });

    let playlists: Vec<serde_json::Value> = rows
        .into_iter()
        .map(|r| {
            serde_json::json!({
                "id": r.id,
                "nombre": r.name,
                "creada_en": r.created_at.map(|dt| dt.unix_timestamp()),
                "owner": r.owner,
                "songCount": r.song_count,
                "totalDuration": r.total_duration,
                "likes": r.likes,
                "coverUrl": r.cover_url
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

/// GET /api/v1/playlists/:id — metadata de una playlist + sus canciones.
/// Lectura pública para cualquier usuario autenticado (los likes solo tienen
/// sentido si otros pueden ver la playlist); las mutaciones siguen siendo
/// exclusivas del dueño.
pub async fn get_playlist_handler(
    State(state): State<AppState>,
    Path(playlist_id): Path<String>,
    axum::Extension(auth): axum::Extension<AuthContext>,
) -> impl IntoResponse {
    let playlist = sqlx::query!(
        r#"
        SELECT
            p.id, p.name, p.created_at, p.user_id,
            u.username AS owner,
            (SELECT COUNT(*) FROM playlist_likes pl WHERE pl.playlist_id = p.id) AS likes,
            (SELECT CAST(EXISTS(
                SELECT 1 FROM playlist_likes pl2 WHERE pl2.playlist_id = p.id AND pl2.user_id = ?
            ) AS SIGNED)) AS liked_by_me
        FROM playlists p
        JOIN users u ON u.id = p.user_id
        WHERE p.id = ?
        "#,
        auth.user_id,
        playlist_id
    )
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let playlist = match playlist {
        Some(p) => p,
        None => return (StatusCode::NOT_FOUND, "Playlist no encontrada").into_response(),
    };

    let rows = sqlx::query!(
        "SELECT track_id, song_source, title, artist, cover_url, duration FROM playlist_songs WHERE playlist_id = ? ORDER BY added_at DESC",
        playlist_id
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_else(|e| {
        // No silenciar: antes un fallo de DB devolvía lista vacía sin rastro.
        tracing::error!("user_data: error de DB en listado: {}", e);
        Vec::new()
    });

    let total_duration: i64 = rows.iter().map(|r| r.duration.unwrap_or(0) as i64).sum();

    let songs: Vec<serde_json::Value> = rows
        .into_iter()
        .map(|r| {
            // Claves alineadas con normalizeTrack() del frontend: emitimos los
            // nombres canónicos (trackName/artistName/coverArtUrl) además de los
            // legacy (titulo/artista/portada). Antes solo se enviaba
            // artist/artworkUrl → el normalizador los ignoraba y mostraba
            // "Unknown Artist" y la portada por defecto.
            serde_json::json!({
                "id": r.track_id,
                "trackId": r.track_id,
                "sourceType": r.song_source.unwrap_or_else(|| "local".to_string()),
                "trackName": r.title,
                "title": r.title,
                "titulo": r.title,
                "artistName": r.artist,
                "artist": r.artist,
                "artista": r.artist,
                "coverArtUrl": r.cover_url,
                "artworkUrl": r.cover_url,
                "portada": r.cover_url,
                "duration": r.duration,
                "duracion": r.duration
            })
        })
        .collect();

    Json(serde_json::json!({
        "id": playlist.id,
        "nombre": playlist.name,
        "creada_en": playlist.created_at.map(|dt| dt.unix_timestamp()),
        "owner": playlist.owner,
        "isOwner": playlist.user_id == auth.user_id,
        "likes": playlist.likes,
        "likedByMe": playlist.liked_by_me != 0,
        "songCount": songs.len(),
        "totalDuration": total_duration,
        "songs": songs
    }))
    .into_response()
}

/// POST /api/v1/playlists/:id/like — alterna el like del usuario sobre una
/// playlist y devuelve el estado + contador actualizado.
pub async fn toggle_playlist_like_handler(
    State(state): State<AppState>,
    Path(playlist_id): Path<String>,
    axum::Extension(auth): axum::Extension<AuthContext>,
) -> impl IntoResponse {
    // La playlist debe existir (FK lo garantiza, pero devolvemos 404 limpio).
    let exists = sqlx::query!("SELECT id FROM playlists WHERE id = ?", playlist_id)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);
    if exists.is_none() {
        return (StatusCode::NOT_FOUND, "Playlist no encontrada").into_response();
    }

    // Toggle: si el DELETE no afectó filas, no había like → insertar.
    let deleted = sqlx::query!(
        "DELETE FROM playlist_likes WHERE playlist_id = ? AND user_id = ?",
        playlist_id,
        auth.user_id
    )
    .execute(&state.db)
    .await
    .map(|r| r.rows_affected())
    .unwrap_or(0);

    let liked = if deleted == 0 {
        let res = sqlx::query!(
            "INSERT IGNORE INTO playlist_likes (playlist_id, user_id) VALUES (?, ?)",
            playlist_id,
            auth.user_id
        )
        .execute(&state.db)
        .await;
        if let Err(e) = res {
            tracing::error!("toggle_playlist_like: fallo al insertar: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, "Error DB").into_response();
        }
        true
    } else {
        false
    };

    let likes = sqlx::query!(
        "SELECT COUNT(*) AS n FROM playlist_likes WHERE playlist_id = ?",
        playlist_id
    )
    .fetch_one(&state.db)
    .await
    .map(|r| r.n)
    .unwrap_or(0);

    Json(serde_json::json!({ "liked": liked, "likes": likes })).into_response()
}

/// PATCH /api/v1/playlists/:id — renombra una playlist.
pub async fn rename_playlist_handler(
    State(state): State<AppState>,
    Path(playlist_id): Path<String>,
    axum::Extension(auth): axum::Extension<AuthContext>,
    Json(payload): Json<RenamePlaylistPayload>,
) -> impl IntoResponse {
    let nombre = payload.nombre.trim().to_string();
    if nombre.is_empty() {
        return (StatusCode::BAD_REQUEST, "Nombre requerido").into_response();
    }

    let result = sqlx::query!(
        "UPDATE playlists SET name = ? WHERE id = ? AND user_id = ?",
        nombre,
        playlist_id,
        auth.user_id
    )
    .execute(&state.db)
    .await;

    match result {
        Ok(res) if res.rows_affected() > 0 => {
            Json(serde_json::json!({ "id": playlist_id, "nombre": nombre })).into_response()
        }
        Ok(_) => (StatusCode::NOT_FOUND, "No encontrada").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, format!("Error DB: {}", e)).into_response(),
    }
}

pub async fn get_playlist_songs_handler(
    State(state): State<AppState>,
    Path(playlist_id): Path<String>,
    axum::Extension(_auth): axum::Extension<AuthContext>,
) -> impl IntoResponse {
    // Lectura pública (coherente con get_playlist_handler): cualquier usuario
    // autenticado puede reproducir una playlist; solo el dueño la modifica.
    let playlist = sqlx::query!("SELECT id FROM playlists WHERE id = ?", playlist_id)
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
    .unwrap_or_else(|e| {
        // No silenciar: antes un fallo de DB devolvía lista vacía sin rastro.
        tracing::error!("user_data: error de DB en listado: {}", e);
        Vec::new()
    });

    let songs: Vec<serde_json::Value> = rows
        .into_iter()
        .map(|r| {
            // Claves alineadas con normalizeTrack() del frontend: emitimos los
            // nombres canónicos (trackName/artistName/coverArtUrl) además de los
            // legacy (titulo/artista/portada). Antes solo se enviaba
            // artist/artworkUrl → el normalizador los ignoraba y mostraba
            // "Unknown Artist" y la portada por defecto.
            serde_json::json!({
                "id": r.track_id,
                "trackId": r.track_id,
                "sourceType": r.song_source.unwrap_or_else(|| "local".to_string()),
                "trackName": r.title,
                "title": r.title,
                "titulo": r.title,
                "artistName": r.artist,
                "artist": r.artist,
                "artista": r.artist,
                "coverArtUrl": r.cover_url,
                "artworkUrl": r.cover_url,
                "portada": r.cover_url,
                "duration": r.duration,
                "duracion": r.duration
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
    .unwrap_or_else(|e| {
        // No silenciar: antes un fallo de DB devolvía lista vacía sin rastro.
        tracing::error!("user_data: error de DB en listado: {}", e);
        Vec::new()
    });

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
    let track_id = match payload.cancion_id.as_ref().and_then(json_id_to_string) {
        Some(s) => s,
        None => return (StatusCode::BAD_REQUEST, "cancion_id requerido").into_response(),
    };

    let _ = sqlx::query!(
        "INSERT INTO user_history (user_id, track_id) VALUES (?, ?)",
        auth.user_id,
        track_id
    )
    .execute(&state.db)
    .await;

    (StatusCode::OK, "Añadido al historial").into_response()
}

// -------------------------------------------------------------------------
// MANEJADORES: LIKES
// -------------------------------------------------------------------------
#[derive(Deserialize)]
pub struct LikesDetailedQuery {
    /// 'local' | 'archive' | ausente (= todos)
    pub source: Option<String>,
}

/// GET /api/v1/music/likes/detailed — favoritos CON metadata (título, artista,
/// portada) para la Library. Los endpoints /music/songs/likes y /music/ia/likes
/// siguen devolviendo solo IDs (los consume PlayerContext) — no se tocan.
pub async fn get_likes_detailed_handler(
    State(state): State<AppState>,
    axum::extract::Query(q): axum::extract::Query<LikesDetailedQuery>,
    axum::Extension(auth): axum::Extension<AuthContext>,
) -> impl IntoResponse {
    // La metadata puede vivir en track_links (mbid, catálogo) o en trackMetadata
    // (caché de búsquedas/IA); se toma la primera disponible.
    let rows = sqlx::query!(
        r#"
        SELECT
            ul.track_id,
            ul.source,
            ul.liked_at,
            COALESCE(tl.title, tm.trackName)        AS title,
            COALESCE(tl.artist, tm.artistName)      AS artist,
            COALESCE(tl.cover_url, tm.coverArtUrl)  AS cover_url
        FROM user_likes ul
        LEFT JOIN track_links   tl ON tl.mbid    = ul.track_id
        LEFT JOIN trackMetadata tm ON tm.trackId = ul.track_id
        WHERE ul.user_id = ?
          AND (? IS NULL
               OR (? = 'local'   AND ul.source = 'local')
               OR (? = 'archive' AND ul.source != 'local'))
        ORDER BY ul.liked_at DESC
        "#,
        auth.user_id,
        q.source,
        q.source,
        q.source
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_else(|e| {
        tracing::error!("user_data: error de DB en likes detailed: {}", e);
        Vec::new()
    });

    let likes: Vec<serde_json::Value> = rows
        .into_iter()
        .map(|r| {
            let cover = r
                .cover_url
                .filter(|c| !c.is_empty())
                .unwrap_or_else(|| format!("/api/v1/covers/{}", r.track_id));
            serde_json::json!({
                "id": r.track_id,
                "trackId": r.track_id,
                "title": r.title.unwrap_or_else(|| "Sin título".to_string()),
                "artist": r.artist.unwrap_or_else(|| "Artista desconocido".to_string()),
                "coverUrl": cover,
                "source": r.source,
                "likedAt": r.liked_at.map(|dt| dt.unix_timestamp())
            })
        })
        .collect();

    Json(likes)
}

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
    .unwrap_or_else(|e| {
        // No silenciar: antes un fallo de DB devolvía lista vacía sin rastro.
        tracing::error!("user_data: error de DB en listado: {}", e);
        Vec::new()
    });

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
    .unwrap_or_else(|e| {
        // No silenciar: antes un fallo de DB devolvía lista vacía sin rastro.
        tracing::error!("user_data: error de DB en listado: {}", e);
        Vec::new()
    });

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
