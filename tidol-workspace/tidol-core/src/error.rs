use thiserror::Error;

/// Error de dominio del core. Deliberadamente **no** implementa `IntoResponse`:
/// el mapeo a HTTP vive en el binario (tidol-server) vía el newtype `ServerError`,
/// respetando la orphan rule y manteniendo el core libre de `axum`.
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

    #[error("Error de configuración: {0}")]
    Config(String),
}

pub type TidolResult<T> = Result<T, TidolError>;

#[cfg(test)]
mod tests {
    use super::*;

    // Los textos de Display son el contrato observable: forman el campo
    // "error" del JSON que emite ServerError (tidol-server). Derivados de los
    // #[error("...")] de la línea base pre-refactor (error.rs @ e46be8bb),
    // que eran idénticos.

    #[test]
    fn display_db_preserva_prefijo_de_linea_base() {
        let e = TidolError::Db(sqlx::Error::RowNotFound);
        assert!(
            e.to_string().starts_with("Error de base de datos: "),
            "Display de Db cambió: {e}"
        );
    }

    #[test]
    fn display_provider_preserva_formato() {
        let e = TidolError::Provider {
            provider: "youtube",
            msg: "quota".into(),
        };
        assert_eq!(e.to_string(), "Proveedor youtube falló: quota");
    }

    #[test]
    fn display_stream_unavailable_preserva_formato() {
        let e = TidolError::StreamUnavailable {
            track_id: "abc-123".into(),
        };
        assert_eq!(e.to_string(), "Stream no disponible para track abc-123");
    }

    #[test]
    fn display_unauthorized_preserva_texto() {
        assert_eq!(TidolError::Unauthorized.to_string(), "Autenticación requerida");
    }

    #[test]
    fn display_not_found_preserva_formato() {
        let e = TidolError::NotFound {
            resource: "playlist".into(),
        };
        assert_eq!(e.to_string(), "No encontrado: playlist");
    }

    #[test]
    fn display_ffi_preserva_formato() {
        assert_eq!(
            TidolError::Ffi("plugin roto".into()).to_string(),
            "Error de FFI: plugin roto"
        );
    }

    #[test]
    fn from_sqlx_error_construye_variante_db() {
        // El `?` de create_playlist depende de este From (#[from]).
        let e: TidolError = sqlx::Error::RowNotFound.into();
        assert!(matches!(e, TidolError::Db(_)));
    }
}
