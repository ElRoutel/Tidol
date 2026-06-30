use super::provider_trait::{EmbedInfo, MusicProvider, Platform, ProviderError, Track};
use async_trait::async_trait;
use moka::future::Cache;
use std::time::Duration;

/// SoundCloud provider using the official SoundCloud API.
/// Returns embed URLs for iframe playback — no direct audio streaming.
pub struct SoundCloudProvider {
    client_id: String,
    http: reqwest::Client,
    search_cache: Cache<String, Vec<Track>>,
    resolve_cache: Cache<String, EmbedInfo>,
}

impl SoundCloudProvider {
    pub fn new(client_id: String) -> Self {
        Self {
            client_id,
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

    fn embed_url(track_id: &str) -> String {
        format!(
            "https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/{}&auto_play=false&show_artwork=true&visual=true",
            track_id
        )
    }

    fn external_url_from_permalink(permalink_url: &str) -> String {
        permalink_url.to_string()
    }
}

#[async_trait]
impl MusicProvider for SoundCloudProvider {
    fn name(&self) -> &'static str {
        "SoundCloud"
    }

    fn platform(&self) -> Platform {
        Platform::SoundCloud
    }

    async fn search(&self, query: &str, limit: u32) -> Result<Vec<Track>, ProviderError> {
        if self.client_id.is_empty() {
            return Err(ProviderError::MissingConfig(
                "SoundCloud client_id not configured".into(),
            ));
        }

        let cache_key = format!("{}:{}", query, limit);
        if let Some(cached) = self.search_cache.get(&cache_key).await {
            return Ok(cached);
        }

        let resp = self
            .http
            .get("https://api.soundcloud.com/tracks")
            .query(&[
                ("q", query),
                ("limit", &limit.to_string()),
                ("client_id", &self.client_id),
            ])
            .send()
            .await?;

        if resp.status().as_u16() == 429 {
            return Err(ProviderError::RateLimited);
        }

        if !resp.status().is_success() {
            return Err(ProviderError::Api(format!(
                "SoundCloud search returned {}",
                resp.status()
            )));
        }

        let items: Vec<serde_json::Value> = resp.json().await?;

        let tracks: Vec<Track> = items
            .iter()
            .filter_map(|item| {
                let id = item["id"].as_u64()?.to_string();
                let title = item["title"].as_str()?.to_string();
                let artist = item["user"]["username"].as_str()?.to_string();
                let duration_ms = item["duration"].as_u64()?;
                let thumbnail = item["artwork_url"].as_str().map(|s| {
                    // Replace small size with large
                    s.replace("-large.", "-t500x500.")
                });
                let permalink = item["permalink_url"]
                    .as_str()
                    .unwrap_or("")
                    .to_string();

                Some(Track {
                    id: id.clone(),
                    platform: Platform::SoundCloud,
                    title,
                    artist,
                    thumbnail,
                    duration: Some(duration_ms / 1000),
                    embed_url: Self::embed_url(&id),
                    external_url: Self::external_url_from_permalink(&permalink),
                    preview_url: None, // SoundCloud does not provide legal preview URLs
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

        if self.client_id.is_empty() {
            return Err(ProviderError::MissingConfig(
                "SoundCloud client_id not configured".into(),
            ));
        }

        let resp = self
            .http
            .get(format!("https://api.soundcloud.com/tracks/{}", id))
            .query(&[("client_id", &self.client_id)])
            .send()
            .await?;

        if resp.status().as_u16() == 404 {
            return Err(ProviderError::NotFound(format!(
                "SoundCloud track {} not found",
                id
            )));
        }

        if !resp.status().is_success() {
            return Err(ProviderError::Api(format!(
                "SoundCloud track API returned {}",
                resp.status()
            )));
        }

        let json: serde_json::Value = resp.json().await?;
        let permalink = json["permalink_url"]
            .as_str()
            .unwrap_or("")
            .to_string();

        let info = EmbedInfo {
            embed_url: Self::embed_url(id),
            external_url: Self::external_url_from_permalink(&permalink),
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
    fn test_embed_url() {
        let url = SoundCloudProvider::embed_url("123456789");
        assert!(url.contains("soundcloud.com/player"));
        assert!(url.contains("123456789"));
    }
}
