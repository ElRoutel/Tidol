use axum::{
    http::StatusCode,
    response::{IntoResponse, Json, Response},
};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum TidolError {
    #[error("Error de base de datos: {0}")]
    Db(#[from] sqlx::Error),

    #[error("Proveedor {provider} falló: {msg}")]
    Provider { provider: &'static str, msg: String },

    #[error("Stream no disponible para track {track_id}")]
    StreamUnavailable { track_id: String },

    #[error("Autenticación requerida")]
    Unauthorized,

    #[error("No encontrado: {resource}")]
    NotFound { resource: String },

    #[error("Error de FFI: {0}")]
    Ffi(String),
}

impl IntoResponse for TidolError {
    fn into_response(self) -> Response {
        let status = match &self {
            Self::Db(_) => StatusCode::INTERNAL_SERVER_ERROR,
            Self::Provider { .. } => StatusCode::BAD_GATEWAY,
            Self::StreamUnavailable { .. } => StatusCode::NOT_FOUND,
            Self::Unauthorized => StatusCode::UNAUTHORIZED,
            Self::NotFound { .. } => StatusCode::NOT_FOUND,
            Self::Ffi(_) => StatusCode::INTERNAL_SERVER_ERROR,
        };
        (
            status,
            Json(serde_json::json!({ "error": self.to_string() })),
        )
            .into_response()
    }
}

pub type TidolResult<T> = Result<T, TidolError>;
