use image::imageops::FilterType;
use serde::{Deserialize, Serialize};
use std::io::Cursor;
use std::path::PathBuf;

use crate::TidolCore;

// -------------------------------------------------------------------------
// OPTIMIZACIÓN DE IMÁGENES
// -------------------------------------------------------------------------
/// Error de `optimize_image`. `InvalidPath` → 400, `NotFound` → 404,
/// `Encode` → 500. El binario provee el cuerpo de texto correspondiente.
#[derive(Debug)]
pub enum OptimizeError {
    InvalidPath,
    NotFound,
    Encode,
}

// -------------------------------------------------------------------------
// EXTRACCIÓN DE COLORES
// -------------------------------------------------------------------------
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
    pub success: bool,
    pub colors: Colors,
}

#[derive(Serialize)]
pub struct Colors {
    pub dominant: String,
    pub secondary: String,
    pub tertiary: String,
}

// -------------------------------------------------------------------------
// PORTADAS
// -------------------------------------------------------------------------
/// Resultado de `get_cover`. `InvalidId` → 400; `Image` → 200 jpeg;
/// `Default(Some)` → 200 jpeg (portada por defecto); `Default(None)` → 404.
pub enum CoverOutcome {
    InvalidId,
    Image(Vec<u8>),
    Default(Option<Vec<u8>>),
}

// Caché negativa en memoria: un mbid sin portada no debe re-disparar la cascada
// CAA→MusicBrainz→iTunes (hasta ~15 requests externos) en CADA petición.
static COVER_MISSES: std::sync::OnceLock<
    std::sync::Mutex<std::collections::HashMap<String, std::time::Instant>>,
> = std::sync::OnceLock::new();
const COVER_MISS_TTL: std::time::Duration = std::time::Duration::from_secs(30 * 60);

fn cover_miss_cached(mbid: &str) -> bool {
    let map = COVER_MISSES.get_or_init(Default::default);
    let mut guard = match map.lock() {
        Ok(g) => g,
        Err(_) => return false,
    };
    match guard.get(mbid) {
        Some(t) if t.elapsed() < COVER_MISS_TTL => true,
        Some(_) => {
            guard.remove(mbid);
            false
        }
        None => false,
    }
}

fn cover_miss_store(mbid: &str) {
    let map = COVER_MISSES.get_or_init(Default::default);
    if let Ok(mut guard) = map.lock() {
        // Poda simple para que el mapa no crezca sin límite.
        if guard.len() > 10_000 {
            guard.retain(|_, t| t.elapsed() < COVER_MISS_TTL);
        }
        guard.insert(mbid.to_string(), std::time::Instant::now());
    }
}

/// Lee la portada por defecto (`covers/default.jpg`) si existe.
async fn read_default_cover(covers_dir: &std::path::Path) -> Option<Vec<u8>> {
    tokio::fs::read(covers_dir.join("default.jpg")).await.ok()
}

impl TidolCore {
    pub async fn optimize_image(
        &self,
        path: &str,
        w: Option<u32>,
    ) -> Result<Vec<u8>, OptimizeError> {
        let path = path.trim_start_matches('/');

        // Anti path-traversal: solo se sirven imágenes bajo uploads/ (única ruta que
        // usa el frontend). Antes `path=../../...` permitía leer imágenes arbitrarias
        // del filesystem y sondear la existencia de ficheros.
        if path.contains("..") || path.contains('\\') || !path.starts_with("uploads/") {
            return Err(OptimizeError::InvalidPath);
        }

        let file_path = PathBuf::from(".").join(path);

        if !tokio::fs::try_exists(&file_path).await.unwrap_or(false) {
            return Err(OptimizeError::NotFound);
        }

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
            Some(bytes) => Ok(bytes),
            None => Err(OptimizeError::Encode),
        }
    }

    pub async fn extract_colors(&self, payload: ExtractColorsPayload) -> Colors {
        let image_url = payload.image_url.clone();
        let bytes_opt = if image_url.starts_with("http") {
            let client = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(8))
                .build()
                .unwrap_or_default();
            if let Ok(res) = client.get(&image_url).send().await {
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
                    secondary: format!(
                        "#{:02x}{:02x}{:02x}",
                        secondary.r, secondary.g, secondary.b
                    ),
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

        // Ambas fuentes (IA y local) persisten en la misma tabla.
        let _ = is_ia;
        if let Ok(colors_json) = serde_json::to_string(&colors) {
            if let Err(e) = sqlx::query!(
                "UPDATE trackMetadata SET extractedColors = ? WHERE trackId = ?",
                colors_json,
                payload.song_id
            )
            .execute(&self.db)
            .await
            {
                tracing::warn!("extract_colors: no se pudo persistir colores: {}", e);
            }
        }

        colors
    }

    pub async fn get_cover(&self, mbid: &str, fallback: Option<String>) -> CoverOutcome {
        // Anti path-traversal: el mbid forma el nombre del fichero cacheado; un valor
        // como `../x` escribía/leía fuera de covers/. Solo se aceptan ids "seguros".
        if mbid.is_empty()
            || mbid.len() > 64
            || !mbid
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
        {
            return CoverOutcome::InvalidId;
        }

        let covers_dir = PathBuf::from("covers");
        if !tokio::fs::try_exists(&covers_dir).await.unwrap_or(false) {
            let _ = tokio::fs::create_dir_all(&covers_dir).await;
        }

        let file_path = covers_dir.join(format!("{}.jpg", mbid));

        if let Ok(bytes) = tokio::fs::read(&file_path).await {
            return CoverOutcome::Image(bytes);
        }

        // Miss reciente ya conocido → default inmediato, sin cascada externa.
        if cover_miss_cached(mbid) {
            return CoverOutcome::Default(read_default_cover(&covers_dir).await);
        }

        // Cliente con User-Agent (MusicBrainz lo exige) y seguimiento de redirecciones
        // (Cover Art Archive redirige a archive.org).
        let client = reqwest::Client::builder()
            .user_agent("TidolMusic/0.2 (https://tidol.duckdns.org)")
            .timeout(std::time::Duration::from_secs(8))
            .connect_timeout(std::time::Duration::from_secs(4))
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
                            return CoverOutcome::Image(bytes.to_vec());
                        }
                    }
                }
            }
        }

        // ── 2. MusicBrainz: si el mbid es un recording, elige el release "canónico" ──
        //    Puntúa los releases (Official + Album + fecha antigua, excluye
        //    Compilation/Live/DJ-mix/Remix/etc.) y prueba CAA en orden. Además intenta
        //    la portada del release-group. Primer acierto gana y se cachea en disco.
        let mb_url = format!(
            "https://musicbrainz.org/ws/2/recording/{}?inc=releases+release-groups+artist-credits&fmt=json",
            mbid
        );
        if let Ok(res) = client.get(&mb_url).send().await {
            if let Ok(json) = res.json::<serde_json::Value>().await {
                // Artista canónico de la grabación (para exigir coincidencia de release).
                let rec_artist = json
                    .get("artist-credit")
                    .and_then(|c| c.as_array())
                    .and_then(|arr| arr.first())
                    .and_then(|c| c.get("name"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_lowercase();

                if let Some(releases) = json.get("releases").and_then(|r| r.as_array()) {
                    // Tipos secundarios a excluir (no queremos recopilatorios/directos/mixes).
                    const BAD_SECONDARY: [&str; 8] = [
                        "compilation",
                        "live",
                        "dj-mix",
                        "mixtape/street",
                        "remix",
                        "soundtrack",
                        "demo",
                        "interview",
                    ];

                    let date_of = |rel: &serde_json::Value| -> String {
                        let rel_date = rel.get("date").and_then(|v| v.as_str()).unwrap_or("");
                        let rg_date = rel
                            .get("release-group")
                            .and_then(|rg| rg.get("first-release-date"))
                            .and_then(|v| v.as_str())
                            .unwrap_or("");
                        // Preferimos la fecha con más información; para ordenar por más
                        // antigua tratamos "" como muy futuro.
                        let d = if !rel_date.is_empty() { rel_date } else { rg_date };
                        if d.is_empty() {
                            "9999".to_string()
                        } else {
                            d.to_string()
                        }
                    };

                    let mut scored: Vec<(i32, String, serde_json::Value)> = Vec::new();
                    for rel in releases {
                        let rg = rel.get("release-group");
                        let primary = rg
                            .and_then(|g| g.get("primary-type"))
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_lowercase();
                        let secondary: Vec<String> = rg
                            .and_then(|g| g.get("secondary-types"))
                            .and_then(|v| v.as_array())
                            .map(|arr| {
                                arr.iter()
                                    .filter_map(|s| s.as_str())
                                    .map(|s| s.to_lowercase())
                                    .collect()
                            })
                            .unwrap_or_default();

                        // Excluir releases con tipos secundarios no deseados.
                        if secondary.iter().any(|s| BAD_SECONDARY.contains(&s.as_str())) {
                            continue;
                        }

                        let mut score = 0;
                        let status = rel
                            .get("status")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_lowercase();
                        if status == "official" {
                            score += 100;
                        }
                        match primary.as_str() {
                            "album" => score += 50,
                            "ep" => score += 20,
                            "single" => score += 5,
                            "broadcast" | "other" => score -= 20,
                            _ => {}
                        }

                        // Coincidencia de artista: el release debe ser del mismo artista
                        // que la grabación (evita recopilatorios/varios artistas ajenos).
                        if !rec_artist.is_empty() {
                            let rel_artist = rel
                                .get("artist-credit")
                                .and_then(|c| c.as_array())
                                .and_then(|arr| arr.first())
                                .and_then(|c| c.get("name"))
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_lowercase();
                            if !rel_artist.is_empty() {
                                if rel_artist == rec_artist {
                                    score += 80;
                                } else {
                                    score -= 60;
                                }
                            }
                        }

                        scored.push((score, date_of(rel), rel.clone()));
                    }

                    // Orden: mayor score primero; a igualdad, fecha más antigua.
                    scored.sort_by(|a, b| b.0.cmp(&a.0).then_with(|| a.1.cmp(&b.1)));

                    for (_score, _date, rel) in scored.iter().take(6) {
                        // Intento por release directo.
                        if let Some(rid) = rel.get("id").and_then(|v| v.as_str()) {
                            let caa =
                                format!("https://coverartarchive.org/release/{}/front-500", rid);
                            if let Ok(r2) = client.get(&caa).send().await {
                                if r2.status().is_success() {
                                    if let Ok(bytes) = r2.bytes().await {
                                        if bytes.len() > 100 {
                                            let _ = tokio::fs::write(&file_path, &bytes).await;
                                            return CoverOutcome::Image(bytes.to_vec());
                                        }
                                    }
                                }
                            }
                        }
                        // Intento por release-group (a veces solo el grupo tiene arte).
                        if let Some(rgid) = rel
                            .get("release-group")
                            .and_then(|rg| rg.get("id"))
                            .and_then(|v| v.as_str())
                        {
                            let caa = format!(
                                "https://coverartarchive.org/release-group/{}/front-500",
                                rgid
                            );
                            if let Ok(r2) = client.get(&caa).send().await {
                                if r2.status().is_success() {
                                    if let Ok(bytes) = r2.bytes().await {
                                        if bytes.len() > 100 {
                                            let _ = tokio::fs::write(&file_path, &bytes).await;
                                            return CoverOutcome::Image(bytes.to_vec());
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
            .fetch_optional(&self.db)
            .await
            .unwrap_or(None);

        if let Some(t) = track {
            let term = format!("{} {}", t.artist, t.title);
            let url = format!(
                "https://itunes.apple.com/search?term={}&media=music&limit=1",
                urlencoding::encode(&term)
            );

            if let Ok(res) = client.get(&url).send().await {
                if let Ok(json) = res.json::<serde_json::Value>().await {
                    if let Some(results) = json.get("results").and_then(|r| r.as_array()) {
                        if let Some(first) = results.first() {
                            if let Some(artwork) =
                                first.get("artworkUrl100").and_then(|a| a.as_str())
                            {
                                let high_res = artwork.replace("100x100bb", "600x600bb");
                                if let Ok(img_res) = client.get(&high_res).send().await {
                                    if let Ok(bytes) = img_res.bytes().await {
                                        // No se cachea: iTunes es texto-fuzzy y puede
                                        // equivocarse; dejamos que MB reintente y acierte.
                                        return CoverOutcome::Image(bytes.to_vec());
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
        if let Some(fallback) = fallback.as_deref() {
            if fallback.starts_with("http") {
                if let Ok(res) = client.get(fallback).send().await {
                    if res.status().is_success() {
                        if let Ok(bytes) = res.bytes().await {
                            if bytes.len() > 100 {
                                // No se cachea el fallback (miniatura YT): que MB reintente.
                                return CoverOutcome::Image(bytes.to_vec());
                            }
                        }
                    }
                }
            }
        }

        // Nada encontró portada: registrar el miss para no repetir la cascada
        // durante el TTL (los fallbacks iTunes/YT no se cachean a disco a propósito).
        cover_miss_store(mbid);
        CoverOutcome::Default(read_default_cover(&covers_dir).await)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::CoreConfig;
    use crate::TidolCore;

    fn core() -> TidolCore {
        TidolCore::new_disconnected(CoreConfig {
            database_url: "mysql://user:pass@127.0.0.1:1/nodb".into(),
            database_max_connections: 1,
            proxy_pool: vec!["direct".into()],
            plugins_dir: "/nonexistent".into(),
            youtube_api_key: String::new(),
            spotify_client_id: String::new(),
            spotify_client_secret: String::new(),
            soundcloud_client_id: String::new(),
            jwt_secret: None,
        })
    }

    /// Fichero temporal bajo ./uploads que se borra al soltarse (también si la
    /// aserción falla antes de la limpieza manual).
    struct TempUpload(std::path::PathBuf);

    impl TempUpload {
        fn new(name_hint: &str, bytes: &[u8]) -> (Self, String) {
            std::fs::create_dir_all("uploads").unwrap();
            let rel = format!("uploads/test_{}_{}", uuid::Uuid::new_v4(), name_hint);
            std::fs::write(&rel, bytes).unwrap();
            (Self(rel.clone().into()), rel)
        }
    }

    impl Drop for TempUpload {
        fn drop(&mut self) {
            let _ = std::fs::remove_file(&self.0);
        }
    }

    fn png_bytes(w: u32, h: u32) -> Vec<u8> {
        // Gradiente rojo→azul: contenido con varianza para que color-thief
        // tenga píxeles que muestrear.
        let img = image::RgbImage::from_fn(w, h, |x, _y| {
            if x < w / 2 {
                image::Rgb([220, 10, 10])
            } else {
                image::Rgb([10, 10, 220])
            }
        });
        let mut out = Vec::new();
        image::DynamicImage::ImageRgb8(img)
            .write_to(&mut std::io::Cursor::new(&mut out), image::ImageFormat::Png)
            .unwrap();
        out
    }

    // ── optimize_image: contrato 400/404/500/jpeg de la línea base ──

    #[tokio::test]
    async fn optimize_rechaza_rutas_fuera_de_uploads() {
        let c = core();
        for path in [
            "../etc/passwd",
            "/etc/passwd",
            "uploads/../.env",
            "uploads\\..\\x",
            "covers/default.jpg",
            "",
        ] {
            assert!(
                matches!(c.optimize_image(path, None).await, Err(OptimizeError::InvalidPath)),
                "ruta {path:?} debía ser InvalidPath (→400)"
            );
        }
    }

    #[tokio::test]
    async fn optimize_404_si_no_existe() {
        let c = core();
        let missing = format!("uploads/no_existe_{}.jpg", uuid::Uuid::new_v4());
        assert!(matches!(
            c.optimize_image(&missing, None).await,
            Err(OptimizeError::NotFound)
        ));
    }

    #[tokio::test]
    async fn optimize_500_con_contenido_no_imagen() {
        let c = core();
        let (_guard, rel) = TempUpload::new("basura.jpg", b"esto no es una imagen");
        assert!(matches!(
            c.optimize_image(&rel, None).await,
            Err(OptimizeError::Encode)
        ));
    }

    #[tokio::test]
    async fn optimize_devuelve_jpeg_valido() {
        let c = core();
        let (_guard, rel) = TempUpload::new("ok.png", &png_bytes(16, 16));
        let bytes = c.optimize_image(&rel, None).await.expect("debía optimizar");
        assert!(bytes.starts_with(&[0xFF, 0xD8, 0xFF]), "no es JPEG");
    }

    #[tokio::test]
    async fn optimize_redimensiona_al_ancho_pedido() {
        let c = core();
        let (_guard, rel) = TempUpload::new("resize.png", &png_bytes(16, 16));
        let bytes = c.optimize_image(&rel, Some(8)).await.expect("debía optimizar");
        let img = image::load_from_memory(&bytes).expect("jpeg decodificable");
        assert_eq!((img.width(), img.height()), (8, 8));
    }

    // ── get_cover: validación de id (única rama sin red/fs externo) ──

    #[tokio::test]
    async fn get_cover_rechaza_ids_peligrosos_o_invalidos() {
        let c = core();
        for id in ["", "../x", "a/b", "a.b", "id con espacios", "café"] {
            assert!(
                matches!(c.get_cover(id, None).await, CoverOutcome::InvalidId),
                "id {id:?} debía ser InvalidId (→400)"
            );
        }
        let long = "a".repeat(65);
        assert!(matches!(c.get_cover(&long, None).await, CoverOutcome::InvalidId));
    }

    // ── extract_colors: fallback y extracción real ──

    #[tokio::test]
    async fn extract_colors_devuelve_defaults_si_no_hay_imagen() {
        // Línea base: cualquier fallo de lectura/decodificación → colores por
        // defecto con success:true (nunca error HTTP).
        let c = core();
        let colors = c
            .extract_colors(ExtractColorsPayload {
                image_url: format!("no_existe_{}.png", uuid::Uuid::new_v4()),
                song_id: "test-song".into(),
                source: None,
            })
            .await;
        assert_eq!(colors.dominant, "#1db954");
        assert_eq!(colors.secondary, "#000000");
        assert_eq!(colors.tertiary, "#ffffff");
    }

    #[tokio::test]
    async fn extract_colors_extrae_de_imagen_real() {
        let c = core();
        let (_guard, rel) = TempUpload::new("colores.png", &png_bytes(32, 32));
        let colors = c
            .extract_colors(ExtractColorsPayload {
                image_url: rel,
                song_id: "test-song-2".into(),
                source: Some("archive".into()),
            })
            .await;
        let hex = regex::Regex::new(r"^#[0-9a-f]{6}$").unwrap();
        for (name, v) in [
            ("dominant", &colors.dominant),
            ("secondary", &colors.secondary),
            ("tertiary", &colors.tertiary),
        ] {
            assert!(hex.is_match(v), "{name} no es hex: {v}");
        }
        // De una imagen roja/azul no puede salir el verde por defecto.
        assert_ne!(colors.dominant, "#1db954", "cayó en el fallback por defecto");
    }

    #[test]
    fn colors_response_serializa_con_la_forma_de_linea_base() {
        // Forma observable del payload: {"success":true,"colors":{...}}.
        let v = serde_json::to_value(ColorsResponse {
            success: true,
            colors: Colors {
                dominant: "#111111".into(),
                secondary: "#222222".into(),
                tertiary: "#333333".into(),
            },
        })
        .unwrap();
        assert_eq!(
            v,
            serde_json::json!({
                "success": true,
                "colors": {
                    "dominant": "#111111",
                    "secondary": "#222222",
                    "tertiary": "#333333"
                }
            })
        );
    }
}
