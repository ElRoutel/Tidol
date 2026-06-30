use sqlx::MySqlPool;
use crate::lyrics_fetcher::fetch_plain_lyrics;
use serde_json::json;

/// Bad Engine ahora SOLO obtiene letras planas vía LRCLIB (API pública,
/// gratuita y legal). El pipeline anterior ("YT-DLP -> FFMPEG -> Whisper
/// CUDA") descargaba el audio completo de YouTube a /tmp para transcribirlo;
/// esa descarga fue eliminada por completo de Tidol.
///
/// Si en el futuro se quiere reactivar alineación por IA (Whisper), debe
/// hacerse ÚNICAMENTE sobre audio proveniente de Internet Archive/Jamendo
/// (los providers FFI legales ya usados en `ai_worker_loop`), nunca sobre
/// audio descargado de YouTube/Spotify/SoundCloud.
pub async fn process_new_track(mbid: &str, artist: &str, title: &str, db_pool: &MySqlPool) -> Result<(), String> {
    println!("[Orchestrator] Buscando letra plana para: {} - {}", artist, title);

    let (json_response, status_type) = match fetch_plain_lyrics(artist, title).await {
        Ok(lyrics) => {
            println!("[Orchestrator] Letra oficial obtenida con éxito (LRCLIB).");
            (
                json!({
                    "status": "success",
                    "type": "plain",
                    "lyrics": lyrics
                })
                .to_string(),
                "plain",
            )
        }
        Err(e) => {
            println!("[Orchestrator] Fallo al obtener letra oficial: {}", e);
            (
                json!({
                    "status": "error",
                    "message": "No lyrics found"
                })
                .to_string(),
                "not_found",
            )
        }
    };

    sqlx::query(
        "UPDATE track_links SET lyrics_json = ?, status = 'synced', lyrics_status = ? WHERE mbid = ?"
    )
    .bind(&json_response)
    .bind(status_type)
    .bind(mbid)
    .execute(db_pool)
    .await
    .map_err(|e| format!("Error actualizando BD: {}", e))?;

    println!("[Orchestrator] Pista procesada y BD actualizada: {}", mbid);
    Ok(())
}
