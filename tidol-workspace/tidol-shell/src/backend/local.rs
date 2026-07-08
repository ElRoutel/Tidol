//! `LocalBackend`: habla **directo** con `tidol-core` / la BD local. Es el
//! sandbox de administración; implementa además [`LocalAdmin`] (operaciones
//! destructivas y de disco).
//!
//! Donde `tidol-core` aún no expone el método que un comando necesita, el método
//! devuelve [`BackendError::NotImplemented`] documentando la **firma exacta** que
//! se espera del core. No usamos `todo!()` porque paniquearía y la regla #1 lo
//! prohíbe; el efecto para el reviewer es el mismo (queda marcado y greppable por
//! `NotImplemented` / `todo_core`), pero el prompt jamás aborta.

use std::path::Path;
use std::sync::Arc;
use std::time::Instant;

use async_trait::async_trait;

use tidol_core::TidolCore;

use super::{
    AlbumResponse, ArtistResponse, HealthCheck, HealthReport, ImportSummary, LocalAdmin, Mode,
    SearchResponse, Stats, StatusInfo, TidolBackend, TrackMetadataResponse,
};
use crate::error::{BackendError, BackendResult};

/// Backend en modo local. Barato de clonar conceptualmente: solo comparte el
/// `Arc<TidolCore>`.
pub struct LocalBackend {
    core: Arc<TidolCore>,
    started: Instant,
    db_url_redacted: String,
    plugins_dir: String,
}

impl LocalBackend {
    pub fn new(
        core: Arc<TidolCore>,
        started: Instant,
        db_url_redacted: String,
        plugins_dir: String,
    ) -> Self {
        LocalBackend {
            core,
            started,
            db_url_redacted,
            plugins_dir,
        }
    }

    /// Sonda de conectividad barata contra la BD, reutilizando un método real del
    /// core (`resolve_artist` con patrón vacío → `LIKE '%%' LIMIT 1`). Devuelve
    /// `Ok` con la BD viva, `Err(Db)` si el pool no conecta. Mapea aquí el
    /// `sqlx::Error` para no arrastrar `sqlx` como dependencia directa del shell.
    async fn db_ping(&self) -> BackendResult<()> {
        self.core
            .resolve_artist(Some(String::new()))
            .await
            .map(|_| ())
            .map_err(|e| BackendError::Db(e.to_string()))
    }
}

/// Trunca a `limit` (con `limit == 0` tratado como 1 para no devolver vacío por
/// un flag mal puesto).
fn cap<T>(mut v: Vec<T>, limit: u32) -> Vec<T> {
    v.truncate(limit.max(1) as usize);
    v
}

#[async_trait]
impl TidolBackend for LocalBackend {
    async fn list_artists(&self, _limit: u32) -> BackendResult<Vec<ArtistResponse>> {
        // tidol-core solo ofrece `resolve_artist(name)` (1 fila) y
        // `get_artist_by_id(id)`. No hay listado.
        Err(BackendError::todo_core(
            "TidolCore::get_artists(limit: u32) -> Result<Vec<ArtistResponse>, sqlx::Error>",
        ))
    }

    async fn list_albums(
        &self,
        artist: Option<&str>,
        limit: u32,
    ) -> BackendResult<Vec<AlbumResponse>> {
        // `get_albums()` real (BD local). El filtro por artista es del lado del
        // cliente porque el core no lo parametriza (documentado en el README).
        let albums = self
            .core
            .get_albums()
            .await
            .map_err(|e| BackendError::Db(e.to_string()))?;
        let filtered = match artist {
            Some(a) => albums.into_iter().filter(|al| al.artist_id == a).collect(),
            None => albums,
        };
        Ok(cap(filtered, limit))
    }

    async fn list_tracks(
        &self,
        album: Option<&str>,
        artist: Option<&str>,
        limit: u32,
    ) -> BackendResult<Vec<TrackMetadataResponse>> {
        // `get_album_songs` / `get_artist_songs` son reales (devuelven Vec, sin
        // Result: el core traga el error de BD como lista vacía).
        if let Some(album_id) = album {
            return Ok(cap(self.core.get_album_songs(album_id).await, limit));
        }
        if let Some(artist_id) = artist {
            return Ok(cap(self.core.get_artist_songs(artist_id).await, limit));
        }
        // Listado global sin filtro: el core no lo expone.
        Err(BackendError::todo_core(
            "TidolCore::get_tracks(limit: u32) -> Result<Vec<TrackMetadataResponse>, sqlx::Error>",
        ))
    }

    async fn describe_track(&self, _id: &str) -> BackendResult<TrackMetadataResponse> {
        Err(BackendError::todo_core(
            "TidolCore::get_track_by_id(id: &str) -> Result<Option<TrackMetadataResponse>, sqlx::Error>",
        ))
    }

    async fn search(&self, query: &str, limit: u32) -> BackendResult<SearchResponse> {
        // Real: golpea el orquestador de metadatos (MusicBrainz — legal).
        self.core
            .search_catalog(query, limit.clamp(1, 50), 0)
            .await
            .map_err(|e| BackendError::Network(e.to_string()))
    }

    async fn stats(&self) -> BackendResult<Stats> {
        Err(BackendError::todo_core(
            "TidolCore::stats() -> Result<CatalogStats, sqlx::Error> (COUNT de artists/albums/trackMetadata/track_links)",
        ))
    }

    async fn add_artist(&self, _name: &str, _mbid: Option<&str>) -> BackendResult<ArtistResponse> {
        Err(BackendError::todo_core(
            "TidolCore::add_artist(name: &str, mbid: Option<&str>) -> Result<ArtistResponse, sqlx::Error>",
        ))
    }

    async fn link_track_mbid(&self, _track_id: &str, _mbid: &str) -> BackendResult<()> {
        Err(BackendError::todo_core(
            "TidolCore::link_track_mbid(track_id: &str, mbid: &str) -> Result<(), sqlx::Error>",
        ))
    }

    async fn status(&self) -> BackendResult<StatusInfo> {
        let connected = self.db_ping().await.is_ok();
        Ok(StatusInfo {
            mode: Mode::Local,
            connected,
            target: self.db_url_redacted.clone(),
            version: env!("CARGO_PKG_VERSION").to_string(),
            uptime: self.started.elapsed(),
        })
    }

    async fn health(&self) -> BackendResult<HealthReport> {
        let mut checks = Vec::new();

        match self.db_ping().await {
            Ok(()) => checks.push(HealthCheck {
                name: "database".into(),
                ok: true,
                detail: self.db_url_redacted.clone(),
            }),
            Err(e) => checks.push(HealthCheck {
                name: "database".into(),
                ok: false,
                detail: e.to_string(),
            }),
        }

        let plugins_ok = Path::new(&self.plugins_dir).is_dir();
        checks.push(HealthCheck {
            name: "plugins_dir".into(),
            ok: plugins_ok,
            detail: self.plugins_dir.clone(),
        });

        // "Rutas de audio válidas": la reproducción desde biblioteca local vive
        // tras la feature `local-library`, hoy un placeholder sin implementación.
        checks.push(HealthCheck {
            name: "local_library".into(),
            ok: cfg!(feature = "local-library"),
            detail: if cfg!(feature = "local-library") {
                "feature activa (import stub, pendiente en el core)".into()
            } else {
                "feature inactiva (recompila con --features tidol-core/local-library)".into()
            },
        });

        Ok(HealthReport { checks })
    }
}

// =========================================================================
// LocalAdmin: SOLO LocalBackend. RemoteBackend nunca implementa esto.
// =========================================================================
#[async_trait]
impl LocalAdmin for LocalBackend {
    async fn import_path(&self, path: &Path) -> BackendResult<ImportSummary> {
        // El import solo tiene sentido con la feature activa; sin ella, ni siquiera
        // se intenta (y el comando ni se compila: ver commands/).
        #[cfg(feature = "local-library")]
        {
            let _ = path; // la firma esperada del core recibirá la ruta ya validada.
            Err(BackendError::todo_core(
                "TidolCore::import_path(path: &std::path::Path) -> Result<ImportSummary, TidolError> (tras feature local-library; escanea archivos YA presentes en disco, no descarga)",
            ))
        }
        #[cfg(not(feature = "local-library"))]
        {
            let _ = path;
            Err(BackendError::NotPermitted(
                "compila con --features tidol-core/local-library para habilitar `import`".into(),
            ))
        }
    }

    async fn delete_artist(&self, _id: &str, _cascade: bool) -> BackendResult<u64> {
        Err(BackendError::todo_core(
            "TidolCore::delete_artist(id: &str, cascade: bool) -> Result<u64, sqlx::Error> (filas borradas; con cascade elimina álbumes/pistas dependientes)",
        ))
    }

    async fn delete_track(&self, _id: &str) -> BackendResult<u64> {
        Err(BackendError::todo_core(
            "TidolCore::delete_track(id: &str) -> Result<u64, sqlx::Error>",
        ))
    }

    async fn run_migration(&self, _name: &str) -> BackendResult<()> {
        Err(BackendError::todo_core(
            "TidolCore::run_migration(name: &str) -> Result<(), sqlx::Error>",
        ))
    }
}
