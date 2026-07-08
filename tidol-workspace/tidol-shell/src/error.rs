//! Error tipado del backend del REPL.
//!
//! Cada variante se imprime con color y **el REPL continúa** (nunca aborta por
//! un error de dominio). El mapeo desde los errores del core / HTTP vive en cada
//! backend (`backend/local.rs`, `backend/remote.rs`).

use thiserror::Error;

/// Error recuperable de una operación de backend.
///
/// Las seis primeras variantes son las exigidas por la especificación. La
/// séptima, [`BackendError::NotImplemented`], es una **extensión deliberada**:
/// marca las operaciones que el `tidol-core` actual todavía no expone. La
/// especificación pedía dejar esos métodos como `todo!()`, pero un `todo!()` es
/// un `panic!` y la regla #1 (no negociable) prohíbe cualquier pánico provocable
/// desde el prompt. Resolvemos la tensión devolviendo un error tipado y legible
/// en lugar de abortar; cada sitio documenta la firma de `tidol-core` que espera.
#[derive(Debug, Error)]
pub enum BackendError {
    /// El recurso pedido no existe (404 en prod).
    #[error("no encontrado: {0}")]
    NotFound(String),

    /// Falta autenticación o el token es inválido (401 en prod).
    #[error("no autorizado: {0}")]
    Unauthorized(String),

    /// La entrada del usuario es inválida (argumento vacío, id mal formado…).
    #[error("entrada inválida: {0}")]
    Invalid(String),

    /// Fallo de red / backend inalcanzable / timeout / status HTTP inesperado.
    #[error("error de red: {0}")]
    Network(String),

    /// Fallo de base de datos en el modo local.
    #[error("error de base de datos: {0}")]
    Db(String),

    /// La operación no está permitida en el modo actual (p. ej. destructiva en
    /// prod). Es la **garantía estructural** de que prod no borra nada.
    #[error("operación no permitida: {0}")]
    NotPermitted(String),

    /// La operación existe en el REPL pero `tidol-core` aún no la implementa.
    /// El mensaje indica qué firma del core hace falta para conectarla.
    #[error("no implementado todavía: {0}")]
    NotImplemented(String),
}

/// Resultado de una operación de backend.
pub type BackendResult<T> = Result<T, BackendError>;

impl BackendError {
    /// Construye un [`BackendError::NotImplemented`] con el prefijo estándar que
    /// nombra la firma de `tidol-core` pendiente de conectar.
    pub fn todo_core(expected_signature: &str) -> Self {
        BackendError::NotImplemented(format!(
            "falta en tidol-core: {expected_signature}"
        ))
    }
}
