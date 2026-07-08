use std::sync::Arc;

use tidol_core::TidolCore;

/// Estado compartido de Axum. En vez de campos sueltos, expone un único
/// `core: Arc<TidolCore>`; los handlers usan `state.core.<método>()`.
#[derive(Clone)]
pub struct AppState {
    pub core: Arc<TidolCore>,
}
