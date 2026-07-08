use axum::{
    http::StatusCode,
    response::{IntoResponse, Json, Response},
};

use tidol_core::error::TidolError;

/// Newtype sobre `TidolError` que aporta el `impl IntoResponse` (imposible en el
/// core por la orphan rule). Convierte errores de dominio en respuestas HTTP.
pub struct ServerError(pub TidolError);

impl From<TidolError> for ServerError {
    fn from(e: TidolError) -> Self {
        ServerError(e)
    }
}

impl IntoResponse for ServerError {
    fn into_response(self) -> Response {
        match self.0 {
            // Preserva el cuerpo legado exacto de create_playlist: texto plano
            // "Error DB: {e}" (no el Display de TidolError).
            TidolError::Db(e) => {
                (StatusCode::INTERNAL_SERVER_ERROR, format!("Error DB: {}", e)).into_response()
            }
            other => {
                let status = match &other {
                    TidolError::Provider { .. } => StatusCode::BAD_GATEWAY,
                    TidolError::StreamUnavailable { .. } => StatusCode::NOT_FOUND,
                    TidolError::Unauthorized => StatusCode::UNAUTHORIZED,
                    TidolError::NotFound { .. } => StatusCode::NOT_FOUND,
                    TidolError::Ffi(_) | TidolError::Config(_) => {
                        StatusCode::INTERNAL_SERVER_ERROR
                    }
                    TidolError::Db(_) => StatusCode::INTERNAL_SERVER_ERROR,
                };
                (status, Json(serde_json::json!({ "error": other.to_string() }))).into_response()
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::header::CONTENT_TYPE;

    async fn body_of(resp: Response) -> (StatusCode, Option<String>, String) {
        let status = resp.status();
        let ct = resp
            .headers()
            .get(CONTENT_TYPE)
            .map(|v| v.to_str().unwrap().to_string());
        let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap();
        (status, ct, String::from_utf8(bytes.to_vec()).unwrap())
    }

    // Mapeo variante → status de la línea base (error.rs @ e46be8bb):
    // Db→500, Provider→502, StreamUnavailable→404, Unauthorized→401,
    // NotFound→404, Ffi→500. Los cuerpos JSON {"error": Display} también
    // vienen de la base; el único camino Db observable en la base era el
    // plaintext ad-hoc de create_playlist ("Error DB: {e}"), que se preserva.

    #[tokio::test]
    async fn db_500_plaintext_legado_de_create_playlist() {
        let expected = format!("Error DB: {}", sqlx::Error::RowNotFound);
        let resp = ServerError(TidolError::Db(sqlx::Error::RowNotFound)).into_response();
        let (status, ct, body) = body_of(resp).await;
        assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
        assert_eq!(body, expected);
        // La base emitía (StatusCode, String) → text/plain, no JSON.
        assert!(
            ct.as_deref().unwrap_or("").starts_with("text/plain"),
            "content-type inesperado: {ct:?}"
        );
    }

    #[tokio::test]
    async fn provider_502_json() {
        let resp = ServerError(TidolError::Provider {
            provider: "spotify",
            msg: "timeout".into(),
        })
        .into_response();
        let (status, ct, body) = body_of(resp).await;
        assert_eq!(status, StatusCode::BAD_GATEWAY);
        assert_eq!(ct.as_deref(), Some("application/json"));
        assert_eq!(
            serde_json::from_str::<serde_json::Value>(&body).unwrap(),
            serde_json::json!({ "error": "Proveedor spotify falló: timeout" })
        );
    }

    #[tokio::test]
    async fn stream_unavailable_404_json() {
        let resp = ServerError(TidolError::StreamUnavailable {
            track_id: "t-1".into(),
        })
        .into_response();
        let (status, _, body) = body_of(resp).await;
        assert_eq!(status, StatusCode::NOT_FOUND);
        assert_eq!(
            serde_json::from_str::<serde_json::Value>(&body).unwrap(),
            serde_json::json!({ "error": "Stream no disponible para track t-1" })
        );
    }

    #[tokio::test]
    async fn unauthorized_401_json() {
        let resp = ServerError(TidolError::Unauthorized).into_response();
        let (status, _, body) = body_of(resp).await;
        assert_eq!(status, StatusCode::UNAUTHORIZED);
        assert_eq!(
            serde_json::from_str::<serde_json::Value>(&body).unwrap(),
            serde_json::json!({ "error": "Autenticación requerida" })
        );
    }

    #[tokio::test]
    async fn not_found_404_json() {
        let resp = ServerError(TidolError::NotFound {
            resource: "playlist".into(),
        })
        .into_response();
        let (status, _, body) = body_of(resp).await;
        assert_eq!(status, StatusCode::NOT_FOUND);
        assert_eq!(
            serde_json::from_str::<serde_json::Value>(&body).unwrap(),
            serde_json::json!({ "error": "No encontrado: playlist" })
        );
    }

    #[tokio::test]
    async fn ffi_500_json() {
        let resp = ServerError(TidolError::Ffi("plugin".into())).into_response();
        let (status, _, body) = body_of(resp).await;
        assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
        assert_eq!(
            serde_json::from_str::<serde_json::Value>(&body).unwrap(),
            serde_json::json!({ "error": "Error de FFI: plugin" })
        );
    }

    #[tokio::test]
    async fn config_500_json() {
        // Variante nueva del refactor (antes el arranque moría con `?` en main);
        // solo puede aparecer en TidolCore::new, nunca en un handler, pero su
        // mapeo queda fijado a 500 por si algún día se propaga.
        let resp = ServerError(TidolError::Config("mal".into())).into_response();
        let (status, _, _) = body_of(resp).await;
        assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
    }

    #[tokio::test]
    async fn from_tidol_error_envuelve_sin_alterar() {
        let e: ServerError = TidolError::Unauthorized.into();
        assert!(matches!(e.0, TidolError::Unauthorized));
    }
}
