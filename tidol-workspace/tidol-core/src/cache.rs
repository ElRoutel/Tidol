//! Caché compartida entre réplicas (Redis), como segundo nivel detrás de las
//! cachés en memoria (`moka`) de cada proceso.
//!
//! Por qué existe: en producción hay 3 réplicas (`TIDOL_REPLICAS=3`) tras Caddy
//! con `least_conn`, y TODAS las cachés vivían en memoria por réplica. Para la
//! búsqueda de YouTube eso es caro de verdad: `search.list` cuesta 100 unidades
//! de una cuota de 10 000/día (≈100 búsquedas), y la misma canción podía gastar
//! hasta 3 búsquedas (una por réplica), más otra tras cada reinicio o deploy.
//! Redis estaba levantado en compose con `REDIS_URL` desde hace meses, pero
//! ningún código lo leía.
//!
//! Reglas de diseño (Redis NUNCA debe romper ni ralentizar una petición):
//! - Sin `REDIS_URL` → desactivada; todo funciona solo con memoria (desarrollo).
//! - Si Redis no responde al arrancar, se reintenta en segundo plano y se empieza
//!   a usar en cuanto conecta (no hace falta reiniciar el backend).
//! - Cada operación tiene un timeout corto (`OP_TIMEOUT`); un error o timeout
//!   abre un cortacircuitos `COOLDOWN` y mientras tanto ni se intenta.
//! - Cualquier fallo = "no está en caché": el llamador sigue con su fuente real.
//! - Claves versionadas (`tidol:v1:<espacio>:<clave>`): si cambia el formato de
//!   un valor, se sube la versión y las entradas viejas caducan solas.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::OnceLock;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use redis::aio::{ConnectionManager, ConnectionManagerConfig};
use redis::AsyncCommands;
use serde::de::DeserializeOwned;
use serde::Serialize;

/// Prefijo y versión del formato de las claves.
const KEY_PREFIX: &str = "tidol:v1";
/// Una operación de caché lenta es peor que un fallo de caché: se corta aquí.
const OP_TIMEOUT: Duration = Duration::from_millis(250);
/// Tras un error, no se vuelve a intentar durante este tiempo.
const COOLDOWN: Duration = Duration::from_secs(30);
/// Reintento de conexión inicial si Redis aún no está disponible.
const CONNECT_RETRY: Duration = Duration::from_secs(15);
/// Claves más largas se resumen con SHA-256 (las consultas de usuario pueden ser
/// largas; Redis las admite, pero no queremos claves de KB).
const MAX_RAW_KEY: usize = 200;

static CONN: OnceLock<ConnectionManager> = OnceLock::new();
static OPEN_UNTIL_MS: AtomicU64 = AtomicU64::new(0);

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Arranca la conexión (no bloquea): si `url` es `None`, la caché queda desactivada.
pub(crate) fn init(url: Option<String>) {
    let Some(url) = url else {
        tracing::info!("[Cache] REDIS_URL no definida: solo cachés en memoria por proceso");
        return;
    };
    let client = match redis::Client::open(url.as_str()) {
        Ok(c) => c,
        Err(e) => {
            tracing::warn!("[Cache] REDIS_URL inválida ({e}); caché compartida desactivada");
            return;
        }
    };
    tokio::spawn(async move {
        let config = ConnectionManagerConfig::new()
            .set_connection_timeout(Duration::from_secs(2))
            .set_response_timeout(OP_TIMEOUT)
            .set_number_of_retries(2);
        let mut warned = false;
        loop {
            match ConnectionManager::new_with_config(client.clone(), config.clone()).await {
                Ok(conn) => {
                    let _ = CONN.set(conn);
                    tracing::info!(
                        "[Cache] Redis conectado: caché compartida entre réplicas activa"
                    );
                    return;
                }
                Err(e) => {
                    if !warned {
                        tracing::warn!(
                            "[Cache] Redis no disponible ({e}); se reintenta cada {} s",
                            CONNECT_RETRY.as_secs()
                        );
                        warned = true;
                    }
                    tokio::time::sleep(CONNECT_RETRY).await;
                }
            }
        }
    });
}

/// Conexión utilizable ahora mismo (conectada y con el cortacircuitos cerrado).
fn conn() -> Option<ConnectionManager> {
    if now_ms() < OPEN_UNTIL_MS.load(Ordering::Relaxed) {
        return None;
    }
    CONN.get().cloned()
}

fn trip(op: &str, err: &dyn std::fmt::Display) {
    let prev = OPEN_UNTIL_MS.swap(now_ms() + COOLDOWN.as_millis() as u64, Ordering::Relaxed);
    if prev < now_ms() {
        tracing::warn!(
            "[Cache] Redis falló en {op} ({err}); se omite {} s",
            COOLDOWN.as_secs()
        );
    }
}

/// Clave final: `tidol:v1:<espacio>:<clave>` (resumida si es muy larga).
pub(crate) fn key(namespace: &str, raw: &str) -> String {
    if raw.len() <= MAX_RAW_KEY {
        format!("{KEY_PREFIX}:{namespace}:{raw}")
    } else {
        use sha2::Digest;
        let digest = sha2::Sha256::digest(raw.as_bytes());
        let hex: String = digest.iter().map(|b| format!("{:02x}", b)).collect();
        format!("{KEY_PREFIX}:{namespace}:h:{hex}")
    }
}

/// Ejecuta una operación con timeout y cortacircuitos.
///
/// Ante un error de CONEXIÓN (tubería rota, conexión caída o rechazada) se
/// reintenta una vez: `ConnectionManager` ya ha reconectado al detectar el fallo.
/// Antes el primer error tras un reinicio de Redis abría el cortacircuitos 30 s
/// aunque la reconexión hubiera funcionado al instante (verificado con
/// `CLIENT KILL`: esa petición y las de los 30 s siguientes se recalculaban sin
/// caché). Un timeout (Redis colgado) sí abre el cortacircuitos directamente:
/// reintentar solo duplicaría la espera.
async fn run<T, F, Fut>(op: &str, f: F) -> Option<T>
where
    F: Fn(ConnectionManager) -> Fut,
    Fut: std::future::Future<Output = redis::RedisResult<T>>,
{
    let c = conn()?;
    for attempt in 0..2 {
        match tokio::time::timeout(OP_TIMEOUT, f(c.clone())).await {
            Ok(Ok(v)) => return Some(v),
            Ok(Err(e))
                // `is_timeout` se excluye: el `response_timeout` del manager
                // llega como error de E/S "timed out" y reintentarlo duplicaba la
                // espera con Redis colgado (medido: 0,59 s en vez de 0,32 s).
                if attempt == 0
                    && !e.is_timeout()
                    && (e.is_connection_dropped()
                        || e.is_io_error()
                        || e.is_connection_refusal()) =>
            {
                tracing::debug!("[Cache] {op}: conexión perdida ({e}); reintento tras reconectar");
            }
            Ok(Err(e)) => {
                trip(op, &e);
                return None;
            }
            Err(_) => {
                trip(op, &"timeout");
                return None;
            }
        }
    }
    None
}

/// Lee un valor JSON. `None` = no está, Redis desactivado/caído o valor ilegible.
pub(crate) async fn get_json<T: DeserializeOwned>(key: &str) -> Option<T> {
    let raw = run("GET", |mut c| async move {
        c.get::<_, Option<String>>(key).await
    })
    .await??;
    match serde_json::from_str(&raw) {
        Ok(v) => Some(v),
        Err(e) => {
            // Formato viejo o corrupto: se ignora (y se sobrescribirá).
            tracing::debug!("[Cache] valor ilegible en {key}: {e}");
            None
        }
    }
}

/// Guarda un valor JSON con caducidad. Los fallos se ignoran (best effort).
pub(crate) async fn set_json<T: Serialize>(key: &str, value: &T, ttl: Duration) {
    let Ok(raw) = serde_json::to_string(value) else {
        return;
    };
    let raw = raw.as_str();
    let secs = ttl.as_secs().max(1);
    let _ = run("SET", |mut c| async move {
        c.set_ex::<_, _, ()>(key, raw, secs).await
    })
    .await;
}

/// Ventana fija compartida: admite como mucho `max` operaciones por clave de
/// ventana (atómico vía Lua: comprobar y contar en un solo paso, así dos réplicas
/// no pueden colarse a la vez). `None` = Redis no disponible (el llamador decide).
pub(crate) async fn window_admit(key: &str, max: u32, ttl: Duration) -> Option<bool> {
    static SCRIPT: OnceLock<redis::Script> = OnceLock::new();
    let script = SCRIPT.get_or_init(|| {
        redis::Script::new(
            r"local c = tonumber(redis.call('GET', KEYS[1]) or '0')
              if c < tonumber(ARGV[1]) then
                redis.call('INCR', KEYS[1])
                redis.call('PEXPIRE', KEYS[1], ARGV[2])
                return 1
              end
              return 0",
        )
    });
    let ttl_ms = ttl.as_millis() as u64;
    let admitted = run("EVALSHA", |mut c| async move {
        let mut invocation = script.key(key);
        invocation.arg(max).arg(ttl_ms);
        invocation.invoke_async::<i32>(&mut c).await
    })
    .await?;
    Some(admitted == 1)
}

/// ¿Está la caché compartida activa? (para logs y diagnóstico).
pub fn is_connected() -> bool {
    CONN.get().is_some()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn claves_versionadas_y_resumidas() {
        assert_eq!(
            key("yt:search", "soda stereo:5"),
            "tidol:v1:yt:search:soda stereo:5"
        );
        let larga = "x".repeat(500);
        let k = key("yt:search", &larga);
        assert!(k.starts_with("tidol:v1:yt:search:h:"));
        assert_eq!(k.len(), "tidol:v1:yt:search:h:".len() + 64);
        // Determinista: la misma consulta da la misma clave en todas las réplicas.
        assert_eq!(k, key("yt:search", &larga));
    }

    #[tokio::test]
    async fn sin_redis_todo_es_un_fallo_de_cache() {
        // Sin init(): get devuelve None y set no hace nada (ni paniquea).
        assert!(get_json::<String>("tidol:v1:test:nada").await.is_none());
        set_json("tidol:v1:test:nada", &"valor", Duration::from_secs(5)).await;
        assert!(!is_connected());
    }
}
