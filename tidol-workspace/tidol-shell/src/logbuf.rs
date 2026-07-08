//! Buffer de logs en memoria, alimentado por un `Layer` de `tracing`.
//!
//! El REPL registra **todo** el logging interno por `tracing` hacia `stderr`
//! (nunca `println!`), y además a este anillo acotado en memoria para que el
//! comando `logs` pueda consultarlo sin leer ficheros.

use std::collections::VecDeque;
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::SystemTime;

use tracing::field::{Field, Visit};
use tracing::{Event, Level, Subscriber};
use tracing_subscriber::layer::{Context, Layer};

/// Una entrada capturada del log.
#[derive(Clone, Debug)]
pub struct LogEntry {
    pub level: Level,
    pub target: String,
    pub message: String,
    pub at: SystemTime,
}

/// Handle compartido y clonable sobre el anillo de logs.
#[derive(Clone)]
pub struct LogHandle {
    inner: Arc<Mutex<VecDeque<LogEntry>>>,
    capacity: usize,
}

impl LogHandle {
    /// Crea un buffer que retiene como máximo `capacity` entradas (las más
    /// recientes; descarta las viejas).
    pub fn new(capacity: usize) -> Self {
        LogHandle {
            inner: Arc::new(Mutex::new(VecDeque::with_capacity(capacity.min(1024)))),
            capacity: capacity.max(1),
        }
    }

    /// Bloqueo tolerante a envenenamiento: nunca hace `unwrap` (regla #1).
    fn guard(&self) -> MutexGuard<'_, VecDeque<LogEntry>> {
        match self.inner.lock() {
            Ok(g) => g,
            Err(poisoned) => poisoned.into_inner(),
        }
    }

    fn push(&self, entry: LogEntry) {
        let mut buf = self.guard();
        if buf.len() == self.capacity {
            buf.pop_front();
        }
        buf.push_back(entry);
    }

    /// Devuelve una copia de las entradas, en orden cronológico.
    ///
    /// - `tail`: si es `Some(n)`, solo las últimas `n`.
    /// - `errors_only`: si es `true`, solo entradas de nivel `ERROR`.
    pub fn snapshot(&self, tail: Option<usize>, errors_only: bool) -> Vec<LogEntry> {
        let buf = self.guard();
        let mut out: Vec<LogEntry> = buf
            .iter()
            .filter(|e| !errors_only || e.level == Level::ERROR)
            .cloned()
            .collect();
        if let Some(n) = tail {
            let start = out.len().saturating_sub(n);
            out.drain(..start);
        }
        out
    }
}

/// `Layer` de `tracing` que vuelca cada evento al [`LogHandle`].
pub struct BufferLayer {
    handle: LogHandle,
}

impl BufferLayer {
    pub fn new(handle: LogHandle) -> Self {
        BufferLayer { handle }
    }
}

/// Extrae el campo `message` (y cualquier otro campo) de un evento de `tracing`.
#[derive(Default)]
struct MessageVisitor {
    message: String,
}

impl Visit for MessageVisitor {
    fn record_debug(&mut self, field: &Field, value: &dyn std::fmt::Debug) {
        if field.name() == "message" {
            self.message = format!("{value:?}");
            // `record_debug` de un &str Debug-formatea con comillas; las quitamos
            // para que el mensaje se lea limpio.
            if self.message.starts_with('"') && self.message.ends_with('"') && self.message.len() >= 2
            {
                self.message = self.message[1..self.message.len() - 1].to_string();
            }
        } else if !self.message.is_empty() {
            self.message.push_str(&format!(" {}={value:?}", field.name()));
        } else {
            self.message = format!("{}={value:?}", field.name());
        }
    }

    fn record_str(&mut self, field: &Field, value: &str) {
        if field.name() == "message" {
            self.message = value.to_string();
        } else if !self.message.is_empty() {
            self.message.push_str(&format!(" {}={value}", field.name()));
        } else {
            self.message = format!("{}={value}", field.name());
        }
    }
}

impl<S: Subscriber> Layer<S> for BufferLayer {
    fn on_event(&self, event: &Event<'_>, _ctx: Context<'_, S>) {
        let mut visitor = MessageVisitor::default();
        event.record(&mut visitor);
        let meta = event.metadata();
        self.handle.push(LogEntry {
            level: *meta.level(),
            target: meta.target().to_string(),
            message: visitor.message,
            at: SystemTime::now(),
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(level: Level, msg: &str) -> LogEntry {
        LogEntry {
            level,
            target: "t".into(),
            message: msg.into(),
            at: SystemTime::now(),
        }
    }

    #[test]
    fn buffer_acota_a_capacidad() {
        let h = LogHandle::new(2);
        h.push(entry(Level::INFO, "a"));
        h.push(entry(Level::INFO, "b"));
        h.push(entry(Level::INFO, "c"));
        let snap = h.snapshot(None, false);
        assert_eq!(snap.len(), 2);
        assert_eq!(snap[0].message, "b");
        assert_eq!(snap[1].message, "c");
    }

    #[test]
    fn snapshot_tail_devuelve_las_ultimas() {
        let h = LogHandle::new(10);
        for i in 0..5 {
            h.push(entry(Level::INFO, &i.to_string()));
        }
        let snap = h.snapshot(Some(2), false);
        assert_eq!(snap.len(), 2);
        assert_eq!(snap[0].message, "3");
        assert_eq!(snap[1].message, "4");
    }

    #[test]
    fn snapshot_errors_only_filtra() {
        let h = LogHandle::new(10);
        h.push(entry(Level::INFO, "info"));
        h.push(entry(Level::ERROR, "boom"));
        h.push(entry(Level::WARN, "warn"));
        let snap = h.snapshot(None, true);
        assert_eq!(snap.len(), 1);
        assert_eq!(snap[0].message, "boom");
    }

    #[test]
    fn snapshot_tail_mayor_que_len_no_panica() {
        let h = LogHandle::new(10);
        h.push(entry(Level::INFO, "a"));
        let snap = h.snapshot(Some(100), false);
        assert_eq!(snap.len(), 1);
    }
}
