use reqwest::blocking::Client;
use std::ffi::{c_char, CStr, CString};
use std::time::Duration;
use urlencoding::encode;

#[no_mangle]
pub extern "C" fn get_provider_name() -> *mut c_char {
    CString::new("LRCLIB / Plain Text Engine")
        .unwrap()
        .into_raw()
}

#[no_mangle]
pub extern "C" fn fetch_lyrics(
    track_name_ptr: *const c_char,
    artist_name_ptr: *const c_char,
) -> *mut c_char {
    let track_name = unsafe { CStr::from_ptr(track_name_ptr).to_str().unwrap_or("") }.trim();
    let artist_name = unsafe { CStr::from_ptr(artist_name_ptr).to_str().unwrap_or("") }.trim();

    if track_name.is_empty() {
        let error = serde_json::json!({ "status": "error", "message": "Track name vacio" });
        return CString::new(error.to_string()).unwrap().into_raw();
    }

    println!(
        "[Lyrics-Plugin] Buscando letras para: '{}' by '{}'",
        track_name, artist_name
    );

    let client = Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .unwrap();

    // LRCLIB API Endpoint
    let search_url = format!(
        "https://lrclib.net/api/search?track_name={}&artist_name={}",
        encode(track_name),
        encode(artist_name)
    );

    match client.get(&search_url).send() {
        Ok(response) => {
            if let Ok(json_array) = response.json::<Vec<serde_json::Value>>() {
                if let Some(first_result) = json_array.first() {
                    let synced_lyrics = first_result["syncedLyrics"].as_str().unwrap_or("");
                    let plain_lyrics = first_result["plainLyrics"].as_str().unwrap_or("");

                    // Prioridad 1: Tenemos las marcas de tiempo (Nivel 2: GPU 0%)
                    if !synced_lyrics.is_empty() {
                        println!(
                            "[Lyrics-Plugin] ¡Éxito! Letras sincronizadas (.lrc) encontradas."
                        );
                        let res = serde_json::json!({
                            "status": "success",
                            "type": "synced",
                            "lyrics": synced_lyrics
                        });
                        return CString::new(res.to_string()).unwrap().into_raw();
                    }
                    // Prioridad 2: Tenemos solo texto plano (Nivel 3: Necesita GPU para alinear)
                    else if !plain_lyrics.is_empty() {
                        println!("[Lyrics-Plugin] Letras en texto plano encontradas. Requiere alineación.");
                        let res = serde_json::json!({
                            "status": "success",
                            "type": "plain",
                            "lyrics": plain_lyrics
                        });
                        return CString::new(res.to_string()).unwrap().into_raw();
                    }
                }
            }
        }
        Err(e) => println!("[Lyrics-Plugin] Error de red: {}", e),
    }

    // Nivel 4: No se encontró nada, Whisper tendrá que transcribir desde cero
    let error_json = serde_json::json!({
        "status": "error",
        "type": "none",
        "message": "Letras no encontradas en la red"
    });
    CString::new(error_json.to_string()).unwrap().into_raw()
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
