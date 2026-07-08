// Configuración resuelta que el binario (tidol-server) pasa a `TidolCore::new`.
// El parseo de variables de entorno vive en el binario; el core recibe valores
// ya resueltos (con sus defaults aplicados).
#[derive(Clone, Debug)]
pub struct CoreConfig {
    /// Cadena de conexión MySQL/MariaDB (obligatoria).
    pub database_url: String,
    /// Máximo de conexiones del pool (default del binario: 100).
    pub database_max_connections: u32,
    /// Lista de proxies de salida en round-robin; por defecto `["direct"]`.
    pub proxy_pool: Vec<String>,
    /// Directorio donde se cargan los plugins dinámicos (.so).
    pub plugins_dir: String,
    /// Clave de YouTube Data API v3 (vacía = proveedor deshabilitado).
    pub youtube_api_key: String,
    /// Credenciales de Spotify Web API (vacías = proveedor deshabilitado).
    pub spotify_client_id: String,
    pub spotify_client_secret: String,
    /// Client ID de SoundCloud (vacío = proveedor deshabilitado).
    pub soundcloud_client_id: String,
    /// Secreto para firmar/validar JWT. Si es `None`, las operaciones que lo
    /// necesitan devuelven un error en tiempo de petición (el servidor arranca
    /// igualmente, preservando el comportamiento previo).
    pub jwt_secret: Option<String>,
}
