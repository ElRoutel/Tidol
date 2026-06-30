pub mod archive;
pub mod provider_trait;
pub mod soundcloud;
pub mod spotify;
pub mod waterfall;
pub mod youtube;

pub use provider_trait::{EmbedInfo, MusicProvider, Platform, ProviderError, Track};
pub use waterfall::ProviderOrchestrator;
