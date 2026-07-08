use serde::Deserialize;

use crate::models::{AlbumResponse, ArtistResponse, TrackMetadataResponse};
use crate::TidolCore;

#[derive(Deserialize)]
pub struct SearchQuery {
    pub q: Option<String>,
    pub name: Option<String>,
}

impl TidolCore {
    pub async fn get_albums(&self) -> Result<Vec<AlbumResponse>, sqlx::Error> {
        let rows = sqlx::query!(
            r#"
            SELECT a.mbid as id, a.title, a.artist_mbid as artist_id, ar.name as artist_name, a.release_year, a.cover_url, a.cover_status
            FROM albums a
            LEFT JOIN artists ar ON a.artist_mbid = ar.mbid
            ORDER BY a.release_year DESC
            LIMIT 50
            "#
        )
        .fetch_all(&self.db)
        .await?;

        let albums = rows
            .into_iter()
            .map(|r| AlbumResponse {
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
            })
            .collect();

        Ok(albums)
    }

    pub async fn get_album_by_id(
        &self,
        id: &str,
    ) -> Result<Option<AlbumResponse>, sqlx::Error> {
        let r = sqlx::query!(
            r#"
            SELECT a.mbid as id, a.title, a.artist_mbid as artist_id, ar.name as artist_name, a.release_year, a.cover_url, a.cover_status
            FROM albums a
            LEFT JOIN artists ar ON a.artist_mbid = ar.mbid
            WHERE a.mbid = ?
            "#,
            id
        )
        .fetch_optional(&self.db)
        .await?;

        Ok(r.map(|r| {
            let final_cover = if r.cover_status.as_deref() == Some("not_found") {
                Some("/default-album.png".to_string())
            } else {
                r.cover_url
            };
            AlbumResponse {
                id: r.id,
                title: r.title,
                artist_id: r.artist_id,
                artist_name: r.artist_name,
                release_year: r.release_year,
                cover_url: final_cover,
            }
        }))
    }

    pub async fn get_album_songs(&self, id: &str) -> Vec<TrackMetadataResponse> {
        let rows = sqlx::query!(
            r#"
            SELECT trackId, trackName, artistName, albumName, durationSeconds, coverArtUrl, sourceLink, hasLyrics, isCached
            FROM trackMetadata
            WHERE album_id = ?
            "#,
            id
        )
        .fetch_all(&self.db)
        .await
        .unwrap_or_default();

        rows.into_iter()
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
            .collect()
    }

    pub async fn resolve_artist(
        &self,
        name: Option<String>,
    ) -> Result<Option<ArtistResponse>, sqlx::Error> {
        let name_query = name.unwrap_or_default();

        let r = sqlx::query!(
            r#"
            SELECT mbid as id, name, cover_url as image_url
            FROM artists
            WHERE name LIKE ?
            LIMIT 1
            "#,
            format!("%{}%", name_query)
        )
        .fetch_optional(&self.db)
        .await?;

        Ok(r.map(|r| ArtistResponse {
            id: r.id,
            name: r.name,
            image_url: r.image_url,
        }))
    }

    pub async fn get_artist_by_id(
        &self,
        id: &str,
    ) -> Result<Option<ArtistResponse>, sqlx::Error> {
        let r = sqlx::query!(
            r#"
            SELECT mbid as id, name, cover_url as image_url
            FROM artists
            WHERE mbid = ?
            "#,
            id
        )
        .fetch_optional(&self.db)
        .await?;

        Ok(r.map(|r| ArtistResponse {
            id: r.id,
            name: r.name,
            image_url: r.image_url,
        }))
    }

    pub async fn get_artist_songs(&self, id: &str) -> Vec<TrackMetadataResponse> {
        let rows = sqlx::query!(
            r#"
            SELECT trackId, trackName, artistName, albumName, durationSeconds, coverArtUrl, sourceLink, hasLyrics, isCached
            FROM trackMetadata
            WHERE artist_id = ?
            "#,
            id
        )
        .fetch_all(&self.db)
        .await
        .unwrap_or_default();

        rows.into_iter()
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
            .collect()
    }
}
