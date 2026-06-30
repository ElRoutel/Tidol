use crate::AppState;
use axum::{
    extract::{Query, State},
    http::{header, StatusCode},
    response::IntoResponse,
    Json,
};
use image::imageops::FilterType;
use serde::{Deserialize, Serialize};
use std::io::Cursor;
use std::path::PathBuf;

#[derive(Deserialize)]
pub struct OptimizeQuery {
    path: String,
    w: Option<u32>,
    q: Option<u32>,
}

pub async fn optimize_image_handler(Query(query): Query<OptimizeQuery>) -> impl IntoResponse {
    let path = query.path.trim_start_matches('/');

    let file_path = PathBuf::from(".").join(path);

    if !file_path.exists() {
        return (StatusCode::NOT_FOUND, "Image not found").into_response();
    }

    let w = query.w;

    let result = tokio::task::spawn_blocking(move || {
        let img = image::open(&file_path).ok()?;

        let img = if let Some(width) = w {
            let nheight = (img.height() as f32 * (width as f32 / img.width() as f32)) as u32;
            img.resize_exact(width, nheight, FilterType::Lanczos3)
        } else {
            img
        };

        let mut bytes: Vec<u8> = Vec::new();
        img.write_to(&mut Cursor::new(&mut bytes), image::ImageFormat::Jpeg)
            .ok()?;
        Some(bytes)
    })
    .await
    .unwrap_or(None);

    match result {
        Some(bytes) => ([(header::CONTENT_TYPE, "image/jpeg")], bytes).into_response(),
        None => (StatusCode::INTERNAL_SERVER_ERROR, "Error optimizing image").into_response(),
    }
}

#[derive(Deserialize)]
pub struct ExtractColorsPayload {
    #[serde(rename = "imageUrl")]
    pub image_url: String,
    #[serde(rename = "songId")]
    pub song_id: String,
    pub source: Option<String>,
}

#[derive(Serialize)]
pub struct ColorsResponse {
    success: bool,
    colors: Colors,
}

#[derive(Serialize)]
pub struct Colors {
    dominant: String,
    secondary: String,
    tertiary: String,
}

pub async fn extract_colors_handler(
    State(state): State<AppState>,
    Json(payload): Json<ExtractColorsPayload>,
) -> impl IntoResponse {
    let image_url = payload.image_url.clone();
    let bytes_opt = if image_url.starts_with("http") {
        if let Ok(res) = reqwest::get(&image_url).await {
            res.bytes().await.ok().map(|b| b.to_vec())
        } else {
            None
        }
    } else {
        let clean_path = image_url.trim_start_matches('/');
        let path = PathBuf::from(".").join(clean_path);
        tokio::fs::read(path).await.ok()
    };

    let colors = match bytes_opt {
        Some(bytes) => tokio::task::spawn_blocking(move || {
            let img = image::load_from_memory(&bytes).ok()?;
            let img_rgb = img.to_rgb8();
            let pixels: Vec<u8> = img_rgb.into_raw();

            let palette =
                color_thief::get_palette(&pixels, color_thief::ColorFormat::Rgb, 10, 2).ok()?;
            if palette.is_empty() {
                return None;
            }

            let dominant = &palette[0];
            let secondary = palette.get(1).unwrap_or(dominant);
            let tertiary = palette.get(2).unwrap_or(secondary);

            Some(Colors {
                dominant: format!("#{:02x}{:02x}{:02x}", dominant.r, dominant.g, dominant.b),
                secondary: format!("#{:02x}{:02x}{:02x}", secondary.r, secondary.g, secondary.b),
                tertiary: format!("#{:02x}{:02x}{:02x}", tertiary.r, tertiary.g, tertiary.b),
            })
        })
        .await
        .unwrap_or(None),
        None => None,
    };

    let colors = colors.unwrap_or_else(|| Colors {
        dominant: "#1db954".to_string(),
        secondary: "#000000".to_string(),
        tertiary: "#ffffff".to_string(),
    });

    let is_ia = payload.source.as_deref() == Some("internet_archive")
        || payload.source.as_deref() == Some("archive")
        || payload.song_id.starts_with("ia_");

    if let Ok(colors_json) = serde_json::to_string(&colors) {
        if is_ia {
            let _ = sqlx::query!(
                "UPDATE trackMetadata SET extractedColors = ? WHERE trackId = ?",
                colors_json,
                payload.song_id
            )
            .execute(&state.db)
            .await;
        } else {
            let _ = sqlx::query!(
                "UPDATE trackMetadata SET extractedColors = ? WHERE trackId = ?",
                colors_json,
                payload.song_id
            )
            .execute(&state.db)
            .await;
        }
    }

    Json(ColorsResponse {
        success: true,
        colors,
    })
}

#[derive(Deserialize)]
pub struct CoverQuery {
    /// URL de respaldo (p.ej. miniatura de YouTube) a usar si CAA/MusicBrainz/iTunes
    /// no devuelven portada. Se descarga y cachea para servirla same-origin.
    pub fallback: Option<String>,
}

pub async fn get_cover_handler(
    State(state): State<AppState>,
    axum::extract::Path(mbid): axum::extract::Path<String>,
    Query(q): Query<CoverQuery>,
) -> impl IntoResponse {
    let covers_dir = PathBuf::from("covers");
    if !covers_dir.exists() {
        let _ = tokio::fs::create_dir_all(&covers_dir).await;
    }

    let file_path = covers_dir.join(format!("{}.jpg", mbid));

    if file_path.exists() {
        if let Ok(bytes) = tokio::fs::read(&file_path).await {
            return (
                StatusCode::OK,
                [(header::CONTENT_TYPE, "image/jpeg")],
                bytes,
            )
                .into_response();
        }
    }

    // Cliente con User-Agent (MusicBrainz lo exige) y seguimiento de redirecciones
    // (Cover Art Archive redirige a archive.org).
    let client = reqwest::Client::builder()
        .user_agent("TidolMusic/0.2 (https://tidol.duckdns.org)")
        .build()
        .unwrap_or_default();

    // ── 1. Cover Art Archive directo por mbid (si es release / release-group) ──
    for kind in ["release", "release-group"] {
        let caa = format!("https://coverartarchive.org/{}/{}/front-500", kind, mbid);
        if let Ok(res) = client.get(&caa).send().await {
            if res.status().is_success() {
                if let Ok(bytes) = res.bytes().await {
                    if bytes.len() > 100 {
                        let _ = tokio::fs::write(&file_path, &bytes).await;
                        return (
                            StatusCode::OK,
                            [(header::CONTENT_TYPE, "image/jpeg")],
                            bytes.to_vec(),
                        )
                            .into_response();
                    }
                }
            }
        }
    }

    // ── 2. MusicBrainz: si el mbid es un recording, busca su release y prueba CAA ──
    let mb_url = format!(
        "https://musicbrainz.org/ws/2/recording/{}?inc=releases&fmt=json",
        mbid
    );
    if let Ok(res) = client.get(&mb_url).send().await {
        if let Ok(json) = res.json::<serde_json::Value>().await {
            if let Some(releases) = json.get("releases").and_then(|r| r.as_array()) {
                for rel in releases.iter().take(3) {
                    if let Some(rid) = rel.get("id").and_then(|v| v.as_str()) {
                        let caa = format!("https://coverartarchive.org/release/{}/front-500", rid);
                        if let Ok(r2) = client.get(&caa).send().await {
                            if r2.status().is_success() {
                                if let Ok(bytes) = r2.bytes().await {
                                    if bytes.len() > 100 {
                                        let _ = tokio::fs::write(&file_path, &bytes).await;
                                        return (
                                            StatusCode::OK,
                                            [(header::CONTENT_TYPE, "image/jpeg")],
                                            bytes.to_vec(),
                                        )
                                            .into_response();
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    let track = sqlx::query!("SELECT title, artist FROM track_links WHERE mbid = ?", mbid)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);

    if let Some(t) = track {
        let term = format!("{} {}", t.artist, t.title);
        let url = format!(
            "https://itunes.apple.com/search?term={}&media=music&limit=1",
            urlencoding::encode(&term)
        );

        if let Ok(res) = reqwest::get(&url).await {
            if let Ok(json) = res.json::<serde_json::Value>().await {
                if let Some(results) = json.get("results").and_then(|r| r.as_array()) {
                    if let Some(first) = results.first() {
                        if let Some(artwork) = first.get("artworkUrl100").and_then(|a| a.as_str()) {
                            let high_res = artwork.replace("100x100bb", "600x600bb");
                            if let Ok(img_res) = reqwest::get(&high_res).await {
                                if let Ok(bytes) = img_res.bytes().await {
                                    let _ = tokio::fs::write(&file_path, &bytes).await;
                                    return (
                                        StatusCode::OK,
                                        [(header::CONTENT_TYPE, "image/jpeg")],
                                        bytes.to_vec(),
                                    )
                                        .into_response();
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // ── 4. URL de respaldo (miniatura de YouTube u otra) — descargar y cachear
    //        para servir same-origin (permite extracción de color en el cliente) ──
    if let Some(fallback) = q.fallback.as_deref() {
        if fallback.starts_with("http") {
            if let Ok(res) = client.get(fallback).send().await {
                if res.status().is_success() {
                    if let Ok(bytes) = res.bytes().await {
                        if bytes.len() > 100 {
                            let _ = tokio::fs::write(&file_path, &bytes).await;
                            return (
                                StatusCode::OK,
                                [(header::CONTENT_TYPE, "image/jpeg")],
                                bytes.to_vec(),
                            )
                                .into_response();
                        }
                    }
                }
            }
        }
    }

    let fallback_path = covers_dir.join("default.jpg");
    if let Ok(bytes) = tokio::fs::read(&fallback_path).await {
        return (
            StatusCode::OK,
            [(header::CONTENT_TYPE, "image/jpeg")],
            bytes,
        )
            .into_response();
    }

    (StatusCode::NOT_FOUND, "Cover not found").into_response()
}
