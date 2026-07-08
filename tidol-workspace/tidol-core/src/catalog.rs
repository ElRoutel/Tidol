use serde::Deserialize;
use thiserror::Error;
use unicode_normalization::UnicodeNormalization;

use crate::models::{
    AlbumDetailsResponse, ArtistProfileResponse, HomeDashboardDTO, SearchResponse, TrackResponse,
};
use crate::orchestrator::TrackProfile;
use crate::providers::{EmbedInfo, ProviderError, Track};
use crate::TidolCore;

// -------------------------------------------------------------------------
// PAYLOADS / UTILIDADES PURAS
// -------------------------------------------------------------------------
#[derive(Deserialize)]
pub struct TrackClickPayload {
    pub query: String,
    pub track_id: String,
    pub track_name: String,
    pub artist_name: String,
    pub cover_art_url: String,
    pub source_link: String,
}

#[derive(Deserialize, Debug)]
pub struct LogPlayPayload {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub cover_url: Option<String>,
}

/// Normaliza una consulta: minúsculas, sin acentos, solo alfanumérico/espacios,
/// colapsando espacios. Pura (sin efectos).
pub fn normalize_query(query: &str) -> String {
    query
        .trim()
        .to_lowercase()
        .nfd()
        .filter(|c| c.is_ascii_alphanumeric() || c.is_whitespace())
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<&str>>()
        .join(" ")
}

/// Parsea letras en formato LRC a una lista de `{start_cs, word}`. Pura.
fn parse_lrc(lrc: &str) -> Vec<serde_json::Value> {
    let mut result = Vec::new();
    for line in lrc.lines() {
        let line = line.trim();
        if line.starts_with('[') {
            if let Some(close_idx) = line.find(']') {
                let timestamp = &line[1..close_idx];
                let text = line[close_idx + 1..].trim();

                if text.is_empty() {
                    continue;
                }

                let parts: Vec<&str> = timestamp.split(':').collect();
                if parts.len() == 2 {
                    if let Ok(m) = parts[0].parse::<u32>() {
                        let sec_parts: Vec<&str> = parts[1].split('.').collect();
                        if sec_parts.len() == 2 {
                            if let (Ok(s), Ok(ms)) =
                                (sec_parts[0].parse::<u32>(), sec_parts[1].parse::<u32>())
                            {
                                // Normalizar la fracción a centésimas según sus dígitos:
                                // [m:ss.d] son décimas (×10), [m:ss.dd] centésimas,
                                // [m:ss.ddd] milésimas (÷10). Antes ".5" se leía como
                                // 5cs en vez de 50cs y el verso llegaba adelantado.
                                let ms_val = match sec_parts[1].len() {
                                    1 => ms * 10,
                                    3 => ms / 10,
                                    _ => ms,
                                };
                                let total_cs = (m * 60 * 100) + (s * 100) + ms_val;
                                result.push(serde_json::json!({
                                    "start_cs": total_cs,
                                    "word": text
                                }));
                            }
                        } else if sec_parts.len() == 1 {
                            if let Ok(s) = sec_parts[0].parse::<u32>() {
                                let total_cs = (m * 60 * 100) + (s * 100);
                                result.push(serde_json::json!({
                                    "start_cs": total_cs,
                                    "word": text
                                }));
                            }
                        }
                    }
                }
            }
        }
    }
    result
}

// -------------------------------------------------------------------------
// ERRORES DE DOMINIO
// -------------------------------------------------------------------------
/// Error de la resolución de letras. `Db` → 500; el resto → 404. El mensaje
/// (`to_string`) es el cuerpo de la respuesta.
#[derive(Debug, Error)]
pub enum LyricsError {
    #[error("DB Error: {0}")]
    Db(sqlx::Error),
    #[error("Track not found in database")]
    NotFoundInDb,
    #[error("Lyrics not found (cached negative)")]
    CachedNegative,
    #[error("Lyrics not available")]
    NotAvailable,
}

impl TidolCore {
    // -------------------------------------------------------------------------
    // FORWARDERS al orquestador de metadatos (MusicBrainz — Legal)
    // -------------------------------------------------------------------------
    pub async fn search_catalog(
        &self,
        query: &str,
        limit: u32,
        offset: u32,
    ) -> Result<SearchResponse, Box<dyn std::error::Error + Send + Sync>> {
        self.orchestrator.search_catalog(query, limit, offset).await
    }

    pub async fn get_artist_details(
        &self,
        mbid: &str,
    ) -> Result<ArtistProfileResponse, Box<dyn std::error::Error + Send + Sync>> {
        self.orchestrator.get_artist_details(mbid).await
    }

    pub async fn get_artist_discography(
        &self,
        mbid: &str,
    ) -> Result<ArtistProfileResponse, Box<dyn std::error::Error + Send + Sync>> {
        self.orchestrator
            .get_artist_discography(mbid, &self.db)
            .await
    }

    pub async fn get_album_details(
        &self,
        mbid: &str,
    ) -> Result<AlbumDetailsResponse, Box<dyn std::error::Error + Send + Sync>> {
        self.orchestrator.get_album_details(mbid, &self.db).await
    }

    pub async fn get_similar_tracks(
        &self,
        artist: &str,
        title: &str,
        limit: u8,
    ) -> Result<Vec<TrackProfile>, String> {
        self.orchestrator
            .get_similar_tracks(artist, title, limit, &self.db)
            .await
    }

    pub async fn get_home_dashboard(
        &self,
        user_id: i64,
    ) -> Result<HomeDashboardDTO, String> {
        self.orchestrator.get_home_dashboard(&self.db, user_id).await
    }

    pub async fn get_listen_again(
        &self,
        user_id: i64,
    ) -> Result<Vec<TrackResponse>, String> {
        // El endpoint siempre pide 20 (idéntico al comportamiento previo).
        self.orchestrator.get_listen_again(&self.db, 20, user_id).await
    }

    // -------------------------------------------------------------------------
    // FORWARDERS a los proveedores de embed (APIs oficiales — Legal)
    // -------------------------------------------------------------------------
    pub async fn embed_search(&self, query: &str, limit: u32) -> Vec<Track> {
        self.embed_orchestrator.search_all(query, limit).await
    }

    pub async fn resolve_embed(&self, platform_id: &str) -> Result<EmbedInfo, ProviderError> {
        self.embed_orchestrator.resolve(platform_id).await
    }

    // -------------------------------------------------------------------------
    // REPORTE DE PORTADA 404
    // -------------------------------------------------------------------------
    pub async fn report_cover_404(&self, mbid: &str) -> Result<(), sqlx::Error> {
        sqlx::query("UPDATE albums SET cover_status = 'not_found' WHERE mbid = ?")
            .bind(mbid)
            .execute(&self.db)
            .await?;
        Ok(())
    }

    // -------------------------------------------------------------------------
    // REGISTRO DE CLICK
    // -------------------------------------------------------------------------
    /// Devuelve `false` si el payload es inválido (no registra nada), `true` tras
    /// registrar el click.
    pub async fn register_click(&self, payload: TrackClickPayload) -> bool {
        let normalized_query = normalize_query(&payload.query);

        if payload.track_id.trim().is_empty()
            || payload.track_name.trim().is_empty()
            || payload.query.trim().is_empty()
        {
            return false;
        }

        let _ = sqlx::query!(
            r#"INSERT INTO trackMetadata (trackId, trackName, artistName, coverArtUrl, sourceLink, isCached)
            VALUES (?, ?, ?, ?, ?, 1) ON DUPLICATE KEY UPDATE trackName = VALUES(trackName),
            artistName = VALUES(artistName), coverArtUrl = VALUES(coverArtUrl), sourceLink = VALUES(sourceLink), isCached = 1"#,
            payload.track_id,
            payload.track_name,
            payload.artist_name,
            payload.cover_art_url,
            payload.source_link
        )
        .execute(&self.db)
        .await;

        let _ = sqlx::query!(
            r#"INSERT INTO searchClicks (queryNormalized, trackId, clicks) VALUES (?, ?, 1)
            ON DUPLICATE KEY UPDATE clicks = clicks + 1"#,
            normalized_query,
            payload.track_id
        )
        .execute(&self.db)
        .await;

        true
    }

    // -------------------------------------------------------------------------
    // LOG PLAY (registra reproducción y actualiza track_links)
    // -------------------------------------------------------------------------
    pub async fn log_play(
        &self,
        mbid: &str,
        user_id: i64,
        payload: Option<LogPlayPayload>,
    ) -> Result<(), sqlx::Error> {
        let (mut title, mut artist, cover_url) = match payload {
            Some(p) => (
                p.title.unwrap_or_else(|| "Unknown".to_string()),
                p.artist.unwrap_or_else(|| "Unknown".to_string()),
                p.cover_url.unwrap_or_default(),
            ),
            None => ("Unknown".to_string(), "Unknown".to_string(), String::new()),
        };

        if title == "Unknown" || title.is_empty() {
            if let Ok(profile) = self.orchestrator.resolve_full_track(mbid, &self.db).await {
                title = profile.title;
                artist = profile.artist;
            }
        }

        let _ = sqlx::query!(
            r#"
            INSERT INTO track_links (mbid, title, artist, cover_url)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            title = IF(title = 'Unknown' OR title IS NULL, VALUES(title), title),
            artist = IF(artist = 'Unknown' OR artist IS NULL, VALUES(artist), artist),
            cover_url = IF(cover_url = '' OR cover_url IS NULL, VALUES(cover_url), cover_url)
            "#,
            mbid,
            title,
            artist,
            cover_url
        )
        .execute(&self.db)
        .await;

        sqlx::query("INSERT INTO play_history (track_mbid, user_id) VALUES (?, ?)")
            .bind(mbid)
            .bind(user_id)
            .execute(&self.db)
            .await?;

        Ok(())
    }

    // -------------------------------------------------------------------------
    // LETRAS (LRCLIB — Legal API)
    // -------------------------------------------------------------------------
    pub async fn get_lyrics(&self, track_id: &str) -> Result<serde_json::Value, LyricsError> {
        let row = sqlx::query_as::<_, (Option<String>, Option<String>, String, String)>(
            "SELECT lyrics_json, lyrics_status, artist, title FROM track_links WHERE mbid = ? LIMIT 1",
        )
        .bind(track_id)
        .fetch_optional(&self.db)
        .await
        .map_err(LyricsError::Db)?;

        let (lyrics_json, lyrics_status, artist, title) = match row {
            Some(r) => r,
            None => return Err(LyricsError::NotFoundInDb),
        };

        let status = lyrics_status.as_deref().unwrap_or("pending");

        match status {
            "whisper_synced" => {
                if let Some(ref json_str) = lyrics_json {
                    let parsed: serde_json::Value =
                        serde_json::from_str(json_str).unwrap_or(serde_json::json!([]));
                    let lines = if let Some(words) = parsed.get("words") {
                        words.clone()
                    } else {
                        parsed
                    };
                    return Ok(serde_json::json!({ "type": "whisper_synced", "lines": lines }));
                }
            }
            "lrclib_synced" => {
                if let Some(ref json_str) = lyrics_json {
                    let parsed: serde_json::Value =
                        serde_json::from_str(json_str).unwrap_or(serde_json::json!([]));
                    return Ok(serde_json::json!({ "type": "lrclib_synced", "lines": parsed }));
                }
            }
            "plain_only" => {
                if let Some(ref json_str) = lyrics_json {
                    let parsed: serde_json::Value =
                        serde_json::from_str(json_str).unwrap_or(serde_json::json!([]));
                    return Ok(serde_json::json!({ "type": "plain", "lines": parsed }));
                }
            }
            "not_found" => {
                return Err(LyricsError::CachedNegative);
            }
            _ => {}
        }

        // Fetch from LRCLIB (legal API)
        let lrclib_url = format!(
            "https://lrclib.net/api/search?artist_name={}&track_name={}",
            urlencoding::encode(&artist),
            urlencoding::encode(&title)
        );

        // Timeout explícito: sin él, un LRCLIB caído dejaba la petición colgada.
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(8))
            .build()
            .unwrap_or_default();
        let lrclib_response = client.get(&lrclib_url).send().await;
        let mut lrclib_answered = false;

        if let Ok(resp) = lrclib_response {
            if resp.status().is_success() {
                lrclib_answered = true;
                if let Ok(mut results) = resp.json::<Vec<serde_json::Value>>().await {
                    if !results.is_empty() {
                        let first = results.remove(0);

                        if let Some(synced) = first.get("syncedLyrics").and_then(|v| v.as_str()) {
                            if !synced.is_empty() {
                                let parsed_lines = parse_lrc(synced);
                                let json_to_store =
                                    serde_json::to_string(&parsed_lines).unwrap_or_default();

                                let _ = sqlx::query(
                                    "UPDATE track_links SET lyrics_json = ?, lyrics_status = 'lrclib_synced' WHERE mbid = ?"
                                )
                                .bind(&json_to_store)
                                .bind(track_id)
                                .execute(&self.db)
                                .await;

                                return Ok(serde_json::json!({
                                    "type": "lrclib_synced",
                                    "lines": parsed_lines
                                }));
                            }
                        }

                        if let Some(plain) = first.get("plainLyrics").and_then(|v| v.as_str()) {
                            if !plain.is_empty() {
                                let lines: Vec<&str> = plain
                                    .lines()
                                    .map(|l| l.trim())
                                    .filter(|l| !l.is_empty())
                                    .collect();
                                let json_to_store =
                                    serde_json::to_string(&lines).unwrap_or_default();

                                let _ = sqlx::query(
                                    "UPDATE track_links SET lyrics_json = ?, lyrics_status = 'plain_only' WHERE mbid = ?"
                                )
                                .bind(&json_to_store)
                                .bind(track_id)
                                .execute(&self.db)
                                .await;

                                return Ok(serde_json::json!({
                                    "type": "plain",
                                    "lines": lines
                                }));
                            }
                        }
                    }
                }
            }
        }

        // Solo cachear negativo si LRCLIB respondió correctamente pero sin letra.
        // Un fallo transitorio (timeout/red/rate-limit) deja el estado en 'pending'
        // para reintentar luego (antes cualquier fallo cacheaba un 404 permanente).
        if lrclib_answered {
            let _ = sqlx::query("UPDATE track_links SET lyrics_status = 'not_found' WHERE mbid = ?")
                .bind(track_id)
                .execute(&self.db)
                .await;
        }

        Err(LyricsError::NotAvailable)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── normalize_query: comportamiento de línea base (main.rs @ e46be8bb) ──

    #[test]
    fn normalize_query_minusculas_y_espacios() {
        assert_eq!(normalize_query("  Hello   WORLD  "), "hello world");
    }

    #[test]
    fn normalize_query_quita_acentos_y_simbolos() {
        // NFD descompone "é" en "e" + diacrítico; el filtro ascii-alfanumérico
        // conserva la base y descarta el diacrítico y la puntuación.
        assert_eq!(normalize_query("Café, ¡Olé!"), "cafe ole");
    }

    #[test]
    fn normalize_query_entrada_vacia_o_solo_simbolos() {
        assert_eq!(normalize_query(""), "");
        assert_eq!(normalize_query("¡¿!?"), "");
    }

    // ── parse_lrc: semántica de centésimas de la línea base ──
    // Referencia: [m:ss.d]=décimas (×10), [m:ss.dd]=centésimas,
    // [m:ss.ddd]=milésimas (÷10), [m:ss]=solo segundos.

    fn cs_of(line: &serde_json::Value) -> u64 {
        line.get("start_cs").and_then(|v| v.as_u64()).unwrap()
    }

    fn word_of(line: &serde_json::Value) -> String {
        line.get("word").and_then(|v| v.as_str()).unwrap().to_string()
    }

    #[test]
    fn parse_lrc_centesimas_dos_digitos() {
        let out = parse_lrc("[00:12.34] Hola mundo");
        assert_eq!(out.len(), 1);
        assert_eq!(cs_of(&out[0]), 12 * 100 + 34);
        assert_eq!(word_of(&out[0]), "Hola mundo");
    }

    #[test]
    fn parse_lrc_decimas_un_digito_multiplica_por_diez() {
        // El fix de la base: ".5" son 50 cs, no 5 cs.
        let out = parse_lrc("[00:12.5] Verso");
        assert_eq!(cs_of(&out[0]), 12 * 100 + 50);
    }

    #[test]
    fn parse_lrc_milesimas_tres_digitos_divide_entre_diez() {
        let out = parse_lrc("[00:12.345] Verso");
        assert_eq!(cs_of(&out[0]), 12 * 100 + 34);
    }

    #[test]
    fn parse_lrc_minutos_y_solo_segundos() {
        let out = parse_lrc("[01:02] Texto");
        assert_eq!(cs_of(&out[0]), (60 + 2) * 100);
    }

    #[test]
    fn parse_lrc_ignora_lineas_sin_texto_o_malformadas() {
        let lrc = "[00:10.00]\n\
                   sin timestamp\n\
                   [ar:Artista]\n\
                   [1:2:3] tres partes\n\
                   [xx:yy.zz] no numérico\n\
                   [00:20.00] Válida";
        let out = parse_lrc(lrc);
        assert_eq!(out.len(), 1, "solo la línea válida debe sobrevivir: {out:?}");
        assert_eq!(cs_of(&out[0]), 2000);
        assert_eq!(word_of(&out[0]), "Válida");
    }

    #[test]
    fn parse_lrc_no_panica_con_utf8_multibyte() {
        // El slicing por bytes de la implementación debe seguir siendo seguro
        // con texto multibyte alrededor del timestamp.
        let out = parse_lrc("[00:05.00] 日本語のテキスト ñ é");
        assert_eq!(out.len(), 1);
        assert_eq!(word_of(&out[0]), "日本語のテキスト ñ é");
    }

    #[test]
    fn parse_lrc_varias_lineas_en_orden() {
        let out = parse_lrc("[00:01.00] uno\n[00:02.00] dos");
        assert_eq!(out.len(), 2);
        assert_eq!(cs_of(&out[0]), 100);
        assert_eq!(cs_of(&out[1]), 200);
    }

    // ── LyricsError: cuerpos observables (línea base: get_lyrics_handler) ──

    #[test]
    fn lyrics_error_cuerpos_de_linea_base() {
        assert!(LyricsError::Db(sqlx::Error::RowNotFound)
            .to_string()
            .starts_with("DB Error: "));
        assert_eq!(
            LyricsError::NotFoundInDb.to_string(),
            "Track not found in database"
        );
        assert_eq!(
            LyricsError::CachedNegative.to_string(),
            "Lyrics not found (cached negative)"
        );
        assert_eq!(LyricsError::NotAvailable.to_string(), "Lyrics not available");
    }
}
