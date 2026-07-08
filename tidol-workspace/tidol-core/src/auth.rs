use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use thiserror::Error;
use uuid::Uuid;

use crate::TidolCore;

// -------------------------------------------------------------------------
// CONTRATOS DE DATOS CRIPTOGRÁFICOS Y PAYLOADS
// -------------------------------------------------------------------------
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: i64,
    pub device_id: String,
    pub exp: usize,
    pub iat: usize,
}

#[derive(Debug, Clone)]
pub struct AuthContext {
    pub user_id: i64,
    pub device_id: String,
}

#[derive(Debug, Deserialize)]
pub struct RegisterPayload {
    pub username: String,
    pub password: String,
    pub device_name: String,
    pub device_type: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginPayload {
    pub username: String,
    pub password: String,
    pub device_name: String,
    pub device_type: String,
}

// -------------------------------------------------------------------------
// ERRORES DE DOMINIO (el binario los mapea a status HTTP; el mensaje = cuerpo)
// -------------------------------------------------------------------------
/// Error del guardia de autenticación. `Unauthorized` → 401, `Internal` → 500.
#[derive(Debug)]
pub enum AuthError {
    Unauthorized,
    Internal,
}

#[derive(Debug, Error)]
pub enum RegisterError {
    #[error("Username inválido")]
    InvalidUsername,
    #[error("Contraseña muy corta (mínimo 8 caracteres)")]
    PasswordTooShort,
    #[error("Datos de dispositivo inválidos")]
    InvalidDevice,
    #[error("Error interno de criptografía")]
    Crypto,
    #[error("Error iniciando transacción: {0}")]
    TxBegin(sqlx::Error),
    #[error("El nombre de usuario ya está en uso")]
    UsernameTaken,
    #[error("Error DB: {0}")]
    Db(sqlx::Error),
    #[error("Error registrando dispositivo: {0}")]
    DeviceInsert(sqlx::Error),
    #[error("Error confirmando transacción: {0}")]
    TxCommit(sqlx::Error),
    #[error("Reloj del sistema inválido")]
    Clock,
    #[error("Falta definir JWT_SECRET")]
    MissingSecret,
    #[error("No se pudo firmar el JWT")]
    Sign,
}

#[derive(Debug, Error)]
pub enum LoginError {
    #[error("Credenciales inválidas")]
    InvalidCredentials,
    #[error("Datos de dispositivo inválidos")]
    InvalidDevice,
    #[error("Error DB: {0}")]
    Db(sqlx::Error),
    #[error("Usuario o contraseña incorrectos")]
    BadLogin,
    #[error("Hash de base de datos corrupto")]
    CorruptHash,
    #[error("Error vinculando dispositivo: {0}")]
    DeviceLink(sqlx::Error),
    #[error("Reloj del sistema inválido")]
    Clock,
    #[error("Falta JWT_SECRET")]
    MissingSecret,
    #[error("No se pudo firmar el JWT")]
    Sign,
}

#[derive(Debug, Error)]
pub enum MeError {
    #[error("Error DB: {0}")]
    Db(sqlx::Error),
    #[error("Sesión inválida")]
    NotFound,
}

#[derive(Debug, Error)]
pub enum LogoutError {
    #[error("Error DB: {0}")]
    Db(sqlx::Error),
    #[error("Sesión inválida o ya cerrada")]
    AlreadyClosed,
}

// -------------------------------------------------------------------------
// HELPERS PRIVADOS
// -------------------------------------------------------------------------
fn unix_now() -> Option<u64> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .ok()
}

impl TidolCore {
    // -------------------------------------------------------------------------
    // GUARDIA: valida el token y resuelve el AuthContext (verifica el device en BD)
    // -------------------------------------------------------------------------
    pub async fn authenticate(&self, token: &str) -> Result<AuthContext, AuthError> {
        let secret = self.config.jwt_secret.as_ref().ok_or(AuthError::Internal)?;

        let token_data = decode::<Claims>(
            token,
            &DecodingKey::from_secret(secret.as_bytes()),
            &Validation::default(),
        )
        .map_err(|_| AuthError::Unauthorized)?;

        let claims = token_data.claims;

        let device_verification = sqlx::query!(
            "SELECT id FROM devices WHERE id = ? AND user_id = ? LIMIT 1",
            claims.device_id,
            claims.sub
        )
        .fetch_optional(&self.db)
        .await
        .map_err(|_| AuthError::Internal)?;

        if device_verification.is_none() {
            return Err(AuthError::Unauthorized);
        }

        Ok(AuthContext {
            user_id: claims.sub,
            device_id: claims.device_id,
        })
    }

    // -------------------------------------------------------------------------
    // REGISTRO
    // -------------------------------------------------------------------------
    pub async fn register(
        &self,
        payload: RegisterPayload,
    ) -> Result<serde_json::Value, RegisterError> {
        let username = payload.username.trim().to_lowercase();
        let password = payload.password.trim().to_string();
        let device_name = payload.device_name.trim().to_string();
        let device_type = payload.device_type.trim().to_string();

        if username.is_empty() || username.len() > 50 {
            return Err(RegisterError::InvalidUsername);
        }

        if password.len() < 8 {
            return Err(RegisterError::PasswordTooShort);
        }

        if device_name.is_empty() || device_type.is_empty() {
            return Err(RegisterError::InvalidDevice);
        }

        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();

        let password_hash = argon2
            .hash_password(password.as_bytes(), &salt)
            .map_err(|_| RegisterError::Crypto)?
            .to_string();

        let mut tx = self.db.begin().await.map_err(RegisterError::TxBegin)?;

        let insert_user = sqlx::query!(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            username,
            password_hash
        )
        .execute(&mut *tx)
        .await;

        let user_id = match insert_user {
            Ok(result) => result.last_insert_id() as i64,
            Err(sqlx::Error::Database(db_err)) if db_err.is_unique_violation() => {
                return Err(RegisterError::UsernameTaken);
            }
            Err(e) => {
                return Err(RegisterError::Db(e));
            }
        };

        let device_id = Uuid::new_v4().to_string();

        sqlx::query!(
            "INSERT INTO devices (id, user_id, device_name, device_type) VALUES (?, ?, ?, ?)",
            device_id,
            user_id,
            device_name,
            device_type
        )
        .execute(&mut *tx)
        .await
        .map_err(RegisterError::DeviceInsert)?;

        tx.commit().await.map_err(RegisterError::TxCommit)?;

        let now = unix_now().ok_or(RegisterError::Clock)?;

        let claims = Claims {
            sub: user_id,
            device_id: device_id.clone(),
            exp: (now + 60 * 60 * 24 * 7) as usize,
            iat: now as usize,
        };

        let secret = self
            .config
            .jwt_secret
            .as_ref()
            .ok_or(RegisterError::MissingSecret)?;

        let token = encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(secret.as_bytes()),
        )
        .map_err(|_| RegisterError::Sign)?;

        Ok(serde_json::json!({
            "status": "success",
            "message": "Usuario registrado exitosamente",
            "token": token,
            "device_id": device_id,
            "username": username
        }))
    }

    // -------------------------------------------------------------------------
    // LOGIN
    // -------------------------------------------------------------------------
    pub async fn login(&self, payload: LoginPayload) -> Result<serde_json::Value, LoginError> {
        let username = payload.username.trim().to_lowercase();
        let password = payload.password.trim();
        let device_name = payload.device_name.trim().to_string();
        let device_type = payload.device_type.trim().to_string();

        if username.is_empty() || password.is_empty() {
            return Err(LoginError::InvalidCredentials);
        }

        if device_name.is_empty() || device_type.is_empty() {
            return Err(LoginError::InvalidDevice);
        }

        let user = sqlx::query!(
            "SELECT id, username, password_hash FROM users WHERE username = ? LIMIT 1",
            username
        )
        .fetch_optional(&self.db)
        .await
        .map_err(LoginError::Db)?;

        let user_row = match user {
            Some(row) => row,
            None => return Err(LoginError::BadLogin),
        };

        let parsed_hash =
            PasswordHash::new(&user_row.password_hash).map_err(|_| LoginError::CorruptHash)?;

        let argon2 = Argon2::default();
        if argon2
            .verify_password(password.as_bytes(), &parsed_hash)
            .is_err()
        {
            return Err(LoginError::BadLogin);
        }

        let device_id = Uuid::new_v4().to_string();

        sqlx::query!(
            "INSERT INTO devices (id, user_id, device_name, device_type) VALUES (?, ?, ?, ?)",
            device_id,
            user_row.id as i64,
            device_name,
            device_type
        )
        .execute(&self.db)
        .await
        .map_err(LoginError::DeviceLink)?;

        let now = unix_now().ok_or(LoginError::Clock)?;

        let claims = Claims {
            sub: user_row.id as i64,
            device_id: device_id.clone(),
            exp: (now + 60 * 60 * 24 * 7) as usize,
            iat: now as usize,
        };

        let secret = self
            .config
            .jwt_secret
            .as_ref()
            .ok_or(LoginError::MissingSecret)?;

        let token = encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(secret.as_bytes()),
        )
        .map_err(|_| LoginError::Sign)?;

        Ok(serde_json::json!({
            "status": "success",
            "message": "Login exitoso",
            "token": token,
            "device_id": device_id,
            "username": user_row.username
        }))
    }

    // -------------------------------------------------------------------------
    // PERFIL ACTUAL
    // -------------------------------------------------------------------------
    pub async fn me(&self, auth: &AuthContext) -> Result<serde_json::Value, MeError> {
        let row = sqlx::query!(
            r#"
            SELECT u.username, d.device_name, d.device_type
            FROM users u
            JOIN devices d ON u.id = d.user_id
            WHERE u.id = ? AND d.id = ?
            LIMIT 1
            "#,
            auth.user_id,
            auth.device_id
        )
        .fetch_optional(&self.db)
        .await
        .map_err(MeError::Db)?;

        match row {
            Some(r) => Ok(serde_json::json!({
                "status": "success",
                "user_id": auth.user_id,
                "username": r.username,
                "device": {
                    "id": auth.device_id,
                    "name": r.device_name,
                    "type": r.device_type
                }
            })),
            None => Err(MeError::NotFound),
        }
    }

    // -------------------------------------------------------------------------
    // LOGOUT
    // -------------------------------------------------------------------------
    pub async fn logout(&self, auth: &AuthContext) -> Result<serde_json::Value, LogoutError> {
        let result = sqlx::query!(
            "DELETE FROM devices WHERE id = ? AND user_id = ?",
            auth.device_id,
            auth.user_id
        )
        .execute(&self.db)
        .await
        .map_err(LogoutError::Db)?;

        if result.rows_affected() == 0 {
            return Err(LogoutError::AlreadyClosed);
        }

        Ok(serde_json::json!({
            "status": "success",
            "message": "Logout exitoso"
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::CoreConfig;
    use crate::TidolCore;

    const SECRET: &str = "secreto-de-prueba";

    /// Núcleo real con pool perezoso hacia un puerto cerrado (127.0.0.1:1):
    /// cualquier camino que toque BD falla como con una BD caída.
    fn core_with_secret(secret: Option<&str>) -> TidolCore {
        TidolCore::new_disconnected(CoreConfig {
            database_url: "mysql://user:pass@127.0.0.1:1/nodb".into(),
            database_max_connections: 1,
            proxy_pool: vec!["direct".into()],
            plugins_dir: "/nonexistent".into(),
            youtube_api_key: String::new(),
            spotify_client_id: String::new(),
            spotify_client_secret: String::new(),
            soundcloud_client_id: String::new(),
            jwt_secret: secret.map(String::from),
        })
    }

    fn unix_now() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
    }

    fn make_token(secret: &str, exp: u64) -> String {
        let claims = Claims {
            sub: 7,
            device_id: "dev-1".into(),
            exp: exp as usize,
            iat: unix_now() as usize,
        };
        jsonwebtoken::encode(
            &jsonwebtoken::Header::default(),
            &claims,
            &jsonwebtoken::EncodingKey::from_secret(secret.as_bytes()),
        )
        .unwrap()
    }

    // ── authenticate(): la validación JWT que antes vivía en auth_middleware ──
    // Línea base (@ e46be8bb): decode fallido → 401; JWT_SECRET ausente → 500;
    // error de BD → 500. Aquí: Unauthorized / Internal respectivamente.

    #[tokio::test]
    async fn token_malformado_rechazado_sin_panico() {
        let core = core_with_secret(Some(SECRET));
        for tok in ["", "garbage", "a.b", "a.b.c", "ey.ey.ey", "\u{0}\u{1}"] {
            let res = core.authenticate(tok).await;
            assert!(
                matches!(res, Err(AuthError::Unauthorized)),
                "token {tok:?} debía ser Unauthorized, fue {res:?}",
            );
        }
    }

    #[tokio::test]
    async fn token_expirado_rechazado() {
        let core = core_with_secret(Some(SECRET));
        // exp una hora en el pasado (fuera del leeway de 60 s del default).
        let tok = make_token(SECRET, unix_now() - 3600);
        assert!(matches!(
            core.authenticate(&tok).await,
            Err(AuthError::Unauthorized)
        ));
    }

    #[tokio::test]
    async fn token_con_firma_invalida_rechazado() {
        let core = core_with_secret(Some(SECRET));
        let tok = make_token("otro-secreto", unix_now() + 3600);
        assert!(matches!(
            core.authenticate(&tok).await,
            Err(AuthError::Unauthorized)
        ));
    }

    #[tokio::test]
    async fn token_valido_pasa_decode_y_bd_caida_es_internal() {
        // Con firma y exp válidos el decode NO debe devolver Unauthorized; el
        // fallo llega al verificar el device en la BD (inalcanzable) → Internal,
        // el mismo mapeo (500) que el middleware original daba a errores de BD.
        let core = core_with_secret(Some(SECRET));
        let tok = make_token(SECRET, unix_now() + 3600);
        assert!(matches!(
            core.authenticate(&tok).await,
            Err(AuthError::Internal)
        ));
    }

    #[tokio::test]
    async fn sin_jwt_secret_es_internal() {
        // Línea base: JWT_SECRET ausente → 500 (no 401).
        let core = core_with_secret(None);
        let tok = make_token(SECRET, unix_now() + 3600);
        assert!(matches!(
            core.authenticate(&tok).await,
            Err(AuthError::Internal)
        ));
    }

    #[tokio::test]
    async fn claims_de_registro_sobreviven_el_roundtrip() {
        // encode con los mismos parámetros que register/login → authenticate
        // debe decodificarlos (el fallo posterior es solo la BD).
        let core = core_with_secret(Some(SECRET));
        let claims = Claims {
            sub: 99,
            device_id: "uuid-x".into(),
            exp: (unix_now() + 604_800) as usize, // 7 días, como register/login
            iat: unix_now() as usize,
        };
        let tok = jsonwebtoken::encode(
            &jsonwebtoken::Header::default(),
            &claims,
            &jsonwebtoken::EncodingKey::from_secret(SECRET.as_bytes()),
        )
        .unwrap();
        // Internal = decode OK + BD caída; Unauthorized delataría un cambio en
        // la validación (algoritmo/required claims) respecto a la base.
        assert!(matches!(
            core.authenticate(&tok).await,
            Err(AuthError::Internal)
        ));
    }

    // ── argon2: mismos parámetros que la línea base (Argon2::default()) ──

    #[test]
    fn argon2_parametros_por_defecto_y_verificacion() {
        use argon2::password_hash::{rand_core::OsRng, SaltString};

        let salt = SaltString::generate(&mut OsRng);
        let hash = Argon2::default()
            .hash_password(b"password123", &salt)
            .unwrap()
            .to_string();

        // Los parámetros por defecto de argon2 0.5 (los de la base):
        // Argon2id v19, m=19456 KiB, t=2, p=1. Si cambian, los hashes nuevos
        // dejarían de ser comparables con los almacenados.
        assert!(
            hash.starts_with("$argon2id$v=19$m=19456,t=2,p=1$"),
            "parámetros argon2 distintos de la base: {hash}"
        );

        let parsed = PasswordHash::new(&hash).unwrap();
        assert!(Argon2::default()
            .verify_password(b"password123", &parsed)
            .is_ok());
        assert!(Argon2::default()
            .verify_password(b"otra-cosa", &parsed)
            .is_err());
    }

    // ── register/login: validaciones puras (previas a la BD) ──
    // Cuerpos y semántica de la línea base: 400 con esos textos exactos.

    #[tokio::test]
    async fn register_valida_entrada_antes_de_tocar_bd() {
        let core = core_with_secret(Some(SECRET));

        let mk = |u: &str, p: &str, dn: &str, dt: &str| RegisterPayload {
            username: u.into(),
            password: p.into(),
            device_name: dn.into(),
            device_type: dt.into(),
        };

        let e = core.register(mk("", "12345678", "d", "t")).await.unwrap_err();
        assert!(matches!(e, RegisterError::InvalidUsername));
        assert_eq!(e.to_string(), "Username inválido");

        let e = core
            .register(mk(&"u".repeat(51), "12345678", "d", "t"))
            .await
            .unwrap_err();
        assert!(matches!(e, RegisterError::InvalidUsername));

        let e = core.register(mk("user", "1234567", "d", "t")).await.unwrap_err();
        assert!(matches!(e, RegisterError::PasswordTooShort));
        assert_eq!(e.to_string(), "Contraseña muy corta (mínimo 8 caracteres)");

        let e = core.register(mk("user", "12345678", "", "t")).await.unwrap_err();
        assert!(matches!(e, RegisterError::InvalidDevice));
        assert_eq!(e.to_string(), "Datos de dispositivo inválidos");
    }

    #[tokio::test]
    async fn login_valida_entrada_antes_de_tocar_bd() {
        let core = core_with_secret(Some(SECRET));

        let mk = |u: &str, p: &str, dn: &str, dt: &str| LoginPayload {
            username: u.into(),
            password: p.into(),
            device_name: dn.into(),
            device_type: dt.into(),
        };

        let e = core.login(mk("", "x", "d", "t")).await.unwrap_err();
        assert!(matches!(e, LoginError::InvalidCredentials));
        assert_eq!(e.to_string(), "Credenciales inválidas");

        let e = core.login(mk("user", "x", "", "t")).await.unwrap_err();
        assert!(matches!(e, LoginError::InvalidDevice));
        assert_eq!(e.to_string(), "Datos de dispositivo inválidos");
    }
}
