use crate::{
    models::{AlbumResponse, ArtistResponse, TrackMetadataResponse},
    AppState,
};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Deserialize;

#[derive(Deserialize)]
pub struct SearchQuery {
    pub q: Option<String>,
    pub name: Option<String>,
}

pub async fn get_albums_handler(State(state): State<AppState>) -> Result<Json<Vec<AlbumResponse>>, StatusCode> {
    let rows = sqlx::query!(
        r#"
        SELECT a.mbid as id, a.title, a.artist_mbid as artist_id, ar.name as artist_name, a.release_year, a.cover_url, a.cover_status
        FROM albums a
        LEFT JOIN artists ar ON a.artist_mbid = ar.mbid
        ORDER BY a.release_year DESC
        LIMIT 50
        "#
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Error consultando álbumes: {:?}", e); 
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let albums = rows.into_iter().map(|r| {
        AlbumResponse {
            id: r.id,
            title: r.title,
            artist_id: r.artist_id,
            artist_name: r.artist_name,
            release_year: r.release_year,
            cover_url: if r.cover_status.as_deref() == Some("not_found") {
                Some("/default-album.png".to_string())
            } else {
                r.cover_url
            },
        }
    }).collect();

    Ok(Json(albums))
}
pub async fn get_album_by_id_handler(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<AlbumResponse>, StatusCode> {
    let r = sqlx::query!(
        r#"
        SELECT a.mbid as id, a.title, a.artist_mbid as artist_id, ar.name as artist_name, a.release_year, a.cover_url, a.cover_status
        FROM albums a
        LEFT JOIN artists ar ON a.artist_mbid = ar.mbid
        WHERE a.mbid = ?
        "#,
        id
    )
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    match r {
        Some(r) => {
            let final_cover = if r.cover_status.as_deref() == Some("not_found") {
                Some("/default-album.png".to_string())
            } else {
                r.cover_url
            };
            Ok(Json(AlbumResponse {
                id: r.id,
                title: r.title,
                artist_id: r.artist_id,
                artist_name: r.artist_name,
                release_year: r.release_year,
                cover_url: final_cover,
            }))
        }
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn get_album_songs_handler(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let rows = sqlx::query!(
        r#"
        SELECT trackId, trackName, artistName, albumName, durationSeconds, coverArtUrl, sourceLink, hasLyrics, isCached
        FROM trackMetadata 
        WHERE album_id = ?
        "#,
        id
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let tracks: Vec<_> = rows
        .into_iter()
        .map(|r| TrackMetadataResponse {
            track_id: r.trackId,
            track_name: r.trackName,
            artist_name: r.artistName,
            album_name: r.albumName,
            duration_seconds: r.durationSeconds,
            cover_art_url: r.coverArtUrl,
            source_link: r.sourceLink,
            has_lyrics: r.hasLyrics == Some(1),
            is_cached: r.isCached == Some(1),
        })
        .collect();

    Json(tracks)
}

pub async fn resolve_artist_handler(
    State(state): State<AppState>,
    Query(query): Query<SearchQuery>,
) -> Result<Json<ArtistResponse>, StatusCode> {
    let name_query = query.name.unwrap_or_default();

    let r = sqlx::query!(
        r#"
        SELECT mbid as id, name, cover_url as image_url
        FROM artists 
        WHERE name LIKE ?
        LIMIT 1
        "#,
        format!("%{}%", name_query)
    )
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    match r {
        Some(r) => Ok(Json(ArtistResponse {
            id: r.id,
            name: r.name,
            image_url: r.image_url,
        })),
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn get_artist_by_id_handler(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ArtistResponse>, StatusCode> {
    let r = sqlx::query!(
        r#"
        SELECT mbid as id, name, cover_url as image_url
        FROM artists 
        WHERE mbid = ?
        "#,
        id
    )
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    match r {
        Some(r) => Ok(Json(ArtistResponse {
            id: r.id,
            name: r.name,
            image_url: r.image_url,
        })),
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn get_artist_songs_handler(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let rows = sqlx::query!(
        r#"
        SELECT trackId, trackName, artistName, albumName, durationSeconds, coverArtUrl, sourceLink, hasLyrics, isCached
        FROM trackMetadata 
        WHERE artist_id = ?
        "#,
        id
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let tracks: Vec<_> = rows
        .into_iter()
        .map(|r| TrackMetadataResponse {
            track_id: r.trackId,
            track_name: r.trackName,
            artist_name: r.artistName,
            album_name: r.albumName,
            duration_seconds: r.durationSeconds,
            cover_art_url: r.coverArtUrl,
            source_link: r.sourceLink,
            has_lyrics: r.hasLyrics == Some(1),
            is_cached: r.isCached == Some(1),
        })
        .collect();

    Json(tracks)
}

pub async fn get_home_recommendations_handler() -> impl IntoResponse {
    // MOCK: Home recommendations stub
    Json(serde_json::json!([]))
}

pub async fn get_ia_discoveries_handler() -> impl IntoResponse {
    // MOCK: IA discoveries stub
    Json(serde_json::json!([]))
}
