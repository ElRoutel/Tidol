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
/// `Fallback` → 200 jpeg; `Default(Some)` → 200 jpeg (portada por defecto);
/// `Default(None)` → 404.
pub enum CoverOutcome {
    InvalidId,
    /// Portada canónica (CAA), cacheada en disco: estable, el navegador puede
    /// guardarla mucho tiempo.
    Image(Vec<u8>),
    /// Portada de respaldo (iTunes o `?fallback=`, p.ej. miniatura de YouTube).
    /// NO se cachea en disco a propósito (iTunes es texto difuso y puede fallar;
    /// que MB reintente), así que el navegador tampoco debe guardarla mucho.
    Fallback(Vec<u8>),
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

/// Peticiones simultáneas a Cover Art Archive al probar releases candidatos.
const COVER_CAA_CONCURRENCY: usize = 4;

/// Descarga una imagen: `Some(bytes)` solo con status 2xx y más de 100 bytes
/// (CAA a veces responde cuerpos mínimos que no son una imagen).
async fn fetch_image(client: &reqwest::Client, url: &str) -> Option<Vec<u8>> {
    let res = client.get(url).send().await.ok()?;
    if !res.status().is_success() {
        return None;
    }
    let bytes = res.bytes().await.ok()?;
    (bytes.len() > 100).then(|| bytes.to_vec())
}

/// Referencia a una portada de Cover Art Archive: por release o por release-group.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum ArtRef {
    Release(String),
    Group(String),
}

impl ArtRef {
    fn caa_url(&self) -> String {
        match self {
            ArtRef::Release(id) => format!("https://coverartarchive.org/release/{}/front-500", id),
            ArtRef::Group(id) => {
                format!("https://coverartarchive.org/release-group/{}/front-500", id)
            }
        }
    }

    /// Forma compacta para la URL: `r.<uuid>` / `g.<uuid>`.
    fn encode(&self) -> String {
        match self {
            ArtRef::Release(id) => format!("r.{}", id),
            ArtRef::Group(id) => format!("g.{}", id),
        }
    }

    fn decode(s: &str) -> Option<Self> {
        let (kind, id) = s.split_once('.')?;
        if !is_uuid(id) {
            return None;
        }
        match kind {
            "r" => Some(ArtRef::Release(id.to_string())),
            "g" => Some(ArtRef::Group(id.to_string())),
            _ => None,
        }
    }
}

/// UUID de MusicBrainz en forma canónica (8-4-4-4-12, hex en minúsculas).
fn is_uuid(s: &str) -> bool {
    s.len() == 36
        && s.char_indices().all(|(i, c)| match i {
            8 | 13 | 18 | 23 => c == '-',
            _ => c.is_ascii_digit() || ('a'..='f').contains(&c),
        })
}

/// Ordena los releases de una grabación y devuelve las portadas de CAA a probar.
/// Puntúa Official + Album + artista coincidente + fecha antigua y excluye
/// recopilatorios/directos/mixes. Compartido por `get_cover` (datos del lookup de
/// MusicBrainz) y por la búsqueda (`cover_url_for_search`), que ya trae los releases.
pub(crate) fn cover_candidates(releases: &[serde_json::Value], rec_artist: &str) -> Vec<ArtRef> {
    let rec_artist = rec_artist.to_lowercase();
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
        let d = if !rel_date.is_empty() {
            rel_date
        } else {
            rg_date
        };
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
        if secondary
            .iter()
            .any(|s| BAD_SECONDARY.contains(&s.as_str()))
        {
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

    let mut candidates: Vec<ArtRef> = Vec::new();
    for (_score, _date, rel) in scored.iter().take(6) {
        if let Some(rid) = rel.get("id").and_then(|v| v.as_str()) {
            candidates.push(ArtRef::Release(rid.to_string()));
        }
        // A veces solo el release-group tiene arte.
        if let Some(rgid) = rel
            .get("release-group")
            .and_then(|rg| rg.get("id"))
            .and_then(|v| v.as_str())
        {
            let group = ArtRef::Group(rgid.to_string());
            // Varios releases suelen compartir release-group.
            if !candidates.contains(&group) {
                candidates.push(group);
            }
        }
    }
    candidates
}

// ── Pista de portada firmada en la URL ───────────────────────────────────────
//
// La búsqueda de grabaciones de MusicBrainz YA trae los releases de cada
// resultado; sin pista, `get_cover` volvía a pedirlos con un lookup a MB por
// portada (≈40 s para una página de 20 con el limitador común). La primera
// versión los guardaba en una caché en MEMORIA, pero en producción hay 3
// réplicas tras `least_conn`: ~2/3 de las portadas caían en otra réplica sin la
// pista. Ahora la búsqueda mete los candidatos en la propia URL de la portada
// (`/api/v1/covers/<mbid>?c=r.<id>,g.<id>&s=<firma>`): funciona en cualquier
// réplica, sobrevive a reinicios y viaja con la pista (playlists, likes).
//
// Firma HMAC obligatoria: `/covers` es pública y lo encontrado se cachea EN
// DISCO para todos. Sin firma, `?c=` con el álbum de otro artista envenenaría la
// portada de cualquier mbid. Sin `JWT_SECRET` no hay clave: se ignoran pistas y
// se sigue el camino normal. Los ids se validan como UUID → solo se construyen
// URLs de coverartarchive.org (no abre un SSRF como el de `?fallback=`).

/// Máximo de referencias en la URL (~40 caracteres cada una).
const MAX_HINT_REFS: usize = 6;

static COVER_HINT_KEY: std::sync::OnceLock<Option<Vec<u8>>> = std::sync::OnceLock::new();

/// Fija la clave de firma (una vez por proceso, desde `TidolCore::new`).
pub(crate) fn init_cover_hint_key(secret: Option<&str>) {
    let _ = COVER_HINT_KEY.set(
        secret
            .filter(|s| !s.is_empty())
            .map(|s| s.as_bytes().to_vec()),
    );
}

fn sign_hint(mbid: &str, hint: &str) -> Option<String> {
    use hmac::{Hmac, Mac};
    let key = COVER_HINT_KEY.get()?.as_ref()?;
    let mut mac = Hmac::<sha2::Sha256>::new_from_slice(key).ok()?;
    // Separación de dominio: la clave es la de los JWT; el prefijo impide que una
    // firma de pista se confunda con cualquier otro uso del mismo secreto.
    mac.update(b"tidol-cover-hint-v1|");
    mac.update(mbid.as_bytes());
    mac.update(b"|");
    mac.update(hint.as_bytes());
    // 128 bits bastan para una firma no reutilizable entre mbids.
    let tag = mac.finalize().into_bytes();
    Some(tag[..16].iter().map(|b| format!("{:02x}", b)).collect())
}

fn verify_hint(mbid: &str, hint: &str, sig: &str) -> bool {
    match sign_hint(mbid, hint) {
        // Comparación en tiempo constante (no filtrar por dónde difiere la firma).
        Some(expected) => {
            expected.len() == sig.len()
                && expected
                    .bytes()
                    .zip(sig.bytes())
                    .fold(0u8, |acc, (a, b)| acc | (a ^ b))
                    == 0
        }
        None => false,
    }
}

/// Codifica candidatos para `?c=`. `-` = grabación sin portadas candidatas
/// (sin releases o solo recopilatorios): la portada falla al instante en lugar de
/// esperar ~1 s de cola del limitador para un lookup a MB que diría lo mismo.
fn encode_hint(candidates: &[ArtRef]) -> String {
    if candidates.is_empty() {
        return "-".to_string();
    }
    candidates
        .iter()
        .take(MAX_HINT_REFS)
        .map(ArtRef::encode)
        .collect::<Vec<_>>()
        .join(",")
}

/// Pista válida y bien firmada → candidatos; cualquier otra cosa → `None`
/// (se ignora la pista entera y se sigue el camino normal).
fn parse_signed_hint(mbid: &str, hint: Option<&str>, sig: Option<&str>) -> Option<Vec<ArtRef>> {
    let (hint, sig) = (hint?, sig?);
    if hint.len() > MAX_HINT_REFS * 40 || !verify_hint(mbid, hint, sig) {
        return None;
    }
    if hint == "-" {
        return Some(Vec::new());
    }
    hint.split(',').map(ArtRef::decode).collect()
}

/// URL de portada para un resultado de búsqueda: con pista firmada si hay clave,
/// o la URL de siempre (`/api/v1/covers/<mbid>`) si no.
pub(crate) fn cover_url_for_search(
    mbid: &str,
    releases: &[serde_json::Value],
    artist: &str,
) -> String {
    let base = format!("/api/v1/covers/{}", mbid);
    let hint = encode_hint(&cover_candidates(releases, artist));
    match sign_hint(mbid, &hint) {
        Some(sig) => format!("{}?c={}&s={}", base, hint, sig),
        None => base,
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
            // Cliente compartido (crate::net): antes se creaba uno por petición.
            if let Ok(res) = crate::net::shared_client().get(&image_url).send().await {
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

    /// `hint`/`sig`: pista firmada de la búsqueda (`?c=`/`?s=`, ver
    /// `cover_url_for_search`); se ignora si no verifica.
    pub async fn get_cover(
        &self,
        mbid: &str,
        fallback: Option<String>,
        hint: Option<&str>,
        sig: Option<&str>,
    ) -> CoverOutcome {
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

        // Cliente compartido con User-Agent (MusicBrainz lo exige) y seguimiento de
        // redirecciones (Cover Art Archive redirige a archive.org). Antes se creaba
        // uno por petición: cada portada pagaba DNS+TLS de nuevo en cada salto.
        let client = crate::net::shared_client();

        // Con pista de la búsqueda el mbid es de una GRABACIÓN: el paso 1 (CAA por
        // mbid de release/release-group) daría 404 seguro; se salta.
        let hint = parse_signed_hint(mbid, hint, sig);

        // ── 1. Cover Art Archive directo por mbid (si es release / release-group) ──
        //    Las dos variantes van en paralelo (antes en serie: para un mbid de
        //    grabación, el caso habitual, eran dos 404 encadenados antes de seguir).
        //    Se respeta la preferencia release > release-group.
        let release_url = format!("https://coverartarchive.org/release/{}/front-500", mbid);
        let group_url = format!(
            "https://coverartarchive.org/release-group/{}/front-500",
            mbid
        );
        if hint.is_none() {
            let (as_release, as_group) = tokio::join!(
                fetch_image(client, &release_url),
                fetch_image(client, &group_url),
            );
            if let Some(bytes) = as_release.or(as_group) {
                let _ = tokio::fs::write(&file_path, &bytes).await;
                return CoverOutcome::Image(bytes);
            }
        }

        // ── 2. Releases de la grabación → CAA en orden de puntuación ──
        //    Los candidatos salen de la pista firmada de la búsqueda o, si no hay,
        //    de un lookup a MusicBrainz (prioridad de fondo en el limitador común:
        //    una página con 20 portadas sin caché ya no dispara 20 peticiones
        //    simultáneas a MB, que acababan en 503 y en "miss" cacheado 30 min).
        //    Si MB sigue respondiendo 503 tras los reintentos NO se registra miss:
        //    la portada puede existir.
        let mut mb_throttled = false;
        let candidates: Vec<ArtRef> = match hint {
            Some(c) => c,
            None => {
                let mb_url = format!(
                    "https://musicbrainz.org/ws/2/recording/{}?inc=releases+release-groups+artist-credits&fmt=json",
                    mbid
                );
                match crate::net::mb_get(client, &mb_url, crate::net::MbPriority::Background).await
                {
                    Ok(res) => {
                        mb_throttled = res.status() == reqwest::StatusCode::SERVICE_UNAVAILABLE
                            || res.status() == reqwest::StatusCode::TOO_MANY_REQUESTS;
                        match res.json::<serde_json::Value>().await {
                            Ok(json) => {
                                // Artista canónico de la grabación (para exigir coincidencia de release).
                                let rec_artist = json
                                    .get("artist-credit")
                                    .and_then(|c| c.as_array())
                                    .and_then(|arr| arr.first())
                                    .and_then(|c| c.get("name"))
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("");
                                json.get("releases")
                                    .and_then(|r| r.as_array())
                                    .map(|rels| cover_candidates(rels, rec_artist))
                                    .unwrap_or_default()
                            }
                            Err(_) => Vec::new(),
                        }
                    }
                    Err(_) => Vec::new(),
                }
            }
        };

        // Antes: hasta 12 peticiones a CAA en SERIE (release y release-group de los
        // 6 mejores releases) → una portada difícil tardaba >10 s. Ahora se piden con
        // concurrencia acotada; `buffered` mantiene el orden de puntuación, así que
        // gana el mejor candidato con portada (mismo resultado que antes) y al soltar
        // el stream se cancela el resto.
        use futures::stream::StreamExt;
        let mut stream = futures::stream::iter(candidates)
            .map(|art| async move { fetch_image(client, &art.caa_url()).await })
            .buffered(COVER_CAA_CONCURRENCY);
        while let Some(found) = stream.next().await {
            if let Some(bytes) = found {
                let _ = tokio::fs::write(&file_path, &bytes).await;
                return CoverOutcome::Image(bytes);
            }
        }
        drop(stream);

        let track = sqlx::query!("SELECT title, artist FROM track_links WHERE mbid = ?", mbid)
            .fetch_optional(&self.db)
            .await
            .unwrap_or(None);

        // iTunes solo si el cortacircuitos lo permite: desde el VPS está bloqueado y
        // cada intento costaba el timeout completo (ver crate::net).
        if let Some(t) = track.filter(|_| crate::net::itunes_available()) {
            let term = format!("{} {}", t.artist, t.title);
            let url = format!(
                "https://itunes.apple.com/search?term={}&media=music&limit=1",
                urlencoding::encode(&term)
            );

            let res = match client.get(&url).send().await {
                Ok(res) if crate::net::itunes_status_is_failure(res.status()) => {
                    crate::net::itunes_report_failure();
                    None
                }
                Ok(res) => Some(res),
                Err(_) => {
                    crate::net::itunes_report_failure();
                    None
                }
            };
            if let Some(res) = res {
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
                                        return CoverOutcome::Fallback(bytes.to_vec());
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
                                return CoverOutcome::Fallback(bytes.to_vec());
                            }
                        }
                    }
                }
            }
        }

        // Nada encontró portada: registrar el miss para no repetir la cascada
        // durante el TTL (los fallbacks iTunes/YT no se cachean a disco a propósito).
        // Si MB estaba saturado no sabemos si hay portada: no se cachea el miss.
        if !mb_throttled {
            cover_miss_store(mbid);
        }
        CoverOutcome::Default(read_default_cover(&covers_dir).await)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::CoreConfig;
    use crate::TidolCore;

    #[test]
    fn cover_candidates_ordena_filtra_y_deduplica() {
        let releases = serde_json::json!([
            // Recopilatorio: excluido aunque sea Official.
            {"id": "comp", "status": "Official",
             "release-group": {"id": "rg-comp", "primary-type": "Album", "secondary-types": ["Compilation"]}},
            // Single oficial: puntúa menos que el álbum.
            {"id": "single", "status": "Official", "date": "1990",
             "release-group": {"id": "rg-single", "primary-type": "Single"}},
            // Álbum oficial (dos ediciones del mismo release-group; gana la más antigua).
            {"id": "album-2005", "status": "Official", "date": "2005",
             "release-group": {"id": "rg-album", "primary-type": "Album"}},
            {"id": "album-1997", "status": "Official", "date": "1997",
             "release-group": {"id": "rg-album", "primary-type": "Album"}}
        ]);
        let got = cover_candidates(releases.as_array().unwrap(), "Molotov");
        let r = |id: &str| ArtRef::Release(id.to_string());
        let g = |id: &str| ArtRef::Group(id.to_string());
        assert_eq!(
            got,
            vec![
                r("album-1997"),
                g("rg-album"),
                r("album-2005"), // rg-album no se repite
                r("single"),
                g("rg-single"),
            ]
        );
        assert!(cover_candidates(&[], "x").is_empty());
    }

    #[test]
    fn pista_de_portada_firmada() {
        // La clave es global al proceso (OnceLock): este es el único test que la fija.
        init_cover_hint_key(Some("secreto-de-prueba"));
        let mbid = "0ca08a67-bcb1-4b6e-bd93-2dcabe336ad8";
        let rel = "236fb078-3c87-4b39-b948-187d22e5b553";
        let rg = "5b0a2384-d65c-3b6e-bb66-548d24a4e6ce";
        let releases = serde_json::json!([
            {"id": rel, "status": "Official", "release-group": {"id": rg, "primary-type": "Album"}}
        ]);

        let url = cover_url_for_search(mbid, releases.as_array().unwrap(), "Caifanes");
        let query = url.split_once('?').unwrap().1;
        let (c, s) = query.split_once('&').unwrap();
        let (c, s) = (c.strip_prefix("c=").unwrap(), s.strip_prefix("s=").unwrap());
        assert_eq!(c, format!("r.{rel},g.{rg}"));

        // Ida y vuelta.
        let parsed = parse_signed_hint(mbid, Some(c), Some(s)).unwrap();
        assert_eq!(
            parsed,
            vec![ArtRef::Release(rel.into()), ArtRef::Group(rg.into())]
        );

        // Firma manipulada, pista cambiada o reutilizada en otro mbid → se ignora
        // (anti envenenamiento de la caché de disco).
        let mut bad = s.to_string();
        bad.replace_range(0..1, if s.starts_with('0') { "1" } else { "0" });
        assert!(parse_signed_hint(mbid, Some(c), Some(&bad)).is_none());
        assert!(parse_signed_hint(mbid, Some(&format!("g.{rg}")), Some(s)).is_none());
        let otro = "11111111-2222-3333-4444-555555555555";
        assert!(parse_signed_hint(otro, Some(c), Some(s)).is_none());
        assert!(parse_signed_hint(mbid, Some(c), None).is_none());

        // Grabación sin releases → "-" firmado = sin candidatos (falla rápido).
        let url = cover_url_for_search(mbid, &[], "x");
        assert!(url.contains("?c=-&s="));
        let s_vacia = url.rsplit_once("s=").unwrap().1;
        assert_eq!(
            parse_signed_hint(mbid, Some("-"), Some(s_vacia)),
            Some(vec![])
        );

        // Ids que no son UUID (p.ej. intento de colar otra URL) → se ignora la pista.
        assert!(ArtRef::decode("r.../../etc").is_none());
        assert!(ArtRef::decode("x.236fb078-3c87-4b39-b948-187d22e5b553").is_none());
    }

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
                matches!(
                    c.optimize_image(path, None).await,
                    Err(OptimizeError::InvalidPath)
                ),
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
        let bytes = c
            .optimize_image(&rel, Some(8))
            .await
            .expect("debía optimizar");
        let img = image::load_from_memory(&bytes).expect("jpeg decodificable");
        assert_eq!((img.width(), img.height()), (8, 8));
    }

    // ── get_cover: validación de id (única rama sin red/fs externo) ──

    #[tokio::test]
    async fn get_cover_rechaza_ids_peligrosos_o_invalidos() {
        let c = core();
        for id in ["", "../x", "a/b", "a.b", "id con espacios", "café"] {
            assert!(
                matches!(
                    c.get_cover(id, None, None, None).await,
                    CoverOutcome::InvalidId
                ),
                "id {id:?} debía ser InvalidId (→400)"
            );
        }
        let long = "a".repeat(65);
        assert!(matches!(
            c.get_cover(&long, None, None, None).await,
            CoverOutcome::InvalidId
        ));
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
        assert_ne!(
            colors.dominant, "#1db954",
            "cayó en el fallback por defecto"
        );
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
