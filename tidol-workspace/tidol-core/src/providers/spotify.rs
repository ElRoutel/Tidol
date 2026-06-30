use super::provider_trait::{EmbedInfo, MusicProvider, Platform, ProviderError, Track};
use async_trait::async_trait;
use base64::Engine;
use moka::future::Cache;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

#[derive(Clone)]
struct SpotifyToken {
    access_token: String,
    expires_at: Instant,
}

/// Spotify provider using the official Spotify Web API (Client Credentials Flow).
/// Returns embed URLs for iframe playback and captures the legal 30-second preview_url.
pub struct SpotifyProvider {
    client_id: String,
    client_secret: String,
    token: RwLock<Option<SpotifyToken>>,
    http: reqwest::Client,
    /// Search results cache (TTL: 1 hour)
    search_cache: Cache<String, Vec<Track>>,
    /// Resolve cache (TTL: 1 hour)
    resolve_cache: Cache<String, EmbedInfo>,
}

impl SpotifyProvider {
    pub fn new(client_id: String, client_secret: String) -> Self {
        Self {
            client_id,
            client_secret,
            token: RwLock::new(None),
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

    /// Get a valid access token, refreshing if expired.
    async fn access_token(&self) -> Result<String, ProviderError> {
        // Check existing token
        {
            let t = self.token.read().await;
            if let Some(ref tok) = *t {
                if tok.expires_at > Instant::now() {
                    return Ok(tok.access_token.clone());
                }
            }
        }

        // Refresh token
        let mut t = self.token.write().await;
        // Double-check after acquiring write lock
        if let Some(ref tok) = *t {
            if tok.expires_at > Instant::now() {
                return Ok(tok.access_token.clone());
            }
        }

        let creds = base64::engine::general_purpose::STANDARD
            .encode(format!("{}:{}", self.client_id, self.client_secret));

        let resp = self
            .http
            .post("https://accounts.spotify.com/api/token")
            .header("Authorization", format!("Basic {}", creds))
            .form(&[("grant_type", "client_credentials")])
            .send()
            .await?
            .json::<serde_json::Value>()
            .await?;

        let tok = resp["access_token"]
            .as_str()
            .ok_or_else(|| ProviderError::Api("No access_token in Spotify response".into()))?
            .to_string();
        let exp = resp["expires_in"].as_u64().unwrap_or(3600);

        *t = Some(SpotifyToken {
            access_token: tok.clone(),
            expires_at: Instant::now() + Duration::from_secs(exp.saturating_sub(60)),
        });

        Ok(tok)
    }

    fn embed_url(track_id: &str) -> String {
        format!("https://open.spotify.com/embed/track/{}", track_id)
    }

    fn external_url(track_id: &str) -> String {
        format!("https://open.spotify.com/track/{}", track_id)
    }
}

#[async_trait]
impl MusicProvider for SpotifyProvider {
    fn name(&self) -> &'static str {
        "Spotify"
    }

    fn platform(&self) -> Platform {
        Platform::Spotify
    }

    async fn search(&self, query: &str, limit: u32) -> Result<Vec<Track>, ProviderError> {
        let cache_key = format!("{}:{}", query, limit);
        if let Some(cached) = self.search_cache.get(&cache_key).await {
            return Ok(cached);
        }

        let token = self.access_token().await?;

        let resp = self
            .http
            .get("https://api.spotify.com/v1/search")
            .bearer_auth(&token)
            .query(&[
                ("q", query),
                ("type", "track"),
                ("limit", &limit.to_string()),
            ])
            .send()
            .await?;

        if resp.status().as_u16() == 429 {
            return Err(ProviderError::RateLimited);
        }

        if !resp.status().is_success() {
            return Err(ProviderError::Api(format!(
                "Spotify search returned {}",
                resp.status()
            )));
        }

        let json: serde_json::Value = resp.json().await?;

        let items = json["tracks"]["items"]
            .as_array()
            .ok_or_else(|| ProviderError::Parse("No tracks.items in response".into()))?;

        let tracks: Vec<Track> = items
            .iter()
            .filter_map(|item| {
                let id = item["id"].as_str()?;
                let title = item["name"].as_str()?.to_string();
                let artist = item["artists"][0]["name"].as_str()?.to_string();
                let duration_ms = item["duration_ms"].as_u64()?;
                let thumbnail = item["album"]["images"][0]["url"]
                    .as_str()
                    .map(|s| s.to_string());
                let preview_url = item["preview_url"].as_str().map(|s| s.to_string());

                Some(Track {
                    id: id.to_string(),
                    platform: Platform::Spotify,
                    title,
                    artist,
                    thumbnail,
                    duration: Some(duration_ms / 1000),
                    embed_url: Self::embed_url(id),
                    external_url: Self::external_url(id),
                    preview_url,
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

        let token = self.access_token().await?;

        let resp = self
            .http
            .get(format!("https://api.spotify.com/v1/tracks/{}", id))
            .bearer_auth(&token)
            .send()
            .await?;

        if resp.status().as_u16() == 404 {
            return Err(ProviderError::NotFound(format!(
                "Spotify track {} not found",
                id
            )));
        }

        if !resp.status().is_success() {
            return Err(ProviderError::Api(format!(
                "Spotify track API returned {}",
                resp.status()
            )));
        }

        let json: serde_json::Value = resp.json().await?;
        let preview_url = json["preview_url"].as_str().map(|s| s.to_string());

        let info = EmbedInfo {
            embed_url: Self::embed_url(id),
            external_url: Self::external_url(id),
            preview_url,
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
        assert_eq!(
            SpotifyProvider::embed_url("4uLU6hMCjMI75M1A2tKUQC"),
            "https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC"
        );
    }

    #[test]
    fn test_external_url() {
        assert_eq!(
            SpotifyProvider::external_url("4uLU6hMCjMI75M1A2tKUQC"),
            "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC"
        );
    }

    #[tokio::test]
    async fn test_missing_credentials_returns_error() {
        let provider = SpotifyProvider::new(String::new(), String::new());
        let result = provider.search("test", 5).await;
        assert!(result.is_err());
    }
}
