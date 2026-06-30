with open("src/main.rs", "r") as f:
    text = f.read()

# 1. Add mod error; at the top
if "mod error;" not in text:
    text = text.replace("mod models;", "mod error;\nmod models;")

# 2. Add use tracing and use error
if "use tracing::" not in text:
    text = text.replace("use axum::{", "use tracing::{info, warn, error, debug};\nuse error::{TidolError, TidolResult};\nuse axum::{")

# 3. Add tracing_subscriber to main
main_def = """async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();"""
new_main_def = """async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "tidol_core=info,tower_http=warn".into())
        )
        .init();"""
text = text.replace(main_def, new_main_def)

# 4. Modify providers initialization
providers_init = """    let mut audio_providers: Vec<Box<dyn providers::AudioProvider>> = vec![
        Box::new(providers::deezer::DeezerProvider::new()),
        piped_provider,
        soundcloud_provider,
        Box::new(providers::ytdlp::YtDlpProvider::new()),
        Box::new(providers::archive::ArchiveProvider::new()),
    ];"""

new_providers_init = """    let deezer_arl = std::env::var("DEEZER_ARL").unwrap_or_default();
    let deezer_provider = providers::deezer::DeezerProvider::new(deezer_arl);
    
    // We can't await in a let binding easily without capturing, but we can do it before:
    // Wait, we are in an async fn main(), so we can just await here!
    
    let mut audio_providers: Vec<Box<dyn providers::AudioProvider>> = vec![
        Box::new(deezer_provider.clone()),
        piped_provider,
        soundcloud_provider,
        Box::new(providers::ytdlp::YtDlpProvider::new()),
        Box::new(providers::archive::ArchiveProvider::new()),
    ];"""
text = text.replace(providers_init, new_providers_init)

# 5. Prewarm Deezer session and add it to state/Router
router_init = """.merge(protected_routes)
    .layer(cors)
    .with_state(app_state.clone());"""
new_router_init = """.merge(protected_routes)
    .layer(cors)
    .layer(axum::Extension(std::sync::Arc::new(deezer_provider)))
    .with_state(app_state.clone());"""
text = text.replace(router_init, new_router_init)

with open("src/main.rs", "w") as f:
    f.write(text)

print("Safely refactored main.rs")
