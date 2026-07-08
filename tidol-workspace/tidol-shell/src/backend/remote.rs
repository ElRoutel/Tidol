//! `RemoteBackend`: habla contra la **API HTTP** de `tidol-server` vía `reqwest`,
//! **nunca** directo a la BD. Solo lectura y escritura "segura".
//!
//! No implementa [`LocalAdmin`]: en prod las operaciones destructivas/de disco
//! **no existen** (garantía por tipos, no por comprobación en runtime).
//!
//! Toda request lleva timeout; un prod inalcanzable produce
//! [`BackendError::Network`], nunca un cuelgue. Mapeo de códigos:
//! `401 → Unauthorized`, `404 → NotFound`, resto no-2xx → `Network`.

use std::time::{Duration, Instant};

use async_trait::async_trait;
use reqwest::StatusCode;
use serde::de::DeserializeOwned;

use super::{
    AlbumResponse, ArtistResponse, HealthCheck, HealthReport, Mode, SearchResponse, Stats,
    StatusInfo, TidolBackend, TrackMetadataResponse,
};
use crate::error::{BackendError, BackendResult};

/// Backend en modo prod. Cliente HTTP con timeout + token Bearer del keyring.
pub struct RemoteBackend {
    http: reqwest::Client,
    base_url: String,
    token: String,
    started: Instant,
}

impl RemoteBackend {
    /// Construye el cliente con timeout global. `base_url` se normaliza sin `/`
    /// final. `token` procede del keyring (nunca de argv ni del historial).
    pub fn new(base_url: String, token: String, started: Instant) -> BackendResult<Self> {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(15))
            .connect_timeout(Duration::from_secs(8))
            .build()
            .map_err(|e| BackendError::Network(format!("no se pudo crear el cliente HTTP: {e}")))?;
        Ok(RemoteBackend {
            http,
            base_url: base_url.trim_end_matches('/').to_string(),
            token,
            started,
        })
    }

    fn url(&self, path: &str) -> String {
        format!("{}{}", self.base_url, path)
    }

    /// Mapea el status/error de una respuesta a `BackendError`. Devuelve la
    /// respuesta intacta si es 2xx.
    fn check_status(resp: reqwest::Response) -> BackendResult<reqwest::Response> {
        let status = resp.status();
        if status.is_success() {
            return Ok(resp);
        }
        Err(match status {
            StatusCode::UNAUTHORIZED => {
                BackendError::Unauthorized("el token de prod fue rechazado (401)".into())
            }
            StatusCode::NOT_FOUND => BackendError::NotFound("recurso no encontrado (404)".into()),
            other => BackendError::Network(format!("respuesta HTTP inesperada: {other}")),
        })
    }

    async fn get(&self, path: &str) -> BackendResult<reqwest::Response> {
        let resp = self
            .http
            .get(self.url(path))
            .bearer_auth(&self.token)
            .send()
            .await
            .map_err(|e| BackendError::Network(e.to_string()))?;
        Self::check_status(resp)
    }

    async fn get_json<T: DeserializeOwned>(&self, path: &str) -> BackendResult<T> {
        let resp = self.get(path).await?;
        resp.json::<T>()
            .await
            .map_err(|e| BackendError::Network(format!("respuesta ilegible: {e}")))
    }
}

/// Trunca a `limit` (0 → 1).
fn cap<T>(mut v: Vec<T>, limit: u32) -> Vec<T> {
    v.truncate(limit.max(1) as usize);
    v
}

#[async_trait]
impl TidolBackend for RemoteBackend {
    async fn list_artists(&self, _limit: u32) -> BackendResult<Vec<ArtistResponse>> {
        // tidol-server no expone un listado de artistas (solo `/:id` y `/resolve`).
        Err(BackendError::todo_core(
            "endpoint GET /api/v1/music/artists (listado) en tidol-server",
        ))
    }

    async fn list_albums(
        &self,
        artist: Option<&str>,
        limit: u32,
    ) -> BackendResult<Vec<AlbumResponse>> {
        let albums: Vec<AlbumResponse> = self.get_json("/api/v1/music/albums").await?;
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
        if let Some(album_id) = album {
            let path = format!("/api/v1/music/albums/{}/songs", urlencoding::encode(album_id));
            return Ok(cap(self.get_json(&path).await?, limit));
        }
        if let Some(artist_id) = artist {
            let path = format!(
                "/api/v1/music/artists/{}/songs",
                urlencoding::encode(artist_id)
            );
            return Ok(cap(self.get_json(&path).await?, limit));
        }
        Err(BackendError::todo_core(
            "endpoint GET /api/v1/music/tracks (listado global) en tidol-server",
        ))
    }

    async fn describe_track(&self, _id: &str) -> BackendResult<TrackMetadataResponse> {
        Err(BackendError::todo_core(
            "endpoint GET /api/v1/music/tracks/:id en tidol-server",
        ))
    }

    async fn search(&self, query: &str, limit: u32) -> BackendResult<SearchResponse> {
        let path = format!(
            "/api/v1/search/{}?limit={}",
            urlencoding::encode(query),
            limit.clamp(1, 50)
        );
        // El handler devuelve `SearchResponse` o `{status:error,message}`; leemos
        // Value para distinguir el caso de error sin fallar la deserialización.
        let raw: serde_json::Value = self.get_json(&path).await?;
        if raw.get("status").and_then(|s| s.as_str()) == Some("error") {
            let msg = raw
                .get("message")
                .and_then(|m| m.as_str())
                .unwrap_or("búsqueda rechazada")
                .to_string();
            return Err(BackendError::Invalid(msg));
        }
        serde_json::from_value(raw)
            .map_err(|e| BackendError::Network(format!("SearchResponse ilegible: {e}")))
    }

    async fn stats(&self) -> BackendResult<Stats> {
        Err(BackendError::todo_core(
            "endpoint GET /api/v1/stats en tidol-server",
        ))
    }

    async fn add_artist(&self, _name: &str, _mbid: Option<&str>) -> BackendResult<ArtistResponse> {
        Err(BackendError::todo_core(
            "endpoint POST /api/v1/music/artists en tidol-server",
        ))
    }

    async fn link_track_mbid(&self, _track_id: &str, _mbid: &str) -> BackendResult<()> {
        Err(BackendError::todo_core(
            "endpoint POST /api/v1/tracks/:id/link en tidol-server",
        ))
    }

    async fn status(&self) -> BackendResult<StatusInfo> {
        // Ping a un endpoint protegido: cualquier respuesta HTTP ⇒ alcanzable.
        let connected = self
            .http
            .get(self.url("/api/v1/auth/me"))
            .bearer_auth(&self.token)
            .send()
            .await
            .is_ok();
        Ok(StatusInfo {
            mode: Mode::Prod,
            connected,
            target: self.base_url.clone(),
            version: env!("CARGO_PKG_VERSION").to_string(),
            uptime: self.started.elapsed(),
        })
    }

    async fn health(&self) -> BackendResult<HealthReport> {
        let mut checks = Vec::new();
        match self
            .http
            .get(self.url("/api/v1/auth/me"))
            .bearer_auth(&self.token)
            .send()
            .await
        {
            Ok(resp) => {
                let code = resp.status();
                checks.push(HealthCheck {
                    name: "api".into(),
                    ok: true,
                    detail: format!("{} respondió {}", self.base_url, code),
                });
                checks.push(HealthCheck {
                    name: "token".into(),
                    ok: code != StatusCode::UNAUTHORIZED,
                    detail: if code == StatusCode::UNAUTHORIZED {
                        "token rechazado (401)".into()
                    } else {
                        "token aceptado".into()
                    },
                });
            }
            Err(e) => checks.push(HealthCheck {
                name: "api".into(),
                ok: false,
                detail: format!("{} inalcanzable: {e}", self.base_url),
            }),
        }
        // Las rutas de audio son un chequeo solo-local; en prod no aplica.
        checks.push(HealthCheck {
            name: "audio_paths".into(),
            ok: true,
            detail: "n/a en modo prod (chequeo solo-local)".into(),
        });
        Ok(HealthReport { checks })
    }
}
