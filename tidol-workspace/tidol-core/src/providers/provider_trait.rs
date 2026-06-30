use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::time::Duration;

/// Represents the platform a track originates from.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Platform {
    #[serde(rename = "youtube")]
    YouTube,
    Spotify,
    #[serde(rename = "soundcloud")]
    SoundCloud,
    InternetArchive,
}

impl std::fmt::Display for Platform {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Platform::YouTube => write!(f, "youtube"),
            Platform::Spotify => write!(f, "spotify"),
            Platform::SoundCloud => write!(f, "soundcloud"),
            Platform::InternetArchive => write!(f, "internet_archive"),
        }
    }
}

/// Information needed to embed or link to a track on its native platform.
/// No direct audio URLs for copyrighted content — only embed/external URLs.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbedInfo {
    /// URL for an iframe embed (e.g. YouTube embed, Spotify embed)
    pub embed_url: String,
    /// URL to open the track on the platform's website/app
    pub external_url: String,
    /// Optional preview URL (e.g. Spotify 30s preview, or Internet Archive direct stream)
    pub preview_url: Option<String>,
}

/// A track as returned by search results.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Track {
    /// Platform-specific track ID
    pub id: String,
    /// Which platform this track is from
    pub platform: Platform,
    /// Track title
    pub title: String,
    /// Artist name
    pub artist: String,
    /// Thumbnail/cover art URL
    pub thumbnail: Option<String>,
    /// Duration in seconds
    pub duration: Option<u64>,
    /// Embed URL for iframe playback
    pub embed_url: String,
    /// URL to open on the platform's website
    pub external_url: String,
    /// Optional preview/direct audio URL (legal only: Spotify 30s preview, Internet Archive CC content)
    pub preview_url: Option<String>,
}

/// The core trait for all music providers in the legal embed-based architecture.
/// Providers search for tracks and resolve embed information — they NEVER return
/// direct audio stream URLs for copyrighted content.
#[async_trait]
pub trait MusicProvider: Send + Sync {
    /// Display name of this provider
    fn name(&self) -> &'static str;

    /// Which platform this provider serves
    fn platform(&self) -> Platform;

    /// Search for tracks matching a query. Returns tracks with embed/external URLs populated.
    async fn search(&self, query: &str, limit: u32) -> Result<Vec<Track>, ProviderError>;

    /// Resolve embed information for a specific track by its platform ID.
    async fn resolve(&self, id: &str) -> Result<EmbedInfo, ProviderError>;

    /// Maximum time the orchestrator should wait for this provider.
    fn max_timeout(&self) -> Duration {
        Duration::from_secs(5)
    }
}

/// Errors that can occur in provider operations.
#[derive(Debug, thiserror::Error)]
pub enum ProviderError {
    #[error("Track not found: {0}")]
    NotFound(String),

    #[error("API error: {0}")]
    Api(String),

    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),

    #[error("Rate limited")]
    RateLimited,

    #[error("Missing configuration: {0}")]
    MissingConfig(String),

    #[error("Parse error: {0}")]
    Parse(String),
}
