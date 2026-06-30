import re

with open("tidol-core/src/main.rs", "r") as f:
    content = f.read()

# 1. Add mod models
content = content.replace("mod provider;", "mod models;\nmod provider;")

# 2. Add broadcast
content = content.replace("use tokio::{net::TcpListener, sync::mpsc};", "use tokio::{net::TcpListener, sync::{mpsc, broadcast}};")

# 3. Add progress_tx to AppState
content = content.replace("ai_provider: Arc<Option<DynamicAIProvider>>,\n}", "ai_provider: Arc<Option<DynamicAIProvider>>,\n    progress_tx: broadcast::Sender<models::WorkerEvent>,\n}")

# 4. Search Handler replacement
old_search = """    let canonical_hit = match confidence_res {
        Ok(Ok(Some(row))) => {
            let track_clicks = row.track_clicks.unwrap_or(0) as f64;
            let total_clicks = row.total_clicks.unwrap_or(1) as f64;
            let confidence = if total_clicks > 0.0 {
                track_clicks / total_clicks
            } else {
                0.0
            };

            if confidence >= 0.5 {
                serde_json::json!({
                    "trackId": row.track_id,
                    "trackName": row.track_name,
                    "artistName": row.artist_name,
                    "coverArtUrl": row.cover_art_url,
                    "sourceLink": row.source_link,
                    "confidence": confidence,
                    "hasLyrics": row.has_lyrics == Some(1),
                    "isCached": row.is_cached == Some(1)
                })
            } else {
                serde_json::Value::Null
            }
        }
        _ => serde_json::Value::Null,
    };

    let local_rows = local_res.unwrap_or(Ok(Vec::new())).unwrap_or_default();
    let archive_rows = external_res.unwrap_or_default();

    Json(serde_json::json!({
        "status": "success",
        "query": query,
        "canonicalHit": canonical_hit,
        "local": {
            "canciones": local_rows.iter().map(|r| serde_json::json!({
                "trackId": r.trackId,
                "trackName": r.trackName,
                "artistName": r.artistName,
                "coverArtUrl": r.coverArtUrl,
                "hasLyrics": r.hasLyrics == Some(1),
                "isCached": r.isCached == Some(1)
            })).collect::<Vec<_>>(),
            "albums": [],
            "artists": []
        },
        "archive": archive_rows
    }))"""

new_search = """    let canonical_hit = match confidence_res {
        Ok(Ok(Some(row))) => {
            let track_clicks = row.track_clicks.unwrap_or(0) as f64;
            let total_clicks = row.total_clicks.unwrap_or(1) as f64;
            let confidence = if total_clicks > 0.0 {
                track_clicks / total_clicks
            } else {
                0.0
            };

            if confidence >= 0.5 {
                Some(models::CanonicalHit {
                    track_id: row.track_id,
                    track_name: row.track_name,
                    artist_name: row.artist_name,
                    cover_art_url: row.cover_art_url,
                    source_link: row.source_link,
                    confidence,
                    has_lyrics: row.has_lyrics == Some(1),
                    is_cached: row.is_cached == Some(1)
                })
            } else {
                None
            }
        }
        _ => None,
    };

    let local_rows = local_res.unwrap_or(Ok(Vec::new())).unwrap_or_default();
    let archive_rows = external_res.unwrap_or_default();

    Json(serde_json::json!(models::SearchResponse {
        status: "success".to_string(),
        query,
        canonical_hit,
        local: models::LocalSearchSection {
            canciones: local_rows.into_iter().map(|r| models::LocalTrack {
                track_id: r.trackId,
                track_name: r.trackName,
                artist_name: r.artistName,
                cover_art_url: r.coverArtUrl,
                has_lyrics: r.hasLyrics == Some(1),
                is_cached: r.isCached == Some(1)
            }).collect(),
            albums: vec![],
            artists: vec![]
        },
        archive: archive_rows
    }))"""
content = content.replace(old_search, new_search)

# 5. ai_worker_loop replacement
content = content.replace(
"""async fn ai_worker_loop(
    db: MySqlPool,
    providers: Arc<Vec<DynamicProvider>>,
    lyrics_engine: Arc<Option<DynamicLyricsProvider>>,
    ai_engine: Arc<Option<DynamicAIProvider>>,
) {""",
"""async fn ai_worker_loop(
    db: MySqlPool,
    providers: Arc<Vec<DynamicProvider>>,
    lyrics_engine: Arc<Option<DynamicLyricsProvider>>,
    ai_engine: Arc<Option<DynamicAIProvider>>,
    progress_tx: broadcast::Sender<models::WorkerEvent>,
) {""")

# We use regex to replace all execute(&db).await where it updates audioProcessingQueue with a broadcast
def replace_update(m):
    original = m.group(0)
    # Extract status, progress, error (if any) to broadcast
    status_match = re.search(r"status = '([^']+)'", original)
    progress_match = re.search(r"progress = (\d+)", original)
    err_match = re.search(r"errorMessage = \?", original)
    
    status = status_match.group(1) if status_match else "UNKNOWN"
    progress = progress_match.group(1) if progress_match else "0"
    
    if err_match:
        # err_msg variable might be used. We can parse it by finding the variable after the query
        # But wait, it's easier to just insert `let _ = progress_tx.send(...)`
        return original + f"""\n                    let _ = progress_tx.send(models::WorkerEvent {{
                        track_id: job.trackId.clone(),
                        status: "{status}".to_string(),
                        progress: {progress},
                        error: Some("Error reportado".to_string()),
                    }});"""
    else:
        return original + f"""\n                    let _ = progress_tx.send(models::WorkerEvent {{
                        track_id: job.trackId.clone(),
                        status: "{status}".to_string(),
                        progress: {progress},
                        error: None,
                    }});"""

content = re.sub(r'let _ = sqlx::query!\([^)]*audioProcessingQueue[^;]*\n\s*\.execute\(&db\)\n\s*\.await;', replace_update, content)

# But wait, wait! 
# Let's write the Queue Status Handler explicitly:
old_sse = """async fn queue_status_handler(
    State(state): State<AppState>,
    Path(track_id): Path<String>,
) -> Sse<impl tokio_stream::Stream<Item = Result<Event, Infallible>>> {
    let (tx, rx) = mpsc::channel(10);
    let db = state.db.clone();

    tokio::spawn(async move {
        loop {
            let job = sqlx::query!(
                "SELECT status, progress, errorMessage FROM audioProcessingQueue WHERE trackId = ?",
                track_id
            )
            .fetch_optional(&db)
            .await
            .unwrap_or(None);

            if let Some(j) = job {
                let json = serde_json::json!({
                    "status": j.status,
                    "progress": j.progress,
                    "error": j.errorMessage
                });

                if tx.send(Ok(Event::default().data(json.to_string()))).await.is_err() {
                    break;
                }

                if j.status.as_deref() == Some("COMPLETED")
                    || j.status.as_deref() == Some("FAILED")
                {
                    break;
                }
            } else {
                let _ = tx
                    .send(Ok(Event::default().data(r#"{"status":"NOT_FOUND"}"#)))
                    .await;
                break;
            }

            tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
        }
    });

    Sse::new(ReceiverStream::new(rx))
}"""

new_sse = """async fn queue_status_handler(
    State(state): State<AppState>,
    Path(track_id): Path<String>,
) -> Sse<impl tokio_stream::Stream<Item = Result<Event, Infallible>>> {
    let (tx, rx) = mpsc::channel(10);
    let mut bcast_rx = state.progress_tx.subscribe();
    let db = state.db.clone();
    let track_id_clone = track_id.clone();

    tokio::spawn(async move {
        let initial_job = sqlx::query!(
            "SELECT status, progress, errorMessage FROM audioProcessingQueue WHERE trackId = ?",
            track_id_clone
        )
        .fetch_optional(&db)
        .await
        .unwrap_or(None);

        if let Some(j) = initial_job {
            let json = serde_json::json!({
                "status": j.status,
                "progress": j.progress,
                "error": j.errorMessage
            });
            if tx.send(Ok(Event::default().data(json.to_string()))).await.is_err() {
                return;
            }

            if j.status.as_deref() == Some("COMPLETED") || j.status.as_deref() == Some("FAILED") {
                return;
            }
        } else {
            let _ = tx.send(Ok(Event::default().data(r#"{"status":"NOT_FOUND"}"#))).await;
            return;
        }

        while let Ok(event) = bcast_rx.recv().await {
            if event.track_id == track_id_clone {
                let json = serde_json::json!({
                    "status": event.status,
                    "progress": event.progress,
                    "error": event.error
                });
                if tx.send(Ok(Event::default().data(json.to_string()))).await.is_err() {
                    break;
                }
                if event.status == "COMPLETED" || event.status == "FAILED" {
                    break;
                }
            }
        }
    });

    Sse::new(ReceiverStream::new(rx))
}"""
content = content.replace(old_sse, new_sse)

old_init = """    let app_state = AppState {
        providers: Arc::new(providers),
        db: pool,
        rotator,
        lyrics_provider: Arc::new(lyrics_provider),
        ai_provider: Arc::new(ai_provider),
    };

    let db_for_worker = app_state.db.clone();
    let providers_for_worker = app_state.providers.clone();
    let lyrics_for_worker = app_state.lyrics_provider.clone();
    let ai_for_worker = app_state.ai_provider.clone();

    tokio::spawn(async move {
        ai_worker_loop(
            db_for_worker,
            providers_for_worker,
            lyrics_for_worker,
            ai_for_worker,
        )
        .await;
    });"""

new_init = """    let (progress_tx, _) = broadcast::channel(100);

    let app_state = AppState {
        providers: Arc::new(providers),
        db: pool,
        rotator,
        lyrics_provider: Arc::new(lyrics_provider),
        ai_provider: Arc::new(ai_provider),
        progress_tx: progress_tx.clone(),
    };

    let db_for_worker = app_state.db.clone();
    let providers_for_worker = app_state.providers.clone();
    let lyrics_for_worker = app_state.lyrics_provider.clone();
    let ai_for_worker = app_state.ai_provider.clone();
    let progress_tx_for_worker = app_state.progress_tx.clone();

    tokio::spawn(async move {
        ai_worker_loop(
            db_for_worker,
            providers_for_worker,
            lyrics_for_worker,
            ai_for_worker,
            progress_tx_for_worker,
        )
        .await;
    });"""
content = content.replace(old_init, new_init)

with open("tidol-core/src/main.rs", "w") as f:
    f.write(content)

print("Replaced successfully!")
