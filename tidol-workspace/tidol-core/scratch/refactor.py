import re

with open("src/main.rs", "r") as f:
    content = f.read()

# 1. Add mod error; and use tracing at the top
if "mod error;" not in content:
    content = re.sub(
        r"(mod models;)",
        r"mod error;\n\1",
        content,
        count=1
    )

if "use tracing::" not in content:
    content = re.sub(
        r"(use axum::\{)",
        r"use tracing::{info, warn, error, debug};\n\1",
        content,
        count=1
    )

if "use error::TidolError" not in content:
    content = re.sub(
        r"(use axum::\{)",
        r"use error::{TidolError, TidolResult};\n\1",
        content,
        count=1
    )

# 2. Add tracing initialization in main
if "tracing_subscriber::fmt()" not in content:
    content = re.sub(
        r"(\n\s*dotenv\(\)\.ok\(\);\n)",
        r"\1    tracing_subscriber::fmt()\n        .with_env_filter(\n            tracing_subscriber::EnvFilter::try_from_default_env()\n                .unwrap_or_else(|_| \"tidol_core=info,tower_http=warn\".into())\n        )\n        .init();\n",
        content,
        count=1
    )

# 3. Replace Deezer initialization
deezer_old = r"Box::new\(providers::deezer::DeezerProvider::new\(\)\),"
deezer_new = """Box::new(deezer_provider.clone()),"""
content = content.replace(deezer_old, deezer_new)

if "let deezer_provider =" not in content:
    content = re.sub(
        r"(let mut audio_providers: Vec<Box<dyn providers::AudioProvider>> = vec!\[)",
        r"""let deezer_arl = std::env::var("DEEZER_ARL").unwrap_or_else(|_| "".to_string());
    let deezer_provider = providers::deezer::DeezerProvider::new(deezer_arl);
    if !deezer_provider.arl.is_empty() {
        if let Err(e) = deezer_provider.session().await {
            error!("Deezer ARL inválido o expirado: {}", e);
        } else {
            info!("[OK] Deezer session initialized");
        }
    } else {
        warn!("[WARN] DEEZER_ARL no configurado. El provider fallará internamente.");
    }

    \1""",
        content,
        count=1
    )

# 4. Add Extension to Router
if ".layer(axum::Extension(Arc::new(deezer_provider)))" not in content:
    content = re.sub(
        r"(\.merge\(protected_routes\)\n\s*\.layer\(cors\))",
        r"\1\n    .layer(axum::Extension(Arc::new(deezer_provider)))",
        content,
        count=1
    )

# 5. Replace println! and eprintln!
content = re.sub(r'println!\("\[OK\] (.+?)"(.*?)\);', r'info!("[OK] \1"\2);', content)
content = re.sub(r'eprintln!\("\[WARN\] (.+?)"(.*?)\);', r'warn!("[WARN] \1"\2);', content)
content = re.sub(r'println!\("\[WARN\] (.+?)"(.*?)\);', r'warn!("[WARN] \1"\2);', content)
content = re.sub(r'eprintln!\("\[ERROR\] (.+?)"(.*?)\);', r'error!("[ERROR] \1"\2);', content)
content = re.sub(r'eprintln!\("❌ (.+?)"(.*?)\);', r'error!("❌ \1"\2);', content)
content = re.sub(r'println!\("=== Iniciando (.+?)"(.*?)\);', r'info!("=== Iniciando \1"\2);', content)
content = re.sub(r'println!\("\[Waterfall\] (.+?)"(.*?)\);', r'info!("[Waterfall] \1"\2);', content)
content = re.sub(r'eprintln!\("\[Waterfall\] (.+?)"(.*?)\);', r'error!("[Waterfall] \1"\2);', content)
content = re.sub(r'println!\("\[Stream\] (.+?)"(.*?)\);', r'info!("[Stream] \1"\2);', content)
content = re.sub(r'println!\("\[FFMPEG\] (.+?)"(.*?)\);', r'info!("[FFMPEG] \1"\2);', content)
content = re.sub(r'println!\("\[API\] (.+?)"(.*?)\);', r'info!("[API] \1"\2);', content)

# Replace general remaining println! to info!
content = re.sub(r'println!\((.+?)\);', r'info!(\1);', content)
content = re.sub(r'eprintln!\((.+?)\);', r'error!(\1);', content)

with open("src/main.rs", "w") as f:
    f.write(content)

print("Refactor script complete.")
