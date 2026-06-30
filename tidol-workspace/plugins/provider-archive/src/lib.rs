use percent_encoding::{utf8_percent_encode, NON_ALPHANUMERIC};
use reqwest::blocking::Client;
use reqwest::Proxy;
use serde_json::{json, Value};
use std::borrow::Cow;
use std::ffi::{c_char, CStr, CString};
use std::time::Duration;

const PROVIDER_NAME: &str = "Internet Archive (Track-Resolved Lossless)";
const SEARCH_ENDPOINT: &str = "https://archive.org/advancedsearch.php";
const METADATA_ENDPOINT: &str = "https://archive.org/metadata";
const DETAILS_BASE: &str = "https://archive.org/details";
const DOWNLOAD_BASE: &str = "https://archive.org/download";
const IMG_BASE: &str = "https://archive.org/services/img";

#[no_mangle]
pub extern "C" fn get_provider_name() -> *mut c_char {
    to_c_string(PROVIDER_NAME)
}

#[no_mangle]
pub extern "C" fn search_track(
    query_ptr: *const c_char,
    proxy_url_ptr: *const c_char,
) -> *mut c_char {
    let raw_query = match cstr_to_string(query_ptr) {
        Some(q) => q.trim().to_string(),
        None => return to_json_error("query inválido"),
    };

    if raw_query.is_empty() {
        return to_json_error("query vacío");
    }

    let proxy_url = cstr_to_string(proxy_url_ptr).unwrap_or_else(|| "direct".to_string());
    let client = match build_client(&proxy_url) {
        Ok(c) => c,
        Err(e) => return to_json_error(&format!("error creando cliente HTTP: {}", e)),
    };

    let normalized_query = normalize_for_search(&raw_query);
    let query_parts: Vec<&str> = normalized_query.split_whitespace().collect();
    let broad_term = query_parts.last().copied().unwrap_or(&normalized_query);
    let escaped = escape_ia_query_value(broad_term);

    let q = format!(
        "(title:({0}) OR creator:({0}) OR description:({0})) AND mediatype:(audio OR etree)",
        escaped
    );

    let response = match client
        .get(SEARCH_ENDPOINT)
        .query(&[
            ("q", q.as_str()),
            ("fl[]", "identifier"),
            ("fl[]", "title"),
            ("fl[]", "creator"),
            ("fl[]", "mediatype"),
            ("fl[]", "collection"),
            ("fl[]", "downloads"),
            ("rows", "20"),
            ("sort[]", "downloads desc"),
            ("output", "json"),
        ])
        .send()
    {
        Ok(r) => r,
        Err(e) => return to_json_error(&format!("error de red en búsqueda: {}", e)),
    };

    let json: Value = match response.json() {
        Ok(v) => v,
        Err(e) => return to_json_error(&format!("respuesta inválida de búsqueda: {}", e)),
    };

    let docs = match json
        .get("response")
        .and_then(|v| v.get("docs"))
        .and_then(|v| v.as_array())
    {
        Some(d) => d,
        None => return to_json_error("respuesta de búsqueda sin docs"),
    };

    let mut resolved_tracks = Vec::new();

    for doc in docs {
        let identifier = get_string(doc, "identifier").unwrap_or_default();
        if identifier.is_empty() {
            continue;
        }

        let item_title = get_mixed_string(doc.get("title"), "Desconocido");
        let item_creator = get_mixed_string(doc.get("creator"), "Desconocido");
        let downloads = doc.get("downloads").and_then(|v| v.as_u64()).unwrap_or(0);

        let metadata = match fetch_metadata(&client, &identifier) {
            Ok(v) => v,
            Err(_) => continue,
        };

        let files = match metadata.get("files").and_then(|v| v.as_array()) {
            Some(f) => f,
            None => continue,
        };

        for file in files {
            let file_name = get_string(file, "name").unwrap_or_default();
            let format = get_string(file, "format").unwrap_or_default();
            let source = get_string(file, "source").unwrap_or_default();
            let size = get_string(file, "size")
                .and_then(|s| s.parse::<u64>().ok())
                .unwrap_or(0);

            if !looks_like_audio_candidate(&file_name, &format) {
                continue;
            }

            let audio_score = score_file(&file_name, &format, &source, size, "auto");
            if audio_score >= 10_000 {
                continue;
            }

            let semantic_score = score_track_candidate(
                &normalized_query,
                &item_title,
                &item_creator,
                &file_name,
                downloads,
                audio_score,
            );

            let track_name = derive_track_name(&file_name, &item_title);
            let track_id = format!("{}::{}", identifier, file_name);

            resolved_tracks.push(json!({
                "provider": "Internet Archive",
                "trackId": track_id,
                "trackName": track_name,
                "artistName": item_creator,
                "coverArtUrl": format!("{}/{}", IMG_BASE, identifier),
                "sourceLink": format!("{}/{}", DETAILS_BASE, identifier),
                "downloads": downloads,
                "audioScore": audio_score,
                "semanticScore": semantic_score,
                "format": format,
                "isCached": 0
            }));
        }
    }

    resolved_tracks.sort_by(|a, b| {
        let sa = a.get("semanticScore").and_then(|v| v.as_i64()).unwrap_or(i64::MAX);
        let sb = b.get("semanticScore").and_then(|v| v.as_i64()).unwrap_or(i64::MAX);
        sa.cmp(&sb)
    });

    resolved_tracks.truncate(50);

    if resolved_tracks.is_empty() {
        return to_json_error("sin pistas resolubles");
    }

    to_json_value(&Value::Array(resolved_tracks))
}

#[no_mangle]
pub extern "C" fn get_stream_url(
    track_id_ptr: *const c_char,
    _proxy_url_ptr: *const c_char,
    format_pref_ptr: *const c_char,
) -> *mut c_char {
    let track_id = match cstr_to_string(track_id_ptr) {
        Some(v) => v,
        None => return to_plain_error("track_id inválido"),
    };

    // Parsear la preferencia de formato del usuario
    let format_pref = cstr_to_string(format_pref_ptr)
        .map(|s| s.trim().to_lowercase())
        .unwrap_or_else(|| "auto".to_string());

    let (identifier, filename) = match track_id.split_once("::") {
        Some((id, file)) if !id.trim().is_empty() && !file.trim().is_empty() => (id.trim(), file.trim()),
        _ => return to_plain_error("track_id inválido: se esperaba identifier::filename"),
    };

    // Si el usuario pide un formato específico y el archivo actual no coincide,
    // intentar buscar una alternativa en los metadatos del ítem.
    let proxy_url = cstr_to_string(_proxy_url_ptr).unwrap_or_else(|| "direct".to_string());
    if format_pref != "auto" {
        if let Ok(client) = build_client(&proxy_url) {
            if let Ok(metadata) = fetch_metadata(&client, identifier) {
                if let Some(files) = metadata.get("files").and_then(|v| v.as_array()) {
                    // Buscar el mejor archivo según la heurística dinámica
                    let mut best_file: Option<(&str, i32)> = None;
                    for file in files {
                        let fname = match file.get("name").and_then(|v| v.as_str()) {
                            Some(n) => n,
                            None => continue,
                        };
                        let fmt = file.get("format").and_then(|v| v.as_str()).unwrap_or("");
                        let src = file.get("source").and_then(|v| v.as_str()).unwrap_or("");
                        let sz = file.get("size")
                            .and_then(|v| v.as_str())
                            .and_then(|s| s.parse::<u64>().ok())
                            .unwrap_or(0);

                        if !looks_like_audio_candidate(fname, fmt) {
                            continue;
                        }

                        let score = score_file(fname, fmt, src, sz, &format_pref);
                        if score >= 10_000 {
                            continue;
                        }

                        if best_file.is_none() || score < best_file.unwrap().1 {
                            best_file = Some((fname, score));
                        }
                    }

                    if let Some((best_name, _)) = best_file {
                        let encoded = encode_path_segment(best_name);
                        let url = format!("{}/{}/{}", DOWNLOAD_BASE, identifier, encoded);
                        return to_c_string(&url);
                    }
                }
            }
        }
    }

    // Fallback: devolver la URL del archivo original solicitado
    let encoded_name = encode_path_segment(filename);
    let final_url = format!("{}/{}/{}", DOWNLOAD_BASE, identifier, encoded_name);
    to_c_string(&final_url)
}

#[no_mangle]
pub extern "C" fn free_plugin_string(s: *mut c_char) {
    unsafe {
        if s.is_null() {
            return;
        }
        let _ = CString::from_raw(s);
    }
}

fn fetch_metadata(client: &Client, identifier: &str) -> Result<Value, String> {
    let url = format!("{}/{}", METADATA_ENDPOINT, identifier);
    let response = client
        .get(&url)
        .query(&[("extended_err", "1")])
        .send()
        .map_err(|e| e.to_string())?;

    response.json::<Value>().map_err(|e| e.to_string())
}

fn build_client(proxy_url: &str) -> Result<Client, reqwest::Error> {
    let builder = Client::builder()
        .timeout(Duration::from_secs(20))
        .connect_timeout(Duration::from_secs(10))
        .pool_idle_timeout(Duration::from_secs(30))
        .user_agent("TidolCore-InternetArchiveProvider/3.0");

    if proxy_url == "direct" || proxy_url.trim().is_empty() {
        return builder.build();
    }

    match Proxy::all(proxy_url) {
        Ok(proxy) => builder.proxy(proxy).build(),
        Err(_) => builder.build(),
    }
}

fn cstr_to_string(ptr: *const c_char) -> Option<String> {
    if ptr.is_null() {
        return None;
    }

    unsafe { CStr::from_ptr(ptr).to_str().ok().map(|s| s.to_string()) }
}

fn to_c_string(s: &str) -> *mut c_char {
    let cleaned: Cow<'_, str> = if s.as_bytes().contains(&0) {
        Cow::Owned(s.replace('\0', " "))
    } else {
        Cow::Borrowed(s)
    };

    match CString::new(cleaned.as_ref()) {
        Ok(v) => v.into_raw(),
        Err(_) => CString::new("error").unwrap().into_raw(),
    }
}

fn to_json_error(msg: &str) -> *mut c_char {
    to_json_value(&json!({
        "status": "error",
        "error": msg
    }))
}

fn to_plain_error(msg: &str) -> *mut c_char {
    to_c_string(&format!("error: {}", msg))
}

fn to_json_value(value: &Value) -> *mut c_char {
    match serde_json::to_string(value) {
        Ok(s) => to_c_string(&s),
        Err(_) => to_json_error("error serializando JSON"),
    }
}

fn normalize_for_search(input: &str) -> String {
    input
        .trim()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

fn escape_ia_query_value(input: &str) -> String {
    input.replace('\\', " ").replace('"', " ")
}

fn get_string(v: &Value, key: &str) -> Option<String> {
    v.get(key).and_then(|x| x.as_str()).map(|s| s.to_string())
}

fn get_mixed_string(value: Option<&Value>, default: &str) -> String {
    match value {
        Some(Value::String(s)) => s.clone(),
        Some(Value::Array(arr)) => arr.iter().filter_map(|v| v.as_str()).collect::<Vec<_>>().join(", "),
        _ => default.to_string(),
    }
}

fn encode_path_segment(name: &str) -> String {
    utf8_percent_encode(name, NON_ALPHANUMERIC).to_string()
}

fn looks_like_audio_candidate(name: &str, format: &str) -> bool {
    let lname = name.to_lowercase();
    let lformat = format.to_lowercase();

    let blocked_ext = [
        ".jpg", ".jpeg", ".png", ".gif", ".txt", ".xml", ".json", ".sqlite", ".db", ".pdf",
        ".torrent", ".m3u", ".m3u8", ".cue", ".ffp", ".log",
    ];

    let blocked_name_bits = [
        "thumb", "cover", "booklet", "spectrogram", "scanner", "_meta", "_files",
        "checksum", "preview", "sample",
    ];

    let allowed_format_bits = [
        "flac", "24bit flac", "mp3", "vbr mp3", "ogg", "vorbis", "wav", "wave",
        "aiff", "alac", "apple lossless",
    ];

    if blocked_ext.iter().any(|ext| lname.ends_with(ext)) {
        return false;
    }

    if blocked_name_bits.iter().any(|b| lname.contains(b)) {
        return false;
    }

    allowed_format_bits.iter().any(|f| lformat.contains(f))
        || lname.ends_with(".flac")
        || lname.ends_with(".mp3")
        || lname.ends_with(".ogg")
        || lname.ends_with(".wav")
        || lname.ends_with(".aiff")
        || lname.ends_with(".aif")
        || lname.ends_with(".m4a")
}

/// Heurística Dinámica de Formato — asigna un score numérico a cada archivo
/// de audio. Un score MAS BAJO = mejor candidato.
///
/// `format_pref` controla el comportamiento:
///   - `"mp3"`:  Descarta lossless (score 999). Prioriza VBR MP3 (10) > MP3 (20).
///   - `"flac"`: Prioriza 24bit FLAC (10) > FLAC (20). MP3 como fallback (500).
///   - `"auto"`: Comportamiento original (lossless primero, escalonado).
fn score_file(name: &str, format: &str, source: &str, size: u64, format_pref: &str) -> i32 {
    let lname = name.to_lowercase();
    let lformat = format.to_lowercase();
    let lsource = source.to_lowercase();

    let mut score = match format_pref {
        // ── Regla Oro MP3: el usuario quiere lossy comprimido ─────────
        "mp3" => {
            if lformat.contains("vbr mp3") {
                10
            } else if lformat.contains("mp3") {
                20
            } else if lformat.contains("ogg") || lformat.contains("vorbis") {
                80
            } else if lformat.contains("flac") || lformat.contains("alac")
                || lformat.contains("apple lossless") || lformat.contains("aiff")
                || lformat.contains("wav") || lformat.contains("wave")
            {
                // Descartar formatos lossless cuando el usuario pide MP3
                999
            } else {
                10_000
            }
        }

        // ── Regla Oro FLAC: el usuario quiere lossless ───────────────
        "flac" => {
            if lformat.contains("24bit flac") {
                10
            } else if lformat.contains("flac") {
                20
            } else if lformat.contains("alac") || lformat.contains("apple lossless") {
                60
            } else if lformat.contains("aiff") {
                80
            } else if lformat.contains("wav") || lformat.contains("wave") {
                100
            } else if lformat.contains("vbr mp3") {
                // MP3 como fallback si no hay lossless en el álbum
                500
            } else if lformat.contains("mp3") {
                520
            } else if lformat.contains("ogg") || lformat.contains("vorbis") {
                540
            } else {
                10_000
            }
        }

        // ── Modo Auto: comportamiento original (prioridad lossless) ──
        _ => {
            if lformat.contains("24bit flac") {
                100
            } else if lformat.contains("flac") {
                150
            } else if lformat.contains("alac") || lformat.contains("apple lossless") {
                220
            } else if lformat.contains("aiff") {
                260
            } else if lformat.contains("wav") || lformat.contains("wave") {
                300
            } else if lformat.contains("vbr mp3") {
                450
            } else if lformat.contains("mp3") {
                520
            } else if lformat.contains("ogg") || lformat.contains("vorbis") {
                580
            } else {
                10_000
            }
        }
    };

    // Bonificaciones/penalizaciones comunes (independientes de format_pref)
    if lsource == "original" {
        score -= 40;
    } else if lsource == "derivative" {
        score += 40;
    }

    if size > 0 && size < 128 * 1024 {
        score += 1000;
    }

    if size > 20 * 1024 * 1024 {
        score -= 15;
    }

    if lname.contains("sample") || lname.contains("preview") {
        score += 1200;
    }

    score
}

fn score_track_candidate(
    query: &str,
    item_title: &str,
    item_creator: &str,
    file_name: &str,
    downloads: u64,
    audio_score: i32,
) -> i64 {
    let q = query.to_lowercase();
    let title = item_title.to_lowercase();
    let creator = item_creator.to_lowercase();
    let file = sanitize_filename_for_match(file_name);

    let mut score = audio_score as i64 + 1000;

    if file == q {
        score -= 500;
    } else if file.contains(&q) {
        score -= 260;
    }

    if title == q {
        score -= 180;
    } else if title.contains(&q) {
        score -= 100;
    }

    if creator.contains(&q) {
        score -= 40;
    }

    score -= (downloads.min(50_000) / 1500) as i64;

    score
}

fn sanitize_filename_for_match(name: &str) -> String {
    let lower = name.to_lowercase();
    let without_ext = lower
        .rsplit_once('.')
        .map(|(base, _)| base.to_string())
        .unwrap_or(lower);

    without_ext
        .replace('_', " ")
        .replace('-', " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn derive_track_name(file_name: &str, fallback: &str) -> String {
    let clean = file_name
        .rsplit_once('.')
        .map(|(base, _)| base)
        .unwrap_or(file_name)
        .replace('_', " ")
        .replace('-', " ")
        .trim()
        .to_string();

    if clean.is_empty() {
        fallback.to_string()
    } else {
        clean
    }
}
