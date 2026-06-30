use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Clone, Debug, Serialize)]
pub struct WorkerEvent {
    pub track_id: String,
    pub status: String,
    pub progress: i32,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResponse {
    pub query: String,
    #[serde(rename = "canonicalHit")]
    pub canonical_hit: Option<TrackResponse>,
    #[serde(rename = "localResults")]
    pub local_results: Vec<serde_json::Value>,
    #[serde(rename = "archiveResults")]
    pub archive_results: Vec<TrackResponse>,
    pub artists: Vec<ArtistSearchResponse>,
    pub pagination: PaginationMeta,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtistSearchResponse {
    pub mbid: String,
    pub name: String,
    #[serde(rename = "coverUrl")]
    pub cover_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackResponse {
    #[serde(rename = "trackId")]
    pub track_id: String,
    pub title: String,
    pub artist: String,
    #[serde(rename = "coverUrl")]
    pub cover_url: Option<String>,
    pub source: String,
    pub duration: Option<i32>,
    #[serde(rename = "hasLyrics")]
    pub has_lyrics: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginationMeta {
    #[serde(rename = "currentPage")]
    pub current_page: u32,
    #[serde(rename = "hasNextPage")]
    pub has_next_page: bool,
    #[serde(rename = "totalResults")]
    pub total_results: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CanonicalHit {
    #[serde(rename = "trackId")]
    pub track_id: String,
    #[serde(rename = "trackName")]
    pub track_name: String,
    #[serde(rename = "artistName")]
    pub artist_name: Option<String>,
    #[serde(rename = "coverArtUrl")]
    pub cover_art_url: Option<String>,
    #[serde(rename = "sourceLink")]
    pub source_link: Option<String>,
    pub confidence: f64,
    #[serde(rename = "hasLyrics")]
    pub has_lyrics: bool,
    #[serde(rename = "isCached")]
    pub is_cached: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LocalSearchSection {
    pub canciones: Vec<LocalTrack>,
    pub albums: Vec<Value>,
    pub artists: Vec<Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LocalTrack {
    #[serde(rename = "trackId")]
    pub track_id: String,
    #[serde(rename = "trackName")]
    pub track_name: String,
    #[serde(rename = "artistName")]
    pub artist_name: Option<String>,
    #[serde(rename = "coverArtUrl")]
    pub cover_art_url: Option<String>,
    #[serde(rename = "hasLyrics")]
    pub has_lyrics: bool,
    #[serde(rename = "isCached")]
    pub is_cached: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ArtistResponse {
    pub id: String,
    pub name: String,
    #[serde(rename = "imageUrl")]
    pub image_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AlbumResponse {
    pub id: String,
    pub title: String,
    #[serde(rename = "artistId")]
    pub artist_id: String,
    #[serde(rename = "artistName")]
    pub artist_name: Option<String>,
    #[serde(rename = "releaseYear")]
    pub release_year: Option<i32>,
    #[serde(rename = "coverUrl")]
    pub cover_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TrackMetadataResponse {
    #[serde(rename = "trackId")]
    pub track_id: String,
    #[serde(rename = "trackName")]
    pub track_name: String,
    #[serde(rename = "artistName")]
    pub artist_name: Option<String>,
    #[serde(rename = "albumName")]
    pub album_name: Option<String>,
    #[serde(rename = "durationSeconds")]
    pub duration_seconds: Option<i32>,
    #[serde(rename = "coverArtUrl")]
    pub cover_art_url: Option<String>,
    #[serde(rename = "sourceLink")]
    pub source_link: Option<String>,
    #[serde(rename = "hasLyrics")]
    pub has_lyrics: bool,
    #[serde(rename = "isCached")]
    pub is_cached: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ArtistProfileResponse {
    pub id: String,
    pub name: String,
    #[serde(rename = "coverUrl")]
    pub cover_url: String,
    pub biography: Option<String>,
    pub albums: Vec<AlbumResponse>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AlbumTrackResponse {
    #[serde(rename = "trackId")]
    pub track_id: String,
    pub title: String,
    pub duration: Option<i32>,
    #[serde(rename = "trackNumber")]
    pub track_number: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct AlbumDetailsResponse {
    pub mbid: String,
    pub title: String,
    #[serde(rename = "artistName")]
    pub artist_name: String,
    #[serde(rename = "releaseYear")]
    pub release_year: Option<i32>,
    #[serde(rename = "coverUrl")]
    pub cover_url: Option<String>,
    pub tracks: Vec<AlbumTrackResponse>,
}

#[derive(Debug, Serialize)]
pub struct HomeArtistResponse {
    pub mbid: String,
    pub name: String,
    #[serde(rename = "coverUrl")]
    pub cover_url: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct HomeDashboardDTO {
    #[serde(rename = "listenAgain")]
    pub listen_again: Vec<TrackResponse>,
    #[serde(rename = "recentlyPlayed")]
    pub recently_played: Vec<TrackResponse>,
    #[serde(rename = "topArtists")]
    pub top_artists: Vec<HomeArtistResponse>,
    pub recommendations: Vec<TrackResponse>,
}
