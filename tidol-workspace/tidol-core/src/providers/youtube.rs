use super::provider_trait::{EmbedInfo, MusicProvider, Platform, ProviderError, Track};
use async_trait::async_trait;
use moka::future::Cache;
use std::time::Duration;

/// YouTube provider using the official YouTube Data API v3.
/// Only returns embed URLs — never direct audio streams.
pub struct YouTubeProvider {
    api_key: String,
    http: reqwest::Client,
    /// Cache for search results (key: query string, TTL: 1 hour)
    search_cache: Cache<String, Vec<Track>>,
    /// Cache for video details (key: video ID, TTL: 1 hour)
    resolve_cache: Cache<String, EmbedInfo>,
}

impl YouTubeProvider {
    pub fn new(api_key: String) -> Self {
        Self {
            api_key,
            http: reqwest::Client::builder()
                .timeout(Duration::from_secs(10))
                .build()
                .unwrap_or_else(|_| reqwest::Client::new()),
            search_cache: Cache::builder()
                .time_to_live(Duration::from_secs(3600))
                .max_capacity(1000)
                .build(),
            resolve_cache: Cache::builder()
                .time_to_live(Duration::from_secs(3600))
                .max_capacity(5000)
                .build(),
        }
    }

    fn embed_url(video_id: &str) -> String {
        format!("https://www.youtube.com/embed/{}", video_id)
    }

    fn external_url(video_id: &str) -> String {
        format!("https://www.youtube.com/watch?v={}", video_id)
    }

    fn thumbnail_url(video_id: &str) -> String {
        format!("https://i.ytimg.com/vi/{}/hqdefault.jpg", video_id)
    }

    /// Parse ISO 8601 duration (PT#H#M#S) to seconds.
    fn parse_iso_duration(iso: &str) -> Option<u64> {
        let s = iso.strip_prefix("PT")?;
        let mut total: u64 = 0;
        let mut num_buf = String::new();

        for ch in s.chars() {
            match ch {
                '0'..='9' => num_buf.push(ch),
                'H' => {
                    total += num_buf.parse::<u64>().unwrap_or(0) * 3600;
                    num_buf.clear();
                }
                'M' => {
                    total += num_buf.parse::<u64>().unwrap_or(0) * 60;
                    num_buf.clear();
                }
                'S' => {
                    total += num_buf.parse::<u64>().unwrap_or(0);
                    num_buf.clear();
                }
                _ => {}
            }
        }
        Some(total)
    }
}

#[async_trait]
impl MusicProvider for YouTubeProvider {
    fn name(&self) -> &'static str {
        "YouTube"
    }

    fn platform(&self) -> Platform {
        Platform::YouTube
    }

    async fn search(&self, query: &str, limit: u32) -> Result<Vec<Track>, ProviderError> {
        let cache_key = format!("{}:{}", query, limit);

        if let Some(cached) = self.search_cache.get(&cache_key).await {
            return Ok(cached);
        }

        // Step 1: Search for videos in Music category (videoCategoryId=10)
        let search_resp = self
            .http
            .get("https://www.googleapis.com/youtube/v3/search")
            .query(&[
                ("part", "snippet"),
                ("q", query),
                ("type", "video"),
                ("videoCategoryId", "10"),
                ("maxResults", &limit.to_string()),
                ("key", &self.api_key),
            ])
            .send()
            .await?;

        if search_resp.status() == 403 {
            return Err(ProviderError::RateLimited);
        }

        if !search_resp.status().is_success() {
            let status = search_resp.status();
            let body = search_resp.text().await.unwrap_or_default();
            return Err(ProviderError::Api(format!(
                "YouTube search API returned {}: {}",
                status, body
            )));
        }

        let search_json: serde_json::Value = search_resp.json().await?;

        let items = search_json["items"]
            .as_array()
            .ok_or_else(|| ProviderError::Parse("No items in search response".into()))?;

        if items.is_empty() {
            let result = Vec::new();
            self.search_cache.insert(cache_key, result.clone()).await;
            return Ok(result);
        }

        // Collect video IDs for batch details request (duration, etc.)
        let video_ids: Vec<&str> = items
            .iter()
            .filter_map(|item| item["id"]["videoId"].as_str())
            .collect();

        // Step 2: Get video details (duration) in a single batch call
        let mut durations: std::collections::HashMap<String, u64> =
            std::collections::HashMap::new();

        if !video_ids.is_empty() {
            let ids_param = video_ids.join(",");
            let details_resp = self
                .http
                .get("https://www.googleapis.com/youtube/v3/videos")
                .query(&[
                    ("part", "contentDetails"),
                    ("id", &ids_param),
                    ("key", &self.api_key),
                ])
                .send()
                .await?;

            if let Ok(details_json) = details_resp.json::<serde_json::Value>().await {
                if let Some(detail_items) = details_json["items"].as_array() {
                    for item in detail_items {
                        if let (Some(id), Some(duration_str)) = (
                            item["id"].as_str(),
                            item["contentDetails"]["duration"].as_str(),
                        ) {
                            if let Some(secs) = Self::parse_iso_duration(duration_str) {
                                durations.insert(id.to_string(), secs);
                            }
                        }
                    }
                }
            }
        }

        // Step 3: Build Track results
        let tracks: Vec<Track> = items
            .iter()
            .filter_map(|item| {
                let video_id = item["id"]["videoId"].as_str()?;
                let snippet = &item["snippet"];
                let title = snippet["title"].as_str().unwrap_or("Unknown").to_string();
                let artist = snippet["channelTitle"]
                    .as_str()
                    .unwrap_or("Unknown")
                    .to_string();
                let thumbnail = snippet["thumbnails"]["high"]["url"]
                    .as_str()
                    .map(|s| s.to_string())
                    .or_else(|| Some(Self::thumbnail_url(video_id)));

                Some(Track {
                    id: video_id.to_string(),
                    platform: Platform::YouTube,
                    title,
                    artist,
                    thumbnail,
                    duration: durations.get(video_id).copied(),
                    embed_url: Self::embed_url(video_id),
                    external_url: Self::external_url(video_id),
                    preview_url: None, // YouTube has no legal preview URL
                })
            })
            .collect();

        self.search_cache.insert(cache_key, tracks.clone()).await;
        Ok(tracks)
    }

    async fn resolve(&self, id: &str) -> Result<EmbedInfo, ProviderError> {
        if let Some(cached) = self.resolve_cache.get(&id.to_string()).await {
            return Ok(cached);
        }

        // Verify the video exists via a lightweight API call
        let resp = self
            .http
            .get("https://www.googleapis.com/youtube/v3/videos")
            .query(&[
                ("part", "id"),
                ("id", id),
                ("key", &self.api_key),
            ])
            .send()
            .await?;

        if resp.status() == 403 {
            return Err(ProviderError::RateLimited);
        }

        let json: serde_json::Value = resp.json().await?;
        let items = json["items"]
            .as_array()
            .ok_or_else(|| ProviderError::NotFound(format!("Video {} not found", id)))?;

        if items.is_empty() {
            return Err(ProviderError::NotFound(format!("Video {} not found", id)));
        }

        let info = EmbedInfo {
            embed_url: Self::embed_url(id),
            external_url: Self::external_url(id),
            preview_url: None,
        };

        self.resolve_cache.insert(id.to_string(), info.clone()).await;
        Ok(info)
    }

    fn max_timeout(&self) -> Duration {
        Duration::from_secs(5)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_iso_duration() {
        assert_eq!(YouTubeProvider::parse_iso_duration("PT3M45S"), Some(225));
        assert_eq!(YouTubeProvider::parse_iso_duration("PT1H2M3S"), Some(3723));
        assert_eq!(YouTubeProvider::parse_iso_duration("PT30S"), Some(30));
        assert_eq!(YouTubeProvider::parse_iso_duration("PT5M"), Some(300));
    }

    #[test]
    fn test_embed_url() {
        assert_eq!(
            YouTubeProvider::embed_url("dQw4w9WgXcQ"),
            "https://www.youtube.com/embed/dQw4w9WgXcQ"
        );
    }

    #[test]
    fn test_external_url() {
        assert_eq!(
            YouTubeProvider::external_url("dQw4w9WgXcQ"),
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        );
    }

    #[tokio::test]
    async fn test_resolve_missing_api_key_returns_error() {
        let provider = YouTubeProvider::new("INVALID_KEY".to_string());
        // With an invalid key, the API should return an error
        let result = provider.resolve("dQw4w9WgXcQ").await;
        // We expect either an API error or HTTP error — not a panic
        assert!(result.is_err());
    }
}
