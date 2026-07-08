// ──────────────────────────────────────────────────────────────────────────────
// provider-jamendo — Jamendo Music API Engine for Tidol Core
// ──────────────────────────────────────────────────────────────────────────────
// Plugin dinámico (cdylib) que expone el contrato FFI estricto:
//   get_provider_name, search_track, get_stream_url, free_plugin_string
//
// Usa la API pública v3.0 de Jamendo (https://developer.jamendo.com/v3.0).
// El client_id se lee de la variable de entorno JAMENDO_CLIENT_ID en tiempo de
// ejecución; si no está definida se utiliza un client_id de demo público.
//
// Estrategia de calidad de audio:
//   FLAC > OGG > MP3 VBR (mp32) > MP3 96 kbps (mp31)
// ──────────────────────────────────────────────────────────────────────────────
// Contrato FFI del plugin: los exports deben ser `pub extern "C"` con
// punteros crudos (los carga tidol-core vía dlopen); el lint pide `unsafe fn`,
// pero eso no aporta nada a un símbolo dinámico y rompería la simetría del ABI
// documentado. Preexistente en la línea base (e46be8bb).
#![allow(clippy::not_unsafe_ptr_arg_deref)]

use reqwest::blocking::Client;
use reqwest::Proxy;
use serde_json::{json, Value};
use std::borrow::Cow;
use std::ffi::{c_char, CStr, CString};
use std::time::Duration;

// ─── Constantes ──────────────────────────────────────────────────────────────

const PROVIDER_NAME: &str = "Jamendo Music API Engine";
const API_BASE: &str = "https://api.jamendo.com/v3.0";

/// Client ID público de demo documentado por Jamendo para aplicaciones de
/// prueba. En producción el operador debe definir JAMENDO_CLIENT_ID.
const FALLBACK_CLIENT_ID: &str = "b6747d04";

/// Formatos de audio ordenados de mayor a menor calidad.
/// La API acepta: flac, ogg, mp32 (VBR ~192 kbps), mp31 (CBR 96 kbps).
const QUALITY_TIERS: &[&str] = &["flac", "ogg", "mp32", "mp31"];

/// Tamaño de carátula en píxeles solicitado a la API de Jamendo.
const COVER_SIZE: &str = "400";

/// Máximo de resultados por búsqueda.
const SEARCH_LIMIT: &str = "30";

// ─── Contrato FFI ────────────────────────────────────────────────────────────

/// Devuelve el nombre legible del proveedor.
#[no_mangle]
pub extern "C" fn get_provider_name() -> *mut c_char {
    to_c_string(PROVIDER_NAME)
}

/// Busca pistas en Jamendo y devuelve un JSON array con el esquema camelCase
/// definido por Tidol Core.
///
/// # Parámetros
/// * `query_ptr`     – Cadena C con la consulta de búsqueda.
/// * `proxy_url_ptr` – Cadena C con la URL del proxy ("direct" = sin proxy).
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

    let client_id = resolve_client_id();

    // ── Búsqueda de pistas ───────────────────────────────────────────────
    let response = match client
        .get(format!("{}/tracks/", API_BASE))
        .query(&[
            ("client_id", client_id.as_str()),
            ("format", "json"),
            ("limit", SEARCH_LIMIT),
            ("search", raw_query.as_str()),
            ("imagesize", COVER_SIZE),
            ("audioformat", "flac"),            // solicitar URLs FLAC
            ("type", "single+albumtrack"),       // incluir singles y álbumes
            ("order", "relevance"),
            ("boost", "popularity_total"),
            ("include", "musicinfo+stats"),
        ])
        .send()
    {
        Ok(r) => r,
        Err(e) => return to_json_error(&format!("error de red en búsqueda: {}", e)),
    };

    if !response.status().is_success() {
        return to_json_error(&format!(
            "Jamendo API respondió con HTTP {}",
            response.status()
        ));
    }

    let body: Value = match response.json() {
        Ok(v) => v,
        Err(e) => return to_json_error(&format!("respuesta inválida de búsqueda: {}", e)),
    };

    // Verificar estado de la API
    let api_status = body
        .get("headers")
        .and_then(|h| h.get("status"))
        .and_then(|s| s.as_str())
        .unwrap_or("unknown");

    if api_status != "success" {
        let err_msg = body
            .get("headers")
            .and_then(|h| h.get("error_message"))
            .and_then(|m| m.as_str())
            .unwrap_or("error desconocido de la API");
        return to_json_error(&format!("Jamendo API error: {}", err_msg));
    }

    let results = match body.get("results").and_then(|v| v.as_array()) {
        Some(arr) => arr,
        None => return to_json_error("respuesta de búsqueda sin results"),
    };

    if results.is_empty() {
        return to_json_error("sin pistas encontradas");
    }

    // ── Transformar al esquema Tidol Core ─────────────────────────────────
    let tracks: Vec<Value> = results
        .iter()
        .filter_map(|track| {
            let track_id = track.get("id")?.as_str().or({
                // A veces el id llega como número
                None
            }).map(|s| s.to_string()).or_else(|| {
                track.get("id").and_then(|v| v.as_u64()).map(|n| n.to_string())
            })?;

            let track_name = track
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("Desconocido")
                .to_string();

            let artist_name = track
                .get("artist_name")
                .and_then(|v| v.as_str())
                .unwrap_or("Desconocido")
                .to_string();

            // Usar `image` (funciona tanto para singles como album tracks)
            let cover_art_url = track
                .get("image")
                .and_then(|v| v.as_str())
                .or_else(|| track.get("album_image").and_then(|v| v.as_str()))
                .unwrap_or("")
                .to_string();

            let source_link = track
                .get("shareurl")
                .and_then(|v| v.as_str())
                .unwrap_or({
                    // Construir URL de fallback
                    ""
                })
                .to_string();

            let source_link_final = if source_link.is_empty() {
                format!("https://www.jamendo.com/track/{}", track_id)
            } else {
                source_link
            };

            Some(json!({
                "provider": "Jamendo",
                "trackId": track_id,
                "trackName": track_name,
                "artistName": artist_name,
                "coverArtUrl": cover_art_url,
                "sourceLink": source_link_final,
                "isCached": 0
            }))
        })
        .collect();

    if tracks.is_empty() {
        return to_json_error("sin pistas resolubles");
    }

    to_json_value(&Value::Array(tracks))
}

/// Resuelve la URL directa de streaming para una pista dada.
///
/// Estrategia: reordena la cascada de calidad según `format_pref`:
///   - "flac": FLAC → OGG → MP3 VBR → MP3 96kbps
///   - "mp3":  MP3 VBR → MP3 96kbps → OGG → FLAC
///   - "ogg":  OGG → FLAC → MP3 VBR → MP3 96kbps
///   - "auto": Comportamiento por defecto (máxima calidad disponible)
///
/// # Parámetros
/// * `track_id_ptr`    – Cadena C con el ID numérico de la pista en Jamendo.
/// * `proxy_url_ptr`   – Cadena C con la URL del proxy.
/// * `format_pref_ptr` – Cadena C con la preferencia de formato ("mp3", "flac", "auto").
#[no_mangle]
pub extern "C" fn get_stream_url(
    track_id_ptr: *const c_char,
    proxy_url_ptr: *const c_char,
    format_pref_ptr: *const c_char,
) -> *mut c_char {
    let track_id = match cstr_to_string(track_id_ptr) {
        Some(v) if !v.trim().is_empty() => v.trim().to_string(),
        _ => return to_plain_error("track_id inválido o vacío"),
    };

    let proxy_url = cstr_to_string(proxy_url_ptr).unwrap_or_else(|| "direct".to_string());
    let client = match build_client(&proxy_url) {
        Ok(c) => c,
        Err(e) => return to_plain_error(&format!("error creando cliente HTTP: {}", e)),
    };

    let client_id = resolve_client_id();

    // ── Parsear preferencia de formato del usuario ────────────────────────
    let format_pref = cstr_to_string(format_pref_ptr)
        .map(|s| s.trim().to_lowercase())
        .unwrap_or_else(|| "auto".to_string());

    let tiers: &[&str] = match format_pref.as_str() {
        "mp3"  => &["mp32", "mp31", "ogg", "flac"],
        "flac" => &["flac", "ogg", "mp32", "mp31"],
        "ogg"  => &["ogg", "flac", "mp32", "mp31"],
        _      => QUALITY_TIERS, // auto: flac > ogg > mp32 > mp31
    };

    // ── Cascada de calidad: intentar cada formato de mayor a menor ────────
    for &audio_format in tiers {
        let url = match resolve_stream_for_format(&client, &client_id, &track_id, audio_format) {
            Ok(Some(u)) => u,
            Ok(None) => continue,
            Err(_) => continue,
        };

        // Validar que la URL no esté vacía y sea una URL real
        if !url.is_empty() && url.starts_with("http") {
            return to_c_string(&url);
        }
    }

    // Si ningún tier funcionó, devolver la URL de stream genérica de Jamendo
    // que siempre resuelve a mp31 (96 kbps) como fallback último.
    let fallback_fmt = match format_pref.as_str() {
        "mp3" => "mp32",
        _     => "mp32",
    };
    let fallback = format!(
        "https://prod-1.storage.jamendo.com/?trackid={}&format={}&from=app-tidol",
        track_id, fallback_fmt
    );
    to_c_string(&fallback)
}

/// Libera un string de C alocado por este plugin.
/// **Debe** ser invocada por el host (Axum) para cada puntero devuelto.
#[no_mangle]
pub extern "C" fn free_plugin_string(s: *mut c_char) {
    unsafe {
        if s.is_null() {
            return;
        }
        let _ = CString::from_raw(s);
    }
}

// ─── Funciones internas ──────────────────────────────────────────────────────

/// Intenta resolver la URL de streaming de un formato específico usando el
/// endpoint `/tracks/file/` de Jamendo API v3.0.
///
/// Devuelve `Ok(Some(url))` si la API devolvió una URL válida para ese formato,
/// `Ok(None)` si el formato no está disponible, o `Err(msg)` en caso de fallo.
fn resolve_stream_for_format(
    client: &Client,
    client_id: &str,
    track_id: &str,
    audio_format: &str,
) -> Result<Option<String>, String> {
    let response = client
        .get(format!("{}/tracks/", API_BASE))
        .query(&[
            ("client_id", client_id),
            ("format", "json"),
            ("id", track_id),
            ("audioformat", audio_format),
        ])
        .send()
        .map_err(|e| format!("red: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }

    let body: Value = response.json().map_err(|e| format!("json: {}", e))?;

    let api_status = body
        .get("headers")
        .and_then(|h| h.get("status"))
        .and_then(|s| s.as_str())
        .unwrap_or("unknown");

    if api_status != "success" {
        return Ok(None);
    }

    let results = body
        .get("results")
        .and_then(|r| r.as_array())
        .ok_or_else(|| "sin results".to_string())?;

    let track = match results.first() {
        Some(t) => t,
        None => return Ok(None),
    };

    // El campo `audio` contiene la URL de streaming en el formato solicitado
    let audio_url = track
        .get("audio")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    if audio_url.is_empty() {
        return Ok(None);
    }

    Ok(Some(audio_url))
}

/// Resuelve el client_id para la API de Jamendo.
/// Prioridad: variable de entorno JAMENDO_CLIENT_ID > fallback de demo.
fn resolve_client_id() -> String {
    std::env::var("JAMENDO_CLIENT_ID").unwrap_or_else(|_| FALLBACK_CLIENT_ID.to_string())
}

// ─── Utilidades FFI ──────────────────────────────────────────────────────────

/// Construye un cliente HTTP con soporte opcional de proxy.
fn build_client(proxy_url: &str) -> Result<Client, reqwest::Error> {
    let builder = Client::builder()
        .timeout(Duration::from_secs(20))
        .connect_timeout(Duration::from_secs(10))
        .pool_idle_timeout(Duration::from_secs(30))
        .user_agent("TidolCore-JamendoProvider/1.0");

    if proxy_url == "direct" || proxy_url.trim().is_empty() {
        return builder.build();
    }

    match Proxy::all(proxy_url) {
        Ok(proxy) => builder.proxy(proxy).build(),
        Err(_) => builder.build(),
    }
}

/// Convierte un puntero `*const c_char` (C string) a un `Option<String>` de Rust.
/// Devuelve `None` si el puntero es nulo o la cadena no es UTF-8 válido.
fn cstr_to_string(ptr: *const c_char) -> Option<String> {
    if ptr.is_null() {
        return None;
    }
    unsafe { CStr::from_ptr(ptr).to_str().ok().map(|s| s.to_string()) }
}

/// Convierte un `&str` de Rust en un puntero `*mut c_char` que el host
/// puede consumir. El host **debe** llamar a `free_plugin_string` después.
///
/// Si el string contiene bytes nulos internos, se reemplazan con espacios
/// para evitar truncamiento accidental del CString.
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

/// Devuelve un JSON de error serializado como C string.
/// Esquema: `{"status": "error", "error": "<msg>"}`
fn to_json_error(msg: &str) -> *mut c_char {
    to_json_value(&json!({
        "status": "error",
        "error": msg
    }))
}

/// Devuelve un error plano (no JSON) como C string.
/// Usado por `get_stream_url` que devuelve una URL o un texto de error.
fn to_plain_error(msg: &str) -> *mut c_char {
    to_c_string(&format!("error: {}", msg))
}

/// Serializa un `serde_json::Value` a JSON string y lo devuelve como C string.
fn to_json_value(value: &Value) -> *mut c_char {
    match serde_json::to_string(value) {
        Ok(s) => to_c_string(&s),
        Err(_) => to_json_error("error serializando JSON"),
    }
}
