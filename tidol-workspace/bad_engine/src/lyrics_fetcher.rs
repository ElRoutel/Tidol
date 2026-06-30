use reqwest::Client;
use serde::Deserialize;

#[derive(Deserialize)]
struct LrcLibResponse {
    #[serde(rename = "plainLyrics")]
    plain_lyrics: Option<String>,
}

pub async fn fetch_plain_lyrics(artist: &str, track: &str) -> Result<String, String> {
    println!("[LyricsFetcher] Buscando letras en LRCLIB para: '{} - {}'", artist, track);
    let client = Client::new();
    
    // We must pass parameters correctly URL encoded
    let url = format!(
        "https://lrclib.net/api/search?artist_name={}&track_name={}",
        urlencoding::encode(artist),
        urlencoding::encode(track)
    );
    
    let res = client.get(&url)
        .header("User-Agent", "TidolBadEngine/0.1.0")
        .send()
        .await
        .map_err(|e| format!("Error en petición a LRCLIB: {}", e))?;
        
    if !res.status().is_success() {
        return Err(format!("LRCLIB respondió con código: {}", res.status()));
    }
    
    let results: Vec<LrcLibResponse> = res.json().await
        .map_err(|e| format!("Error parseando JSON de LRCLIB: {}", e))?;
        
    if let Some(first) = results.into_iter().next() {
        if let Some(lyrics) = first.plain_lyrics {
            return Ok(lyrics);
        }
    }
    
    Err("No se encontró letra (plainLyrics) para esta canción.".into())
}
