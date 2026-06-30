use super::provider_trait::{EmbedInfo, MusicProvider, ProviderError, Track};
use futures::future::join_all;
use tracing::{error, info};

pub struct ProviderOrchestrator {
    providers: Vec<Box<dyn MusicProvider>>,
}

impl ProviderOrchestrator {
    pub fn new(providers: Vec<Box<dyn MusicProvider>>) -> Self {
        Self { providers }
    }

    /// Search across all providers concurrently, merging results.
    pub async fn search_all(&self, query: &str, limit_per_provider: u32) -> Vec<Track> {
        let futures = self.providers.iter().map(|p| {
            let name = p.name();
            async move {
                let timeout = p.max_timeout();
                match tokio::time::timeout(timeout, p.search(query, limit_per_provider)).await {
                    Ok(Ok(tracks)) => {
                        info!("[Orchestrator] {} returned {} tracks", name, tracks.len());
                        tracks
                    }
                    Ok(Err(e)) => {
                        error!("[Orchestrator] {} search error: {}", name, e);
                        Vec::new()
                    }
                    Err(_) => {
                        error!("[Orchestrator] {} search timed out", name);
                        Vec::new()
                    }
                }
            }
        });

        let results = join_all(futures).await;
        results.into_iter().flatten().collect()
    }

    /// Resolve embed info from the correct provider based on platform prefix.
    /// ID format: "platform:id" (e.g. "youtube:dQw4w9WgXcQ", "spotify:4uLU6hMCjMI75M1A2tKUQC")
    pub async fn resolve(&self, platform_id: &str) -> Result<EmbedInfo, ProviderError> {
        let (platform_str, id) = platform_id
            .split_once(':')
            .ok_or_else(|| ProviderError::Parse(format!("Invalid ID format: {}", platform_id)))?;

        let provider = self
            .providers
            .iter()
            .find(|p| p.platform().to_string() == platform_str)
            .ok_or_else(|| {
                ProviderError::NotFound(format!("No provider for platform: {}", platform_str))
            })?;

        let timeout = provider.max_timeout();
        match tokio::time::timeout(timeout, provider.resolve(id)).await {
            Ok(result) => result,
            Err(_) => Err(ProviderError::Api(format!(
                "{} timed out resolving {}",
                provider.name(),
                id
            ))),
        }
    }

    /// Get a reference to all registered providers.
    pub fn providers(&self) -> &[Box<dyn MusicProvider>] {
        &self.providers
    }
}
