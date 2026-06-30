use super::provider_trait::{EmbedInfo, MusicProvider, Platform, ProviderError, Track};
use async_trait::async_trait;
use moka::future::Cache;
use std::time::Duration;

/// Legal collections on Internet Archive with CC or public domain licenses.
const LEGAL_COLLECTIONS: &[&str] = &[
    "etree",
    "78rpm",
    "opensource_audio",
    "netlabels",
];

/// Internet Archive provider — direct streaming IS legal because all content
/// is under Creative Commons or public domain licenses.
pub struct ArchiveProvider {
    http: reqwest::Client,
    /// Aggressive cache: IA metadata rarely changes (TTL: 6 hours)
    search_cache: Cache<String, Vec<Track>>,
    /// Item metadata cache (TTL: 6 hours)
    resolve_cache: Cache<String, EmbedInfo>,
}

impl ArchiveProvider {
    pub fn new() -> Self {
        Self {
            http: reqwest::Client::builder()
                .timeout(Duration::from_secs(15))
                .build()
                .unwrap_or_else(|_| reqwest::Client::new()),
            search_cache: Cache::builder()
                .time_to_live(Duration::from_secs(6 * 3600))
                .max_capacity(2000)
                .build(),
            resolve_cache: Cache::builder()
                .time_to_live(Duration::from_secs(6 * 3600))
                .max_capacity(5000)
                .build(),
        }
    }

    /// Build the advanced search query restricting to legal audio collections.
    fn build_search_query(user_query: &str) -> String {
        let collection_filter = LEGAL_COLLECTIONS
            .iter()
            .map(|c| format!("collection:{}", c))
            .collect::<Vec<_>>()
            .join(" OR ");

        format!(
            "({}) AND ({}) AND mediatype:audio AND (licenseurl:*creativecommons* OR licenseurl:*publicdomain*)",
            user_query,
            collection_filter
        )
    }

    /// Direct download URL for an IA file — this IS legal for CC/PD content.
    fn direct_stream_url(identifier: &str, filename: &str) -> String {
        format!(
            "https://archive.org/download/{}/{}",
            urlencoding::encode(identifier),
            urlencoding::encode(filename)
        )
    }

    fn details_url(identifier: &str) -> String {
        format!("https://archive.org/details/{}", identifier)
    }

    fn embed_url(identifier: &str) -> String {
        format!(
            "https://archive.org/embed/{}",
            urlencoding::encode(identifier)
        )
    }
}

#[async_trait]
impl MusicProvider for ArchiveProvider {
    fn name(&self) -> &'static str {
        "Internet Archive"
    }

    fn platform(&self) -> Platform {
        Platform::InternetArchive
    }

    async fn search(&self, query: &str, limit: u32) -> Result<Vec<Track>, ProviderError> {
        let cache_key = format!("{}:{}", query, limit);
        if let Some(cached) = self.search_cache.get(&cache_key).await {
            return Ok(cached);
        }

        let search_query = Self::build_search_query(query);

        let resp = self
            .http
            .get("https://archive.org/advancedsearch.php")
            .query(&[
                ("q", search_query.as_str()),
                ("fl[]", "identifier,title,creator,description"),
                ("sort[]", "downloads desc"),
                ("rows", &limit.to_string()),
                ("page", "1"),
                ("output", "json"),
            ])
            .send()
            .await?;

        if !resp.status().is_success() {
            return Err(ProviderError::Api(format!(
                "Internet Archive search returned {}",
                resp.status()
            )));
        }

        let json: serde_json::Value = resp.json().await?;

        let docs = json["response"]["docs"]
            .as_array()
            .ok_or_else(|| ProviderError::Parse("No docs in IA response".into()))?;

        let tracks: Vec<Track> = docs
            .iter()
            .filter_map(|doc| {
                let identifier = doc["identifier"].as_str()?;
                let title = doc["title"].as_str().unwrap_or("Unknown").to_string();
                let artist = doc["creator"]
                    .as_str()
                    .or_else(|| doc["creator"].as_array()?.first()?.as_str())
                    .unwrap_or("Unknown Artist")
                    .to_string();

                let thumbnail = Some(format!(
                    "https://archive.org/services/img/{}",
                    identifier
                ));

                // For IA, the embed_url is the IA embed player, and
                // preview_url IS the direct stream (legal for CC/PD content)
                Some(Track {
                    id: identifier.to_string(),
                    platform: Platform::InternetArchive,
                    title,
                    artist,
                    thumbnail,
                    duration: None, // IA advanced search doesn't return duration
                    embed_url: Self::embed_url(identifier),
                    external_url: Self::details_url(identifier),
                    preview_url: None, // Will be resolved with the first audio file
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

        // Fetch item metadata to find the first audio file
        let metadata_url = format!("https://archive.org/metadata/{}", urlencoding::encode(id));
        let resp = self.http.get(&metadata_url).send().await?;

        if resp.status().as_u16() == 404 {
            return Err(ProviderError::NotFound(format!("IA item {} not found", id)));
        }

        if !resp.status().is_success() {
            return Err(ProviderError::Api(format!(
                "IA metadata API returned {}",
                resp.status()
            )));
        }

        let json: serde_json::Value = resp.json().await?;

        // Verify the item has a legal license
        let license = json["metadata"]["licenseurl"]
            .as_str()
            .or_else(|| json["metadata"]["license"].as_str())
            .unwrap_or("");

        if !license.contains("creativecommons") && !license.contains("publicdomain") {
            return Err(ProviderError::Api(format!(
                "IA item {} does not have a CC or public domain license",
                id
            )));
        }

        // Find the first playable audio file
        let files = json["files"]
            .as_array()
            .ok_or_else(|| ProviderError::Parse("No files in IA metadata".into()))?;

        let audio_extensions = ["mp3", "ogg", "flac", "wav", "m4a"];
        let audio_file = files
            .iter()
            .filter(|f| {
                let name = f["name"].as_str().unwrap_or("");
                let format = f["format"].as_str().unwrap_or("").to_lowercase();
                let ext = name.rsplit('.').next().unwrap_or("").to_lowercase();
                (audio_extensions.contains(&ext.as_str())
                    || format.contains("mp3")
                    || format.contains("ogg")
                    || format.contains("flac"))
                    && f["source"].as_str() != Some("metadata")
            })
            // Prefer "original" source, then by size (largest = highest quality)
            .max_by_key(|f| {
                let is_original = f["source"].as_str() == Some("original");
                let size = f["size"].as_str().and_then(|s| s.parse::<u64>().ok()).unwrap_or(0);
                (is_original as u64 * 1_000_000_000) + size
            });

        let preview_url = audio_file
            .and_then(|f| f["name"].as_str())
            .map(|filename| Self::direct_stream_url(id, filename));

        let info = EmbedInfo {
            embed_url: Self::embed_url(id),
            external_url: Self::details_url(id),
            preview_url, // Direct streaming is LEGAL for CC/PD content
        };

        self.resolve_cache.insert(id.to_string(), info.clone()).await;
        Ok(info)
    }

    fn max_timeout(&self) -> Duration {
        Duration::from_secs(10)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_search_query() {
        let query = ArchiveProvider::build_search_query("grateful dead");
        assert!(query.contains("grateful dead"));
        assert!(query.contains("collection:etree"));
        assert!(query.contains("collection:78rpm"));
        assert!(query.contains("mediatype:audio"));
        assert!(query.contains("licenseurl:*creativecommons*"));
    }

    #[test]
    fn test_direct_stream_url() {
        let url = ArchiveProvider::direct_stream_url("gd1977-05-08", "track01.mp3");
        assert_eq!(url, "https://archive.org/download/gd1977-05-08/track01.mp3");
    }

    #[test]
    fn test_embed_url() {
        assert_eq!(
            ArchiveProvider::embed_url("gd1977-05-08"),
            "https://archive.org/embed/gd1977-05-08"
        );
    }

    #[test]
    fn test_legal_collections_not_empty() {
        assert!(!LEGAL_COLLECTIONS.is_empty());
        assert!(LEGAL_COLLECTIONS.contains(&"etree"));
    }
}
