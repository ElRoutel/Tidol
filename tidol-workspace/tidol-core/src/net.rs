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

#[cfg(test)]
mod tests {
    use super::*;

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
