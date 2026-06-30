import sys
import re

def process():
    path = "tidol-core/src/main.rs"
    with open(path, "r") as f:
        content = f.read()

    # 1. Remove DynamicAIProvider struct and impls
    content = re.sub(r'// -{10,}\n// CARGADOR DINÁMICO FFI: MOTOR IA \(CUDA\)\n// -{10,}\nstruct DynamicAIProvider \{.*?\n\}\n', '', content, flags=re.DOTALL)
    
    # 2. Find ai_worker_loop block
    new_block = """            if requiere_ia_completa {
                let yt_id = sqlx::query_scalar::<_, Option<String>>(
                    "SELECT yt_video_id FROM track_links WHERE mbid = ?"
                )
                .bind(&job.trackId)
                .fetch_optional(&db)
                .await
                .unwrap_or(None)
                .flatten();
                
                let mut api_success = false;
                
                if let Some(yt) = yt_id {
                    let yt_url = format!("https://www.youtube.com/watch?v={}", yt);
                    let api_key = std::env::var("QUICKLRC_API_KEY").unwrap_or_default();
                    
                    let mut payload = serde_json::json!({
                        "fileUrl": yt_url,
                        "format": "srt",
                        "isWordLevel": true,
                        "smartSections": true
                    });
                    
                    if let Some(lyrics_text) = texto_plano.as_deref() {
                        payload.as_object_mut().unwrap().insert("lyrics".to_string(), serde_json::json!(lyrics_text));
                    }
                    
                    let client = reqwest::Client::new();
                    let resp = client.post("https://quicklrc.com/api/v1/transcribe")
                        .header("Authorization", format!("Bearer {}", api_key))
                        .json(&payload)
                        .send()
                        .await;
                        
                    if let Ok(res) = resp {
                        if res.status().is_success() {
                            if let Ok(srt_content) = res.text().await {
                                api_success = true;
                                
                                let mut words = Vec::new();
                                let blocks: Vec<&str> = srt_content.split("\\n\\n").collect();
                                for block in blocks {
                                    let lines: Vec<&str> = block.lines().collect();
                                    if lines.len() >= 3 {
                                        let times: Vec<&str> = lines[1].split(" --> ").collect();
                                        if times.len() == 2 {
                                            let start = parse_srt_time(times[0]);
                                            let end = parse_srt_time(times[1]);
                                            let text = clean_ai_text(&lines[2..].join(" "));
                                            words.push(serde_json::json!({
                                                "word": text,
                                                "start_cs": start,
                                                "end_cs": end
                                            }));
                                        }
                                    }
                                }
                                
                                let words_json_raw = serde_json::to_string(&words).unwrap_or_default();
                                let lrc_path = format!("{}/{}.srt", storage_path, job.trackId);
                                let _ = tokio::fs::write(&lrc_path, &srt_content).await;
                                
                                let _ = sqlx::query!(
                                    r#"
                                    UPDATE trackMetadata
                                    SET localLyricsPath = ?, hasLyrics = 1, structuredWordsJson = ?
                                    WHERE trackId = ?
                                    "#,
                                    lrc_path,
                                    words_json_raw,
                                    job.trackId
                                )
                                .execute(&db)
                                .await;

                                info!("[Worker IA] 💎 [{}] Letras inyectadas usando QuickLRC.", job.trackId);
                            }
                        }
                    }
                }
                
                if !api_success {
                    let _ = sqlx::query!(
                        "UPDATE audioProcessingQueue SET status = 'FAILED', errorMessage = 'QuickLRC falló o faltaba yt_video_id' WHERE taskId = ?",
                        job.taskId
                    )
                    .execute(&db)
                    .await;
                }
            }
"""

    pattern = r'if requiere_ia_completa \{ // Solo fallback si no hay NADA.*?let _ = sqlx::query!\(\s*"UPDATE audioProcessingQueue SET status = \'COMPLETED\''
    content = re.sub(pattern, new_block + '\n            let _ = sqlx::query!(\n                "UPDATE audioProcessingQueue SET status = \'COMPLETED\'', content, flags=re.DOTALL)
    
    # 3. Add parse_srt_time at the end of the file
    if "fn parse_srt_time" not in content:
        content += """
fn parse_srt_time(time_str: &str) -> i64 {
    let parts: Vec<&str> = time_str.split(',').collect();
    if parts.len() == 2 {
        let time_parts: Vec<&str> = parts[0].split(':').collect();
        if time_parts.len() == 3 {
            let h: i64 = time_parts[0].parse().unwrap_or(0);
            let m: i64 = time_parts[1].parse().unwrap_or(0);
            let s: i64 = time_parts[2].parse().unwrap_or(0);
            let ms: i64 = parts[1].parse().unwrap_or(0);
            return (h * 3600 + m * 60 + s) * 100 + ms / 10;
        }
    }
    0
}
"""
    with open(path, "w") as f:
        f.write(content)

if __name__ == "__main__":
    process()
