//! Loop del REPL: rustyline (línea editable, historial, señales), despacho a
//! `commands::execute` y rendering. **Nunca** paniquea por entrada del usuario:
//! parse-errors y errores de backend se imprimen y devuelven el control al
//! prompt; Ctrl-C cancela la línea; Ctrl-D sale limpio guardando el historial.

use std::path::PathBuf;

use rustyline::error::ReadlineError;
use rustyline::DefaultEditor;
use tokio::runtime::Handle;

use crate::backend::{LocalAdmin, Mode, TidolBackend};
use crate::commands::{self, Command, Confirm, ExecCtx, Parsed};
use crate::logbuf::LogHandle;
use crate::render;

pub struct Repl {
    backend: Box<dyn TidolBackend>,
    /// `Some(_)` solo en local; `None` en prod. La ausencia es la garantía
    /// estructural de que los destructivos no existen en prod.
    admin: Option<Box<dyn LocalAdmin>>,
    mode: Mode,
    logs: LogHandle,
    handle: Handle,
    /// Solo se persiste a disco en local (en prod no se guarda historial).
    history_path: Option<PathBuf>,
}

impl Repl {
    pub fn new_local(
        backend: Box<dyn TidolBackend>,
        admin: Box<dyn LocalAdmin>,
        logs: LogHandle,
        handle: Handle,
    ) -> Self {
        Repl {
            backend,
            admin: Some(admin),
            mode: Mode::Local,
            logs,
            handle,
            history_path: history_path(),
        }
    }

    pub fn new_remote(backend: Box<dyn TidolBackend>, logs: LogHandle, handle: Handle) -> Self {
        Repl {
            backend,
            admin: None,
            mode: Mode::Prod,
            logs,
            handle,
            // En prod NO se persiste historial (regla de manejo de secretos).
            history_path: None,
        }
    }

    /// Corre el loop hasta `exit`/`quit`/Ctrl-D. Debe llamarse desde un hilo
    /// síncrono (fuera del runtime): usa `Handle::block_on` por comando.
    pub fn run(&mut self) {
        let mut editor = match DefaultEditor::new() {
            Ok(e) => e,
            Err(e) => {
                tracing::error!("no se pudo inicializar la línea de comandos: {e}");
                return;
            }
        };

        if let Some(path) = &self.history_path {
            let _ = editor.load_history(path);
        }

        tracing::info!("tidol-shell iniciado en modo {}", self.mode.label());
        self.print_banner();

        loop {
            let prompt = render::prompt(self.mode);
            match editor.readline(&prompt) {
                Ok(line) => {
                    if !self.handle_line(&line, &mut editor) {
                        break;
                    }
                }
                Err(ReadlineError::Interrupted) => {
                    // Ctrl-C: cancela la línea, NO sale.
                    println!("^C");
                }
                Err(ReadlineError::Eof) => {
                    // Ctrl-D: salida limpia.
                    break;
                }
                Err(e) => {
                    tracing::error!("error leyendo la línea: {e}");
                    break;
                }
            }
        }

        if let Some(path) = &self.history_path {
            let _ = editor.save_history(path);
        }
        println!("hasta luego.");
    }

    /// Procesa una línea. Devuelve `false` si hay que salir del loop.
    fn handle_line(&mut self, line: &str, editor: &mut DefaultEditor) -> bool {
        match commands::parse(line) {
            Parsed::Empty => true,
            Parsed::Message(msg) => {
                render::print_message(&msg);
                true
            }
            Parsed::Command(cmd) => {
                if cmd.is_exit() {
                    return false;
                }
                // Historial: nunca guardamos líneas que parezcan llevar secretos.
                if !looks_like_secret(line) {
                    let _ = editor.add_history_entry(line);
                }
                self.dispatch(cmd, editor);
                true
            }
        }
    }

    fn dispatch(&mut self, cmd: Command, editor: &mut DefaultEditor) {
        let mut confirmer = EditorConfirm { editor };
        let mut ctx = ExecCtx {
            backend: self.backend.as_ref(),
            admin: self.admin.as_deref(),
            logs: &self.logs,
            rt: &self.handle,
            confirm: &mut confirmer,
        };
        match commands::execute(cmd, &mut ctx) {
            Ok(out) => render::print_output(&out),
            Err(e) => {
                tracing::warn!("comando falló: {e}");
                render::print_error(&e);
            }
        }
    }

    fn print_banner(&self) {
        let target = match self.mode {
            Mode::Local => "modo LOCAL (BD directa; operaciones destructivas habilitadas)",
            Mode::Prod => "modo PROD (API HTTP; solo lectura/escritura segura)",
        };
        println!("tidol-shell {} — {}", env!("CARGO_PKG_VERSION"), target);
        println!("escribe `help` para ver los comandos, `exit` para salir.");
    }
}

/// Confirmador `y/N` basado en el editor de rustyline. Un Ctrl-C/Ctrl-D durante
/// la confirmación se interpreta como **no** (default seguro).
struct EditorConfirm<'e> {
    editor: &'e mut DefaultEditor,
}

impl Confirm for EditorConfirm<'_> {
    fn confirm(&mut self, prompt: &str) -> bool {
        match self.editor.readline(prompt) {
            Ok(ans) => {
                let a = ans.trim().to_lowercase();
                matches!(a.as_str(), "y" | "yes" | "s" | "si" | "sí")
            }
            Err(_) => false,
        }
    }
}

/// Heurística conservadora: si la línea menciona algo que huela a credencial, no
/// entra al historial. En nuestra gramática ningún comando toma secretos, pero
/// esto blinda futuros comandos que sí lo hagan.
fn looks_like_secret(line: &str) -> bool {
    let l = line.to_lowercase();
    [
        "token", "secret", "password", "passwd", "bearer", "apikey", "api-key", "api_key",
    ]
    .iter()
    .any(|k| l.contains(k))
}

/// Ruta del historial en local: `~/.config/tidol/shell_history`. Crea el
/// directorio si falta (ignorando errores: sin historial persistente el REPL
/// sigue funcionando).
fn history_path() -> Option<PathBuf> {
    let home = std::env::var_os("HOME")?;
    let dir = PathBuf::from(home).join(".config").join("tidol");
    let _ = std::fs::create_dir_all(&dir);
    Some(dir.join("shell_history"))
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    #[test]
    fn secret_filter_detecta_credenciales() {
        assert!(looks_like_secret("set token abc"));
        assert!(looks_like_secret("login --password hunter2"));
        assert!(looks_like_secret("x BEARER y"));
        assert!(!looks_like_secret("add artist Radiohead"));
        assert!(!looks_like_secret("link track T1 --mbid abc-123"));
    }

    struct Always(bool);
    impl Confirm for Always {
        fn confirm(&mut self, _: &str) -> bool {
            self.0
        }
    }

    #[test]
    fn confirm_trait_es_objeto_seguro() {
        // Comprueba que Confirm se puede usar como &mut dyn (lo que ExecCtx exige).
        let mut c = Always(true);
        let d: &mut dyn Confirm = &mut c;
        assert!(d.confirm("¿?"));
    }
}
