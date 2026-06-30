use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use axum::{
    extract::State,
    http::{Request, StatusCode},
    middleware::Next,
    response::Response,
    Json,
};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

use crate::AppState;

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
// HELPERS PRIVADOS
// -------------------------------------------------------------------------
fn jwt_secret() -> Result<String, StatusCode> {
    std::env::var("JWT_SECRET").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

fn unix_now() -> Result<u64, StatusCode> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

// -------------------------------------------------------------------------
// MIDDLEWARE DE INTERCEPTACIÓN Y GUARDIA DE RUTAS
// -------------------------------------------------------------------------
pub async fn auth_middleware(
    State(state): State<AppState>,
    mut req: Request<axum::body::Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    let auth_header = req
        .headers()
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "));

    let query_token = req.uri().query().and_then(|q| {
        q.split('&')
            .find(|pair| pair.starts_with("token="))
            .map(|pair| pair.trim_start_matches("token="))
    });

    let token_val = match (auth_header, query_token) {
        (Some(t), _) if !t.trim().is_empty() => t.trim().to_string(),
        (_, Some(t)) if !t.trim().is_empty() => t.trim().to_string(),
        _ => return Err(StatusCode::UNAUTHORIZED),
    };

    let token = token_val.as_str();

    let secret = jwt_secret()?;

    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )
    .map_err(|_| StatusCode::UNAUTHORIZED)?;

    let claims = token_data.claims;

    let device_verification = sqlx::query!(
        "SELECT id FROM devices WHERE id = ? AND user_id = ? LIMIT 1",
        claims.device_id,
        claims.sub
    )
    .fetch_optional(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if device_verification.is_none() {
        return Err(StatusCode::UNAUTHORIZED);
    }

    req.extensions_mut().insert(AuthContext {
        user_id: claims.sub,
        device_id: claims.device_id,
    });

    Ok(next.run(req).await)
}

// -------------------------------------------------------------------------
// MANEJADORES DE ENDPOINTS (HANDLERS)
// -------------------------------------------------------------------------
pub async fn register_handler(
    State(state): State<AppState>,
    Json(payload): Json<RegisterPayload>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let username = payload.username.trim().to_lowercase();
    let password = payload.password.trim().to_string();
    let device_name = payload.device_name.trim().to_string();
    let device_type = payload.device_type.trim().to_string();

    if username.is_empty() || username.len() > 50 {
        return Err((StatusCode::BAD_REQUEST, "Username inválido".to_string()));
    }

    if password.len() < 8 {
        return Err((
            StatusCode::BAD_REQUEST,
            "Contraseña muy corta (mínimo 8 caracteres)".to_string(),
        ));
    }

    if device_name.is_empty() || device_type.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "Datos de dispositivo inválidos".to_string(),
        ));
    }

    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();

    let password_hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Error interno de criptografía".to_string(),
            )
        })?
        .to_string();

    let mut tx = state.db.begin().await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Error iniciando transacción: {}", e),
        )
    })?;

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
            return Err((
                StatusCode::CONFLICT,
                "El nombre de usuario ya está en uso".to_string(),
            ));
        }
        Err(e) => {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Error DB: {}", e),
            ));
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
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Error registrando dispositivo: {}", e),
        )
    })?;

    tx.commit().await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Error confirmando transacción: {}", e),
        )
    })?;

    let now = unix_now().map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Reloj del sistema inválido".to_string(),
        )
    })?;

    let claims = Claims {
        sub: user_id,
        device_id: device_id.clone(),
        exp: (now + 60 * 60 * 24 * 7) as usize,
        iat: now as usize,
    };

    let secret = jwt_secret().map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Falta definir JWT_SECRET".to_string(),
        )
    })?;

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "No se pudo firmar el JWT".to_string(),
        )
    })?;

    Ok(Json(serde_json::json!({
        "status": "success",
        "message": "Usuario registrado exitosamente",
        "token": token,
        "device_id": device_id,
        "username": username
    })))
}

pub async fn login_handler(
    State(state): State<AppState>,
    Json(payload): Json<LoginPayload>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let username = payload.username.trim().to_lowercase();
    let password = payload.password.trim();
    let device_name = payload.device_name.trim().to_string();
    let device_type = payload.device_type.trim().to_string();

    if username.is_empty() || password.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "Credenciales inválidas".to_string(),
        ));
    }

    if device_name.is_empty() || device_type.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "Datos de dispositivo inválidos".to_string(),
        ));
    }

    let user = sqlx::query!(
        "SELECT id, username, password_hash FROM users WHERE username = ? LIMIT 1",
        username
    )
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Error DB: {}", e),
        )
    })?;

    let user_row = match user {
        Some(row) => row,
        None => {
            return Err((
                StatusCode::UNAUTHORIZED,
                "Usuario o contraseña incorrectos".to_string(),
            ))
        }
    };

    let parsed_hash = PasswordHash::new(&user_row.password_hash).map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Hash de base de datos corrupto".to_string(),
        )
    })?;

    let argon2 = Argon2::default();
    if argon2
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_err()
    {
        return Err((
            StatusCode::UNAUTHORIZED,
            "Usuario o contraseña incorrectos".to_string(),
        ));
    }

    let device_id = Uuid::new_v4().to_string();

    sqlx::query!(
        "INSERT INTO devices (id, user_id, device_name, device_type) VALUES (?, ?, ?, ?)",
        device_id,
        user_row.id as i64,
        device_name,
        device_type
    )
    .execute(&state.db)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Error vinculando dispositivo: {}", e),
        )
    })?;

    let now = unix_now().map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Reloj del sistema inválido".to_string(),
        )
    })?;

    let claims = Claims {
        sub: user_row.id as i64,
        device_id: device_id.clone(),
        exp: (now + 60 * 60 * 24 * 7) as usize,
        iat: now as usize,
    };

    let secret = jwt_secret().map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Falta JWT_SECRET".to_string(),
        )
    })?;

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "No se pudo firmar el JWT".to_string(),
        )
    })?;

    Ok(Json(serde_json::json!({
        "status": "success",
        "message": "Login exitoso",
        "token": token,
        "device_id": device_id,
        "username": user_row.username
    })))
}

pub async fn me_handler(
    State(state): State<AppState>,
    axum::Extension(auth): axum::Extension<AuthContext>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
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
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Error DB: {}", e),
        )
    })?;

    match row {
        Some(r) => Ok(Json(serde_json::json!({
            "status": "success",
            "user_id": auth.user_id,
            "username": r.username,
            "device": {
                "id": auth.device_id,
                "name": r.device_name,
                "type": r.device_type
            }
        }))),
        None => Err((StatusCode::UNAUTHORIZED, "Sesión inválida".to_string())),
    }
}

pub async fn logout_handler(
    State(state): State<AppState>,
    axum::Extension(auth): axum::Extension<AuthContext>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let result = sqlx::query!(
        "DELETE FROM devices WHERE id = ? AND user_id = ?",
        auth.device_id,
        auth.user_id
    )
    .execute(&state.db)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Error DB: {}", e),
        )
    })?;

    if result.rows_affected() == 0 {
        return Err((
            StatusCode::UNAUTHORIZED,
            "Sesión inválida o ya cerrada".to_string(),
        ));
    }

    Ok(Json(serde_json::json!({
        "status": "success",
        "message": "Logout exitoso"
    })))
}
