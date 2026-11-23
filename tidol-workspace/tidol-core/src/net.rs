//! Utilidades de red compartidas por todo el core: un `reqwest::Client` único y
//! un cortacircuitos para iTunes.
//!
//! Por qué existe: `get_lyrics`, `get_cover` y `extract_colors` construían un
//! `reqwest::Client` NUEVO en cada petición. Cada cliente trae su propio pool de
//! conexiones, así que cada portada/letra pagaba DNS + TCP + TLS desde cero (y en
//! la cascada de portadas, hasta ~15 handshakes por mbid). Un cliente compartido
//! reutiliza conexiones keep-alive con coverartarchive.org, musicbrainz.org y
//! lrclib.net.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::OnceLock;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

/// User-Agent identificable: MusicBrainz y LRCLIB lo piden explícitamente.
pub(crate) const USER_AGENT: &str = "TidolMusic/0.2 (https://tidol.duckdns.org)";

static SHARED: OnceLock<reqwest::Client> = OnceLock::new();

/// Cliente HTTP compartido (timeout 8 s, connect 4 s, sigue redirecciones: Cover
/// Art Archive redirige a archive.org). Clonar un `reqwest::Client` es barato
/// (es un `Arc` interno) y comparte el pool de conexiones.
pub(crate) fn shared_client() -> &'static reqwest::Client {
    SHARED.get_or_init(|| {
        reqwest::Client::builder()
            .user_agent(USER_AGENT)
            .timeout(Duration::from_secs(8))
            .connect_timeout(Duration::from_secs(4))
            .pool_idle_timeout(Duration::from_secs(90))
            .build()
            .unwrap_or_default()
    })
}

// ── Cortacircuitos de iTunes ─────────────────────────────────────────────────
//
// iTunes Search está bloqueado desde la IP del VPS: cada llamada esperaba el
// timeout completo (4-8 s). Como `resolve_full_track` lo consulta para toda pista
// sin portada, la Home (recomendaciones) y la búsqueda (portadas de artista)
// tardaban varios segundos de más en CADA carga. En local iTunes sí responde, así
// que en lugar de quitarlo lo "abrimos" automáticamente tras un fallo y no se
// vuelve a intentar hasta pasado `ITUNES_COOLDOWN`.
// `ITUNES_ENABLED=false` (o `0`) lo desactiva del todo (recomendado en prod).

const ITUNES_COOLDOWN: Duration = Duration::from_secs(10 * 60);

/// Instante (ms desde epoch) hasta el que iTunes se considera caído. 0 = cerrado.
static ITUNES_OPEN_UNTIL_MS: AtomicU64 = AtomicU64::new(0);
static ITUNES_ENABLED: OnceLock<bool> = OnceLock::new();

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn itunes_enabled_by_env() -> bool {
    *ITUNES_ENABLED.get_or_init(|| {
        !matches!(
            std::env::var("ITUNES_ENABLED")
                .unwrap_or_default()
                .trim()
                .to_ascii_lowercase()
                .as_str(),
            "false" | "0" | "no" | "off"
        )
    })
}

/// ¿Merece la pena llamar a iTunes ahora mismo?
pub(crate) fn itunes_available() -> bool {
    itunes_enabled_by_env() && now_ms() >= ITUNES_OPEN_UNTIL_MS.load(Ordering::Relaxed)
}

/// Registra un fallo de transporte o un status de bloqueo (403/429/5xx): abre el
/// circuito durante `ITUNES_COOLDOWN`.
pub(crate) fn itunes_report_failure() {
    let until = now_ms() + ITUNES_COOLDOWN.as_millis() as u64;
    let prev = ITUNES_OPEN_UNTIL_MS.swap(until, Ordering::Relaxed);
    if prev < now_ms() {
        tracing::warn!(
            "[iTunes] sin respuesta válida; se omite durante {} min",
            ITUNES_COOLDOWN.as_secs() / 60
        );
    }
}

/// ¿Este status indica que iTunes nos está rechazando (y no un simple "sin resultados")?
pub(crate) fn itunes_status_is_failure(status: reqwest::StatusCode) -> bool {
    status == reqwest::StatusCode::FORBIDDEN
        || status == reqwest::StatusCode::TOO_MANY_REQUESTS
        || status.is_server_error()
}

// ── Limitador común de MusicBrainz ───────────────────────────────────────────
//
// MusicBrainz admite de media 1 petición/s por IP y responde 503 ("server is
// currently busy") al pasarse. `musicbrainz_rs` tiene su propia cola, pero la
// mayoría de llamadas del core van DIRECTAS a la API JSON (búsqueda, álbumes,
// discografías, la cascada de portadas, la resolución de similares) y ninguna se
// coordinaba: una página de búsqueda con 20 portadas sin caché disparaba ~20
// peticiones a la vez, MB devolvía 503 a casi todas, las portadas quedaban como
// "miss" 30 min y la búsqueda siguiente salía VACÍA (el 503 se leía como 0
// resultados).
//
// Cubo de fichas compartido por todo el proceso (ritmo 1/s, ráfaga 3) con dos
// prioridades: el trabajo de fondo (portadas, similares, hidratación) solo gasta
// una ficha si quedan al menos 2, así siempre hay una libre para lo interactivo
// (búsqueda, artista, álbum), que no se queda detrás de una ráfaga de portadas.
// Es por réplica: con N réplicas el total es N req/s (ver docs-agentes/12).

/// Prioridad de una petición a MusicBrainz.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum MbPriority {
    /// El usuario espera la respuesta (búsqueda, perfil de artista, álbum).
    Interactive,
    /// Puede esperar o fallar sin que nadie lo note (portadas, similares, hidratación).
    Background,
}

const MB_RATE_PER_SEC: f64 = 1.0;
const MB_BURST: f64 = 3.0;
/// Reintentos ante 503/429 (además del intento inicial), cada uno pasando de
/// nuevo por el limitador.
const MB_RETRIES: u32 = 2;

struct Bucket {
    tokens: f64,
    last: tokio::time::Instant,
}

static MB_BUCKET: OnceLock<tokio::sync::Mutex<Bucket>> = OnceLock::new();

/// Fichas que deben quedar disponibles para que una prioridad pueda gastar una.
fn mb_threshold(p: MbPriority) -> f64 {
    match p {
        MbPriority::Interactive => 1.0,
        MbPriority::Background => 2.0,
    }
}

/// Espera hasta poder hacer una petición a MusicBrainz con la prioridad dada.
///
/// Dos niveles: el cubo local (prioridades dentro de la réplica) y, si hay
/// Redis, una ventana por segundo compartida por TODAS las réplicas. MB limita
/// por IP: con 3 réplicas y solo el cubo local, el total llegaba a 3 req/s.
pub(crate) async fn mb_acquire(priority: MbPriority) {
    mb_acquire_local(priority).await;
    mb_acquire_global(priority).await;
}

/// Peticiones por segundo admitidas en TODO el despliegue según prioridad:
/// el fondo solo entra si en este segundo no ha salido ninguna; lo interactivo
/// admite una segunda (misma idea que los umbrales del cubo local).
fn mb_global_max(p: MbPriority) -> u32 {
    match p {
        MbPriority::Interactive => 2,
        MbPriority::Background => 1,
    }
}

/// Espera máxima en la ventana global: nunca se cuelga una petición por el
/// limitador; pasado esto se envía igual (MB puede responder 503 y `mb_get`
/// reintenta).
const MB_GLOBAL_MAX_WAIT: Duration = Duration::from_secs(10);

async fn mb_acquire_global(priority: MbPriority) {
    let max = mb_global_max(priority);
    let deadline = tokio::time::Instant::now() + MB_GLOBAL_MAX_WAIT;
    loop {
        let now = now_ms();
        let window = now / 1000;
        let key = crate::cache::key("mb:rl", &window.to_string());
        match crate::cache::window_admit(&key, max, Duration::from_secs(2)).await {
            // Sin Redis: solo el límite local (comportamiento de una réplica).
            None | Some(true) => return,
            Some(false) => {}
        }
        if tokio::time::Instant::now() >= deadline {
            tracing::debug!(
                "[MusicBrainz] ventana global llena tras {:?}; se envía igual",
                MB_GLOBAL_MAX_WAIT
            );
            return;
        }
        // Dormir hasta el siguiente segundo, con un desfase pseudoaleatorio
        // (0-90 ms) para que las réplicas no despierten todas a la vez.
        let jitter = (now % 7) * 13;
        let until_next = 1000 - (now % 1000) + jitter;
        tokio::time::sleep(Duration::from_millis(until_next)).await;
    }
}

/// Cubo de fichas local (por proceso) con prioridades.
async fn mb_acquire_local(priority: MbPriority) {
    let bucket = MB_BUCKET.get_or_init(|| {
        tokio::sync::Mutex::new(Bucket {
            tokens: MB_BURST,
            last: tokio::time::Instant::now(),
        })
    });
    let threshold = mb_threshold(priority);
    loop {
        let wait = {
            let mut b = bucket.lock().await;
            let now = tokio::time::Instant::now();
            let elapsed = now.duration_since(b.last).as_secs_f64();
            b.tokens = (b.tokens + elapsed * MB_RATE_PER_SEC).min(MB_BURST);
            b.last = now;
            if b.tokens >= threshold {
                b.tokens -= 1.0;
                return;
            }
            Duration::from_secs_f64((threshold - b.tokens) / MB_RATE_PER_SEC)
        };
        // Se suelta el candado antes de dormir; al despertar se vuelve a comprobar
        // (otro puede haberse llevado la ficha).
        tokio::time::sleep(wait).await;
    }
}

/// GET a MusicBrainz pasando por el limitador, con reintento ante 503/429.
/// Devuelve la última respuesta (que puede seguir siendo 503: el llamador decide).
pub(crate) async fn mb_get(
    client: &reqwest::Client,
    url: &str,
    priority: MbPriority,
) -> Result<reqwest::Response, reqwest::Error> {
    let mut attempt = 0;
    loop {
        mb_acquire(priority).await;
        let res = client
            .get(url)
            .header("User-Agent", "TidolCore/1.0 (contact@tidol.duckdns.org)")
            .send()
            .await?;
        let status = res.status();
        let throttled = status == reqwest::StatusCode::SERVICE_UNAVAILABLE
            || status == reqwest::StatusCode::TOO_MANY_REQUESTS;
        if !throttled || attempt >= MB_RETRIES {
            if throttled {
                tracing::warn!(
                    "[MusicBrainz] {} tras {} reintentos: {}",
                    status,
                    attempt,
                    url
                );
            }
            return Ok(res);
        }
        attempt += 1;
        // Retroceso extra además del limitador: si MB está saturado, insistir al
        // ritmo normal solo alarga el 503.
        tokio::time::sleep(Duration::from_millis(1000 * attempt as u64)).await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test(start_paused = true)]
    async fn limitador_mb_respeta_ritmo_y_prioridad() {
        let t0 = tokio::time::Instant::now();
        // Ráfaga: 3 fichas → 3 interactivas inmediatas.
        for _ in 0..3 {
            mb_acquire(MbPriority::Interactive).await;
        }
        assert!(t0.elapsed() < Duration::from_millis(10));
        // La 4ª espera ~1 s (ritmo 1/s).
        mb_acquire(MbPriority::Interactive).await;
        let e = t0.elapsed();
        assert!(
            e >= Duration::from_millis(990) && e < Duration::from_millis(1100),
            "{e:?}"
        );
        // Fondo con el cubo vacío necesita 2 fichas acumuladas (~2 s).
        let t1 = tokio::time::Instant::now();
        mb_acquire(MbPriority::Background).await;
        let e = t1.elapsed();
        assert!(
            e >= Duration::from_millis(1990) && e < Duration::from_millis(2100),
            "{e:?}"
        );
        // …y deja 1 ficha: una interactiva justo después pasa sin esperar.
        let t2 = tokio::time::Instant::now();
        mb_acquire(MbPriority::Interactive).await;
        assert!(t2.elapsed() < Duration::from_millis(10));
    }

    #[test]
    fn cortacircuitos_se_abre_tras_fallo() {
        // El estado es global: este es el único test que lo toca.
        ITUNES_OPEN_UNTIL_MS.store(0, Ordering::Relaxed);
        let enabled = itunes_enabled_by_env();
        assert_eq!(itunes_available(), enabled);
        itunes_report_failure();
        assert!(!itunes_available());
        ITUNES_OPEN_UNTIL_MS.store(0, Ordering::Relaxed);
    }

    #[test]
    fn status_de_bloqueo() {
        assert!(itunes_status_is_failure(reqwest::StatusCode::FORBIDDEN));
        assert!(itunes_status_is_failure(
            reqwest::StatusCode::SERVICE_UNAVAILABLE
        ));
        assert!(!itunes_status_is_failure(reqwest::StatusCode::OK));
        assert!(!itunes_status_is_failure(reqwest::StatusCode::NOT_FOUND));
    }
}
