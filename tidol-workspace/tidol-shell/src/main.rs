// =========================================================================
// tidol-shell — REPL de administración para Tidol.
//
// Binario delgado sobre `tidol-core`: solo parsing de comandos, despacho a un
// trait de backend, y rendering. Sin lógica de dominio.
// =========================================================================
#![deny(clippy::unwrap_used)]
// Permitimos unwrap/expect SOLO en compilaciones de test (regla #1: cero panics
// provocables desde el prompt; los tests sí pueden asertar con unwrap).
#![cfg_attr(test, allow(clippy::unwrap_used))]

mod backend;
mod commands;
mod error;
mod logbuf;
mod render;
mod repl;

use std::process::ExitCode;
use std::sync::Arc;
use std::time::Instant;

use tidol_core::{config::CoreConfig, TidolCore};

use backend::local::LocalBackend;
use backend::remote::RemoteBackend;
use backend::{LocalAdmin, TidolBackend};
use logbuf::{BufferLayer, LogHandle};
use repl::Repl;

/// Servicio del keyring (agrupa las credenciales de tidol).
const KEYRING_SERVICE: &str = "tidol";
/// Cuenta del keyring por perfil: `<perfil>-token` (el default "prod" da
/// "prod-token", como indica la especificación).
fn keyring_account(profile: &str) -> String {
    format!("{profile}-token")
}

fn main() -> ExitCode {
    let logs = LogHandle::new(2000);
    init_tracing(logs.clone());

    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.iter().any(|a| a == "-h" || a == "--help") {
        print!("{USAGE}");
        return ExitCode::SUCCESS;
    }

    let cli = match parse_cli(&args) {
        Ok(c) => c,
        Err(msg) => {
            eprintln!("{msg}");
            return ExitCode::from(2);
        }
    };

    let rt = match tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
    {
        Ok(rt) => rt,
        Err(e) => {
            tracing::error!("no se pudo crear el runtime tokio: {e}");
            return ExitCode::FAILURE;
        }
    };

    if cli.store_token {
        let profile = cli.remote.as_deref().unwrap_or("prod");
        return store_token(profile);
    }

    match cli.remote {
        Some(profile) => run_remote(&rt, logs, &profile),
        None => run_local(&rt, logs),
    }
}

// -------------------------------------------------------------------------
// CLI
// -------------------------------------------------------------------------
const USAGE: &str = "\
tidol-shell — REPL de administración de Tidol

USO:
  tidol-shell                      Modo LOCAL (habla directo con tidol-core/BD).
  tidol-shell --remote [PERFIL]    Modo PROD (habla con la API de tidol-server).
                                   PERFIL por defecto: `prod`.
  tidol-shell --remote [PERFIL] --store-token
                                   Guarda en el keyring el token leído de la env
                                   var TIDOL_PROD_TOKEN (no del prompt ni argv).

ENTORNO:
  Local: DATABASE_URL (obligatoria) y las mismas vars que tidol-server (.env).
  Prod:  TIDOL_PROD_URL o ~/.config/tidol/<perfil>.url; token en el keyring.
";

struct Cli {
    remote: Option<String>,
    store_token: bool,
}

fn parse_cli(args: &[String]) -> Result<Cli, String> {
    let mut remote = None;
    let mut store_token = false;
    let mut it = args.iter().peekable();
    while let Some(a) = it.next() {
        match a.as_str() {
            "--remote" => {
                let profile = match it.peek() {
                    Some(p) if !p.starts_with('-') => {
                        let p = (*p).clone();
                        it.next();
                        p
                    }
                    _ => "prod".to_string(),
                };
                remote = Some(profile);
            }
            "--store-token" => store_token = true,
            other => {
                return Err(format!("argumento desconocido: {other}\n\n{USAGE}"));
            }
        }
    }
    if store_token && remote.is_none() {
        remote = Some("prod".to_string());
    }
    Ok(Cli {
        remote,
        store_token,
    })
}

// -------------------------------------------------------------------------
// LOGGING (tracing → stderr + buffer en memoria para el comando `logs`)
// -------------------------------------------------------------------------
fn init_tracing(logs: LogHandle) {
    use std::io::IsTerminal;
    use tracing_subscriber::prelude::*;
    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("tidol_shell=info,tidol_core=warn"));
    // Sin colores ANSI cuando stderr no es una terminal (evita basura al redirigir).
    let fmt = tracing_subscriber::fmt::layer()
        .with_ansi(std::io::stderr().is_terminal())
        .with_writer(std::io::stderr);
    // `try_init` evita el panic por doble inicialización.
    let _ = tracing_subscriber::registry()
        .with(filter)
        .with(fmt)
        .with(BufferLayer::new(logs))
        .try_init();
}

// -------------------------------------------------------------------------
// MODO LOCAL
// -------------------------------------------------------------------------
fn run_local(rt: &tokio::runtime::Runtime, logs: LogHandle) -> ExitCode {
    dotenvy::dotenv().ok();

    let config = match core_config_from_env() {
        Ok(c) => c,
        Err(msg) => {
            eprintln!("configuración inválida: {msg}");
            return ExitCode::FAILURE;
        }
    };
    let redacted = redact_db_url(&config.database_url);
    let plugins_dir = config.plugins_dir.clone();

    let core = match rt.block_on(TidolCore::new(config)) {
        Ok(c) => Arc::new(c),
        Err(e) => {
            eprintln!("no se pudo iniciar el núcleo (¿BD inalcanzable?): {e}");
            return ExitCode::FAILURE;
        }
    };

    let started = Instant::now();
    // Dos instancias que comparten el mismo Arc<TidolCore> y el mismo inicio:
    // una como backend común, otra como admin solo-local (estructura del spec).
    let backend: Box<dyn TidolBackend> = Box::new(LocalBackend::new(
        core.clone(),
        started,
        redacted.clone(),
        plugins_dir.clone(),
    ));
    let admin: Box<dyn LocalAdmin> =
        Box::new(LocalBackend::new(core, started, redacted, plugins_dir));

    let mut repl = Repl::new_local(backend, admin, logs, rt.handle().clone());
    repl.run();
    ExitCode::SUCCESS
}

/// Construye `CoreConfig` desde el entorno, igual que `tidol-server`.
fn core_config_from_env() -> Result<CoreConfig, String> {
    let database_url = std::env::var("DATABASE_URL")
        .map_err(|_| "DATABASE_URL no está definida (requerida en modo local)".to_string())?;
    let database_max_connections = std::env::var("DATABASE_MAX_CONNECTIONS")
        .ok()
        .and_then(|v| v.parse::<u32>().ok())
        .unwrap_or(100);
    let proxy_pool: Vec<String> = std::env::var("PROXY_POOL")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .map(|s| s.split(',').map(|u| u.trim().to_string()).collect())
        .unwrap_or_else(|| vec!["direct".to_string()]);
    let default_plugins_dir = concat!(env!("CARGO_MANIFEST_DIR"), "/../target/debug");
    let plugins_dir =
        std::env::var("PLUGINS_DIR").unwrap_or_else(|_| default_plugins_dir.to_string());

    Ok(CoreConfig {
        database_url,
        database_max_connections,
        proxy_pool,
        plugins_dir,
        youtube_api_key: std::env::var("YOUTUBE_API_KEY").unwrap_or_default(),
        spotify_client_id: std::env::var("SPOTIFY_CLIENT_ID").unwrap_or_default(),
        spotify_client_secret: std::env::var("SPOTIFY_CLIENT_SECRET").unwrap_or_default(),
        soundcloud_client_id: std::env::var("SOUNDCLOUD_CLIENT_ID").unwrap_or_default(),
        jwt_secret: std::env::var("JWT_SECRET").ok(),
    })
}

/// Redacta la contraseña de una URL `scheme://user:pass@host/...` → `user:***@`.
fn redact_db_url(url: &str) -> String {
    let Some(scheme_end) = url.find("://") else {
        return url.to_string();
    };
    let (scheme, rest) = url.split_at(scheme_end + 3);
    let Some(at) = rest.find('@') else {
        return url.to_string();
    };
    let creds = &rest[..at];
    let after = &rest[at..];
    match creds.find(':') {
        Some(colon) => format!("{scheme}{}:***{after}", &creds[..colon]),
        None => url.to_string(),
    }
}

// -------------------------------------------------------------------------
// MODO PROD
// -------------------------------------------------------------------------
fn run_remote(rt: &tokio::runtime::Runtime, logs: LogHandle, profile: &str) -> ExitCode {
    let base_url = match prod_base_url(profile) {
        Ok(u) => u,
        Err(msg) => {
            eprintln!("{msg}");
            return ExitCode::FAILURE;
        }
    };

    let token = match load_token(profile) {
        TokenOutcome::Found(t) => t,
        TokenOutcome::Missing => {
            print_store_instructions(profile);
            // Salida limpia: no pedimos el token por prompt en texto plano.
            return ExitCode::SUCCESS;
        }
        TokenOutcome::Error(e) => {
            eprintln!("error accediendo al keyring: {e}");
            return ExitCode::FAILURE;
        }
    };

    let started = Instant::now();
    let backend: Box<dyn TidolBackend> = match RemoteBackend::new(base_url, token, started) {
        Ok(b) => Box::new(b),
        Err(e) => {
            eprintln!("no se pudo crear el backend remoto: {e}");
            return ExitCode::FAILURE;
        }
    };

    let mut repl = Repl::new_remote(backend, logs, rt.handle().clone());
    repl.run();
    ExitCode::SUCCESS
}

fn prod_base_url(profile: &str) -> Result<String, String> {
    if let Ok(u) = std::env::var("TIDOL_PROD_URL") {
        if !u.trim().is_empty() {
            return Ok(u.trim().to_string());
        }
    }
    if let Some(home) = std::env::var_os("HOME") {
        let path = std::path::PathBuf::from(home)
            .join(".config")
            .join("tidol")
            .join(format!("{profile}.url"));
        if let Ok(contents) = std::fs::read_to_string(&path) {
            let u = contents.trim();
            if !u.is_empty() {
                return Ok(u.to_string());
            }
        }
    }
    Err(format!(
        "falta la URL de prod para el perfil '{profile}'. Define TIDOL_PROD_URL o crea \
         ~/.config/tidol/{profile}.url con la base_url (p. ej. https://api.tidol.example)."
    ))
}

enum TokenOutcome {
    Found(String),
    Missing,
    Error(String),
}

fn load_token(profile: &str) -> TokenOutcome {
    let account = keyring_account(profile);
    let entry = match keyring::Entry::new(KEYRING_SERVICE, &account) {
        Ok(e) => e,
        Err(e) => return TokenOutcome::Error(e.to_string()),
    };
    match entry.get_password() {
        Ok(t) => TokenOutcome::Found(t),
        Err(keyring::Error::NoEntry) => TokenOutcome::Missing,
        Err(e) => TokenOutcome::Error(e.to_string()),
    }
}

/// Guarda el token en el keyring leyéndolo de `TIDOL_PROD_TOKEN` (nunca de argv
/// ni del prompt: así no entra al historial de la shell del usuario).
fn store_token(profile: &str) -> ExitCode {
    let token = match std::env::var("TIDOL_PROD_TOKEN") {
        Ok(t) if !t.trim().is_empty() => t,
        _ => {
            eprintln!(
                "define el token en la env var TIDOL_PROD_TOKEN antes de --store-token, p. ej.:\n\
                 \n  export TIDOL_PROD_TOKEN='...'\n  tidol-shell --remote {profile} --store-token\n  unset TIDOL_PROD_TOKEN"
            );
            return ExitCode::from(2);
        }
    };
    let account = keyring_account(profile);
    let entry = match keyring::Entry::new(KEYRING_SERVICE, &account) {
        Ok(e) => e,
        Err(e) => {
            eprintln!("error accediendo al keyring: {e}");
            return ExitCode::FAILURE;
        }
    };
    match entry.set_password(&token) {
        Ok(()) => {
            println!("token guardado en el keyring ({KEYRING_SERVICE}/{account}).");
            ExitCode::SUCCESS
        }
        Err(e) => {
            eprintln!("no se pudo guardar el token: {e}");
            ExitCode::FAILURE
        }
    }
}

fn print_store_instructions(profile: &str) {
    let account = keyring_account(profile);
    eprintln!(
        "no hay token de prod en el keyring ({KEYRING_SERVICE}/{account}).\n\
         Guárdalo sin teclearlo en claro ni pasarlo por argumento:\n\
         \n  export TIDOL_PROD_TOKEN='<tu token>'\n  tidol-shell --remote {profile} --store-token\n  unset TIDOL_PROD_TOKEN\n"
    );
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    #[test]
    fn redact_oculta_password() {
        assert_eq!(
            redact_db_url("mysql://root:hunter2@localhost:3306/tidol"),
            "mysql://root:***@localhost:3306/tidol"
        );
    }

    #[test]
    fn redact_sin_password_no_cambia() {
        assert_eq!(redact_db_url("mysql://root@localhost/tidol"), "mysql://root@localhost/tidol");
        assert_eq!(redact_db_url("not a url"), "not a url");
    }

    #[test]
    fn parse_cli_local_por_defecto() {
        let cli = parse_cli(&[]).unwrap();
        assert!(cli.remote.is_none());
        assert!(!cli.store_token);
    }

    #[test]
    fn parse_cli_remote_con_y_sin_perfil() {
        let cli = parse_cli(&["--remote".into(), "staging".into()]).unwrap();
        assert_eq!(cli.remote.as_deref(), Some("staging"));

        let cli = parse_cli(&["--remote".into()]).unwrap();
        assert_eq!(cli.remote.as_deref(), Some("prod"));
    }

    #[test]
    fn parse_cli_store_token_implica_perfil() {
        let cli = parse_cli(&["--store-token".into()]).unwrap();
        assert!(cli.store_token);
        assert_eq!(cli.remote.as_deref(), Some("prod"));
    }

    #[test]
    fn parse_cli_desconocido_es_error() {
        assert!(parse_cli(&["--wat".into()]).is_err());
    }

    #[test]
    fn keyring_account_por_perfil() {
        assert_eq!(keyring_account("prod"), "prod-token");
        assert_eq!(keyring_account("staging"), "staging-token");
    }
}
