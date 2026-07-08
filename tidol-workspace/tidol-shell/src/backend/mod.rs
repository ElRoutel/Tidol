//! Superficie de dominio del REPL como *traits*, desacoplada de la
//! implementación concreta (local sobre `tidol-core`, o remota sobre HTTP).
//!
//! - [`TidolBackend`]: operaciones que **ambos** modos soportan. Se usa siempre
//!   como `Box<dyn TidolBackend>`, por lo que debe ser *object-safe*.
//! - [`LocalAdmin`]: operaciones **solo-local** y potencialmente destructivas.
//!   Solo `LocalBackend` la implementa; `RemoteBackend` **jamás**. Esto hace que
//!   la imposibilidad de borrar en prod sea estructural (garantizada por tipos),
//!   no un `if` que se pueda olvidar.

use std::path::Path;
use std::time::Duration;

use async_trait::async_trait;

use crate::error::BackendResult;

pub mod local;
pub mod remote;

// ── Tipos de dominio REALES de tidol-core, reexportados para el REPL ──
// (viven en `tidol_core::models`; derivan Serialize/Deserialize, por lo que el
// RemoteBackend los deserializa directamente de las respuestas HTTP).
pub use tidol_core::models::{AlbumResponse, ArtistResponse, SearchResponse, TrackMetadataResponse};

/// Modo de ejecución del REPL. Determina el color del prompt y qué backend
/// está activo.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Mode {
    Local,
    Prod,
}

impl Mode {
    pub fn label(self) -> &'static str {
        match self {
            Mode::Local => "local",
            Mode::Prod => "prod",
        }
    }
}

/// Conteos agregados de la biblioteca (comando `stats`).
#[derive(Clone, Debug)]
pub struct Stats {
    pub artists: i64,
    pub albums: i64,
    pub tracks: i64,
    pub links: i64,
}

/// Instantánea de estado (comando `status`).
#[derive(Clone, Debug)]
pub struct StatusInfo {
    pub mode: Mode,
    /// ¿Está el backend (BD local / API prod) alcanzable?
    pub connected: bool,
    /// Destino: URL de BD **redactada** (local) o `base_url` (prod).
    pub target: String,
    /// Versión del binario `tidol-shell`.
    pub version: String,
    /// Tiempo desde el arranque de la sesión.
    pub uptime: Duration,
}

/// Resultado de un chequeo de salud (comando `health`).
#[derive(Clone, Debug)]
pub struct HealthReport {
    pub checks: Vec<HealthCheck>,
}

#[derive(Clone, Debug)]
pub struct HealthCheck {
    pub name: String,
    pub ok: bool,
    pub detail: String,
}

/// Resumen de una ingesta local (comando `import`).
#[derive(Clone, Debug)]
pub struct ImportSummary {
    pub scanned: u64,
    pub imported: u64,
    pub skipped: u64,
}

// =========================================================================
// TRAIT COMÚN (ambos modos)
// =========================================================================
/// Operaciones soportadas por **los dos** modos (solo lectura y escritura
/// "segura"). Object-safe: se maneja como `Box<dyn TidolBackend>`.
#[async_trait]
pub trait TidolBackend: Send + Sync {
    // ── Inspección / lectura ──
    async fn list_artists(&self, limit: u32) -> BackendResult<Vec<ArtistResponse>>;
    async fn list_albums(
        &self,
        artist: Option<&str>,
        limit: u32,
    ) -> BackendResult<Vec<AlbumResponse>>;
    async fn list_tracks(
        &self,
        album: Option<&str>,
        artist: Option<&str>,
        limit: u32,
    ) -> BackendResult<Vec<TrackMetadataResponse>>;
    async fn describe_track(&self, id: &str) -> BackendResult<TrackMetadataResponse>;
    async fn search(&self, query: &str, limit: u32) -> BackendResult<SearchResponse>;
    async fn stats(&self) -> BackendResult<Stats>;

    // ── Escritura segura ──
    async fn add_artist(&self, name: &str, mbid: Option<&str>) -> BackendResult<ArtistResponse>;
    async fn link_track_mbid(&self, track_id: &str, mbid: &str) -> BackendResult<()>;

    // ── Observabilidad ──
    async fn status(&self) -> BackendResult<StatusInfo>;
    async fn health(&self) -> BackendResult<HealthReport>;
}

// =========================================================================
// TRAIT SOLO-LOCAL (destructivo / de disco)
// =========================================================================
/// Operaciones **solo-local**: ingesta de disco y mutaciones destructivas.
/// Supertrait de [`TidolBackend`], así que quien la implementa también sabe leer.
/// **Solo `LocalBackend` la implementa.**
#[async_trait]
pub trait LocalAdmin: TidolBackend {
    async fn import_path(&self, path: &Path) -> BackendResult<ImportSummary>;
    async fn delete_artist(&self, id: &str, cascade: bool) -> BackendResult<u64>;
    async fn delete_track(&self, id: &str) -> BackendResult<u64>;
    async fn run_migration(&self, name: &str) -> BackendResult<()>;
}
