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

/// Prompt coloreado por modo.
///
/// El ANSI va **crudo**, sin envolver en `\x01`/`\x02`: esos marcadores son
/// `RL_PROMPT_{START,END}_IGNORE` de GNU readline, y rustyline no los conoce.
/// Su `width()` solo sabe saltarse secuencias de escape; cualquier otro byte cae
/// en `unicode_width`, que cuenta los controles C0 como una columna. Envolverlos
/// hacía que rustyline midiese el prompt 4 columnas más ancho de lo que es y
/// desplazaba el cursor. rustyline ya ignora el ANSI por sí solo.
pub fn prompt(mode: Mode) -> String {
    prompt_with_color(mode, color_on())
}

/// Núcleo testeable de [`prompt`]: `color_on()` mira si stdout es una TTY, y bajo
/// `cargo test` nunca lo es.
fn prompt_with_color(mode: Mode, color: bool) -> String {
    let label = match mode {
        Mode::Local => "TidolCore> ",
        Mode::Prod => "Tidol(prod)> ",
    };
    if !color {
        return label.to_string();
    }
    // 32 = verde (local), 31 = rojo (prod), ambos en negrita.
    let code = match mode {
        Mode::Local => 32,
        Mode::Prod => 31,
    };
    format!("\x1b[1;{code}m{label}\x1b[0m")
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

#[cfg(test)]
mod tests {
    use super::*;

    /// Réplica del cálculo de ancho de rustyline (`tty/mod.rs`, `fn width`): salta
    /// las secuencias ANSI y cuenta todo lo demás. Nótese que un `\x01` **suma
    /// una columna**, igual que en `unicode_width`: ahí estaba el bug, y por eso
    /// el helper debe contarlo en vez de ignorarlo.
    fn visible_width(s: &str) -> usize {
        let mut esc = 0u8;
        let mut w = 0usize;
        for c in s.chars() {
            match esc {
                1 => esc = if c == '[' { 2 } else { 0 },
                2 => {
                    if !(c == ';' || c.is_ascii_digit()) {
                        esc = 0;
                    }
                }
                _ if c == '\x1b' => esc = 1,
                _ if c == '\n' => {}
                _ => w += 1,
            }
        }
        w
    }

    #[test]
    fn visible_width_cuenta_lo_que_cuenta_rustyline() {
        assert_eq!(visible_width("abc"), 3);
        assert_eq!(visible_width("\x1b[1;32mabc\x1b[0m"), 3);
        // Un marcador de readline NO es invisible para rustyline.
        assert_eq!(visible_width("\x01abc\x02"), 5);
    }

    #[test]
    fn prompt_coloreado_mide_lo_mismo_que_sin_color() {
        for mode in [Mode::Local, Mode::Prod] {
            let plano = prompt_with_color(mode, false);
            let coloreado = prompt_with_color(mode, true);
            assert_eq!(
                visible_width(&coloreado),
                plano.chars().count(),
                "el color no debe alterar el ancho visible del prompt en {mode:?}"
            );
        }
    }

    #[test]
    fn prompt_tiene_el_ancho_visible_esperado() {
        assert_eq!(visible_width(&prompt_with_color(Mode::Local, true)), 11);
        assert_eq!(visible_width(&prompt_with_color(Mode::Prod, true)), 13);
    }

    /// Guardia directa contra la regresión: `\x01`/`\x02` son de GNU readline y
    /// rustyline los cuenta como ancho visible → prompt desplazado.
    #[test]
    fn prompt_no_lleva_marcadores_de_readline() {
        for mode in [Mode::Local, Mode::Prod] {
            let p = prompt_with_color(mode, true);
            assert!(!p.contains('\x01'), "prompt con SOH en {mode:?}");
            assert!(!p.contains('\x02'), "prompt con STX en {mode:?}");
        }
    }

    #[test]
    fn prompt_sin_color_es_el_label_pelado() {
        assert_eq!(prompt_with_color(Mode::Local, false), "TidolCore> ");
        assert_eq!(prompt_with_color(Mode::Prod, false), "Tidol(prod)> ");
    }
}
