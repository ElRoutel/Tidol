//! Capa de rendering común. Toda la salida **al usuario** (resultados) pasa por
//! aquí y va a `stdout`; el logging interno va por `tracing` a `stderr`.
//!
//! `Output` centraliza el formateo para que agregar un comando no implique
//! reinventar tablas/colores.

use std::io::IsTerminal;
use std::time::SystemTime;

use comfy_table::{ContentArrangement, Table};
use owo_colors::OwoColorize;

use crate::backend::Mode;
use crate::error::BackendError;

/// Salida renderizable de un comando.
#[derive(Debug)]
pub enum Output {
    /// Tabla con cabecera, filas y una nota opcional al pie.
    Table {
        headers: Vec<String>,
        rows: Vec<Vec<String>>,
        note: Option<String>,
    },
    /// Texto libre (ya formateado).
    Text(String),
    /// Nada que mostrar.
    Empty,
}

impl Output {
    /// Azúcar para construir una tabla desde slices de `&str`.
    pub fn table(headers: &[&str], rows: Vec<Vec<String>>) -> Output {
        Output::Table {
            headers: headers.iter().map(|s| s.to_string()).collect(),
            rows,
            note: None,
        }
    }

    pub fn with_note(self, note: impl Into<String>) -> Output {
        match self {
            Output::Table { headers, rows, .. } => Output::Table {
                headers,
                rows,
                note: Some(note.into()),
            },
            other => other,
        }
    }
}

/// ¿Colorizamos? Solo si `stdout` es una terminal (no al redirigir a fichero).
fn color_on() -> bool {
    std::io::stdout().is_terminal()
}

/// Imprime la salida de un comando en `stdout`.
pub fn print_output(out: &Output) {
    match out {
        Output::Empty => println!("{}", dim("(sin resultados)")),
        Output::Text(t) => println!("{t}"),
        Output::Table {
            headers,
            rows,
            note,
        } => {
            if rows.is_empty() {
                println!("{}", dim("(sin resultados)"));
            } else {
                let mut table = Table::new();
                table
                    .load_preset(comfy_table::presets::UTF8_FULL)
                    .set_content_arrangement(ContentArrangement::Dynamic)
                    .set_header(headers.clone());
                for row in rows {
                    table.add_row(row.clone());
                }
                println!("{table}");
            }
            if let Some(n) = note {
                println!("{}", dim(n));
            }
        }
    }
}

/// Imprime un error de backend en rojo (y continúa el REPL).
pub fn print_error(err: &BackendError) {
    if color_on() {
        eprintln_stdout(&format!("{} {}", "error:".red().bold(), err));
    } else {
        eprintln_stdout(&format!("error: {err}"));
    }
}

/// Imprime un mensaje informativo/de parseo (p. ej. la ayuda de clap).
pub fn print_message(msg: &str) {
    // Los mensajes de clap ya traen su propio salto de línea final; lo recortamos.
    println!("{}", msg.trim_end());
}

/// El "error" del usuario también es resultado → va a stdout (la spec reserva
/// stderr para el logging interno de tracing).
fn eprintln_stdout(s: &str) {
    println!("{s}");
}

/// Prompt coloreado por modo, con los marcadores `\x01`/`\x02` que rustyline
/// necesita para no descuadrar el ancho al contar caracteres no imprimibles.
pub fn prompt(mode: Mode) -> String {
    let label = match mode {
        Mode::Local => "TidolCore> ",
        Mode::Prod => "Tidol(prod)> ",
    };
    if !color_on() {
        return label.to_string();
    }
    // 32 = verde (local), 31 = rojo (prod), ambos en negrita.
    let code = match mode {
        Mode::Local => 32,
        Mode::Prod => 31,
    };
    format!("\x01\x1b[1;{code}m\x02{label}\x01\x1b[0m\x02")
}

/// "ok" verde / "fail" rojo para los chequeos de `health`.
pub fn ok_flag(ok: bool) -> String {
    if !color_on() {
        return if ok { "ok".into() } else { "FAIL".into() };
    }
    if ok {
        "ok".green().bold().to_string()
    } else {
        "FAIL".red().bold().to_string()
    }
}

fn dim(s: &str) -> String {
    if color_on() {
        s.dimmed().to_string()
    } else {
        s.to_string()
    }
}

/// Trunca una celda larga para que las tablas no exploten horizontalmente.
pub fn cell(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        return s.to_string();
    }
    let truncated: String = s.chars().take(max.saturating_sub(1)).collect();
    format!("{truncated}…")
}

/// Formatea un `Option<i32>` de segundos como `m:ss`, o `-` si es `None`.
pub fn duration(secs: Option<i32>) -> String {
    match secs {
        Some(s) if s >= 0 => format!("{}:{:02}", s / 60, s % 60),
        _ => "-".to_string(),
    }
}

/// Formatea un `Option<String>` como su valor o `-`.
pub fn opt(s: &Option<String>) -> String {
    s.clone().unwrap_or_else(|| "-".to_string())
}

/// Antigüedad de un evento como `"<n>s"` (segundos desde que se registró).
pub fn age(t: SystemTime) -> String {
    match t.elapsed() {
        Ok(d) => format!("{}s", d.as_secs()),
        // Reloj hacia atrás: no es un error del usuario, mostramos 0.
        Err(_) => "0s".to_string(),
    }
}
