mod lyrics_fetcher;
mod orchestrator;

use sqlx::mysql::MySqlPoolOptions;
use std::env;
use std::time::Duration;

// structs eliminados

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 1. Inicialización de Logs
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt::init();
    tracing::info!("=== Bad Engine Worker ===");

    // 2. Variables de entorno (Evitando valores quemados en producción para DB)
    let mbid = env::var("TARGET_MBID")
        .unwrap_or_else(|_| "1cea9ff0-7dba-4908-86e4-75453cef2513".to_string());
    let artist = env::var("TARGET_ARTIST")
        .unwrap_or_else(|_| "Canserbero".to_string());
    let title = env::var("TARGET_TITLE")
        .unwrap_or_else(|_| "De la Vida Como Pelicula".to_string());

    tracing::info!("[BadEngine] Target: {} - {} (mbid: {})", artist, title, mbid);

    // [SEGURIDAD] NUNCA uses un fallback hardcodeado para la base de datos con contraseñas reales.
    // Usamos `expect` para forzar a que el entorno esté correctamente configurado. 
    // Te sugiero usar la caja `dotenvy` si necesitas cargarlo desde un .env en local.
    let db_url = env::var("DATABASE_URL")
        .expect("ERROR CRÍTICO: La variable DATABASE_URL no está configurada.");

    // 3. Configuración del Pool de Conexiones
    let pool = MySqlPoolOptions::new()
        .max_connections(5) // Limita las conexiones simultáneas para no saturar MariaDB
        .acquire_timeout(Duration::from_secs(3)) // Falla rápido si la DB está caída
        .idle_timeout(Duration::from_secs(600))  // Limpia conexiones inactivas
        .connect(&db_url)
        .await?;
        
    tracing::info!("[BadEngine] Conexión a MariaDB establecida exitosamente.");

    // 4. Guard: Comprobar si el track ya fue procesado
    // query_scalar con Option<String> para manejar columnas NULL sin panic.
    // fetch_optional devuelve Option<Option<String>>: None = no hay fila, Some(None) = fila con NULL.
    let existing_lyrics: Option<Option<String>> = sqlx::query_scalar(
        "SELECT lyrics_json FROM track_links WHERE mbid = ? LIMIT 1"
    )
    .bind(&mbid)
    .fetch_optional(&pool)
    .await?;

    if let Some(Some(ref json)) = existing_lyrics {
        if !json.trim().is_empty() {
            tracing::info!("[BadEngine] Track ya fue procesado (lyrics_json presente). Saliendo.");
            return Ok(());
        }
    }

    // 5. Ejecutar el pipeline (solo letras planas, 100% legal)
    tracing::info!("[BadEngine] Iniciando pipeline: LRCLIB (letras planas) -> DB");
    
    match orchestrator::process_new_track(&mbid, &artist, &title, &pool).await {
        Ok(_) => {
            tracing::info!("[BadEngine] Pipeline completado con éxito para: {}", mbid);
            
            // Opcional: Solo hacer esta consulta si realmente necesitas auditar el tamaño del JSON.
            // Si el orchestrator es confiable, podrías omitir este SELECT redundante para ahorrar I/O.
            if let Ok(Some(Some(json_str))) = sqlx::query_scalar::<_, Option<String>>(
                "SELECT lyrics_json FROM track_links WHERE mbid = ? LIMIT 1"
            )
            .bind(&mbid)
            .fetch_optional(&pool)
            .await 
            {
                tracing::info!(bytes = json_str.len(), "Verificación OK: lyrics_json guardado.");
            } else {
                tracing::warn!("Pipeline indicó éxito, pero lyrics_json sigue vacío o no se pudo leer.");
            }
        },
        Err(e) => {
            tracing::error!("[BadEngine] ERROR CRÍTICO :C : {}", e);
            
            // Mejor práctica: No ignorar el error del fallback (`let _ = ...`). 
            // Si la DB falla aquí, tienes un problema de infraestructura que debes saber.
            if let Err(db_err) = sqlx::query("UPDATE track_links SET status = 'failed' WHERE mbid = ?")
                .bind(&mbid)
                .execute(&pool)
                .await 
            {
                tracing::error!("[BadEngine] FALLO FATAL: No se pudo actualizar el estado a 'failed': {}", db_err);
            }
            
            return Err(e.into());
        }
    }

    tracing::info!("=== Bad Engine Worker Finalizado ===");
    Ok(())
}
