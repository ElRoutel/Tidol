//! Definición **y** ejecución de comandos.
//!
//! El grammar es un enum de `clap` (derive) parseado por línea con
//! `try_parse_from`, de modo que cualquier error de parseo es un `Err`
//! recuperable (nunca `process::exit`). La ejecución es un `match` sobre ese
//! enum.
//!
//! ## ¿Por qué un `match` y no un registro de `trait Command`?
//! El conjunto de comandos es un enum pequeño y cerrado, y `clap` ya nos da el
//! despacho tipado. Un `match` centralizado mantiene **a la vista** la guarda de
//! modo (`admin.is_some()`) que protege las operaciones destructivas — el punto
//! más sensible de seguridad. Un registro de objetos-trait dispersaría esa
//! guarda por muchos sitios. Agregar un comando sigue siendo: una variante del
//! enum + un brazo del `match` (+ si aplica, un método del trait de backend).

use clap::{Parser, Subcommand};

use crate::backend::{LocalAdmin, SearchResponse, TidolBackend};
use crate::error::{BackendError, BackendResult};
use crate::logbuf::LogHandle;
use crate::render::{self, cell, duration, opt, Output};

const DEFAULT_LIMIT: u32 = 50;

// =========================================================================
// GRAMMAR (clap)
// =========================================================================
/// Una línea del REPL. `no_binary_name`: el primer token ya es el comando.
#[derive(Parser, Debug)]
#[command(
    name = "tidol",
    about = "REPL de administración de Tidol",
    no_binary_name = true,
    disable_version_flag = true,
    disable_help_subcommand = true
)]
struct Line {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand, Debug, PartialEq, Eq)]
pub enum Command {
    /// Inspecciona artistas / álbumes / pistas.
    #[command(subcommand)]
    Show(ShowCmd),

    /// Describe un recurso en detalle.
    #[command(subcommand)]
    Describe(DescribeCmd),

    /// Busca en el catálogo (MusicBrainz — legal).
    Search {
        #[arg(required = true, num_args = 1.., value_name = "QUERY")]
        query: Vec<String>,
    },

    /// Conteos agregados de la biblioteca.
    Stats,

    /// Alta segura de recursos (disponible en ambos modos).
    #[command(subcommand)]
    Add(AddCmd),

    /// Enlaza recursos con su identificador canónico.
    #[command(subcommand)]
    Link(LinkCmd),

    /// Estado del backend: modo, conexión, versión, uptime.
    Status,

    /// Muestra el log interno en memoria.
    Logs {
        #[arg(long, value_name = "N")]
        tail: Option<usize>,
        #[arg(long)]
        errors: bool,
    },

    /// Chequeo de salud (BD/API alcanzable; rutas locales).
    Health,

    /// Ingesta archivos de audio YA presentes en disco (solo-local).
    Import {
        #[arg(value_name = "RUTA")]
        path: String,
    },

    /// Operaciones destructivas (solo-local).
    #[command(subcommand)]
    Delete(DeleteCmd),

    /// Ejecuta una migración con nombre (solo-local).
    Migrate {
        name: String,
        #[arg(long)]
        yes: bool,
    },

    /// Ayuda general o de un comando concreto.
    Help { topic: Option<String> },

    /// Sale del REPL guardando el historial.
    Exit,

    /// Alias de `exit`.
    Quit,
}

#[derive(Subcommand, Debug, PartialEq, Eq)]
pub enum ShowCmd {
    /// Lista artistas.
    Artists {
        #[arg(long, value_name = "N")]
        limit: Option<u32>,
    },
    /// Lista álbumes (opcionalmente de un artista).
    Albums {
        #[arg(long, value_name = "ID")]
        artist: Option<String>,
    },
    /// Lista pistas (por álbum y/o artista).
    Tracks {
        #[arg(long, value_name = "ID")]
        album: Option<String>,
        #[arg(long, value_name = "ID")]
        artist: Option<String>,
        #[arg(long, value_name = "N")]
        limit: Option<u32>,
    },
}

#[derive(Subcommand, Debug, PartialEq, Eq)]
pub enum DescribeCmd {
    /// Metadatos de una pista por id.
    Track { id: String },
}

#[derive(Subcommand, Debug, PartialEq, Eq)]
pub enum AddCmd {
    /// Crea un artista (con `--mbid` opcional; sin él, `mbid = NULL`).
    Artist {
        #[arg(required = true, num_args = 1.., value_name = "NOMBRE")]
        name: Vec<String>,
        #[arg(long, value_name = "MBID")]
        mbid: Option<String>,
    },
}

#[derive(Subcommand, Debug, PartialEq, Eq)]
pub enum LinkCmd {
    /// Enlaza una pista con un MBID canónico.
    Track {
        id: String,
        #[arg(long, value_name = "MBID", required = true)]
        mbid: String,
    },
}

#[derive(Subcommand, Debug, PartialEq, Eq)]
pub enum DeleteCmd {
    /// Borra un artista (`--cascade` elimina dependientes).
    Artist {
        id: String,
        #[arg(long)]
        cascade: bool,
        #[arg(long)]
        yes: bool,
    },
    /// Borra una pista.
    Track {
        id: String,
        #[arg(long)]
        yes: bool,
    },
}

// =========================================================================
// PARSING
// =========================================================================
/// Resultado de parsear una línea del prompt.
pub enum Parsed {
    /// Línea vacía o solo espacios: no hace nada.
    Empty,
    /// Comando válido.
    Command(Command),
    /// Mensaje a imprimir tal cual (ayuda de clap, o error de parseo). El REPL
    /// **continúa**: nunca es un pánico ni un exit.
    Message(String),
}

/// Tokeniza (respetando comillas) y parsea una línea. **Nunca paniquea.**
pub fn parse(line: &str) -> Parsed {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return Parsed::Empty;
    }
    let tokens = match shell_words::split(trimmed) {
        Ok(t) => t,
        Err(_) => {
            return Parsed::Message(
                "comillas sin cerrar en la entrada; revisa el uso de \" y '".to_string(),
            )
        }
    };
    if tokens.is_empty() {
        return Parsed::Empty;
    }
    match Line::try_parse_from(tokens) {
        Ok(line) => Parsed::Command(line.command),
        // Incluye tanto errores de parseo como la salida de `--help`.
        Err(e) => Parsed::Message(e.to_string()),
    }
}

impl Command {
    /// ¿Es un comando de salida?
    pub fn is_exit(&self) -> bool {
        matches!(self, Command::Exit | Command::Quit)
    }
}

// =========================================================================
// EJECUCIÓN
// =========================================================================
/// Cómo pedir confirmación `y/N` al usuario (abstraído para poder testear).
pub trait Confirm {
    fn confirm(&mut self, prompt: &str) -> bool;
}

/// Contexto de ejecución: referencias a los backends, logs, runtime y confirmador.
pub struct ExecCtx<'a> {
    pub backend: &'a dyn TidolBackend,
    /// `Some` solo en local. Su ausencia es la guarda estructural del modo prod.
    pub admin: Option<&'a dyn LocalAdmin>,
    pub logs: &'a LogHandle,
    pub rt: &'a tokio::runtime::Handle,
    pub confirm: &'a mut dyn Confirm,
}

impl<'a> ExecCtx<'a> {
    /// Extrae el `LocalAdmin` o falla con `NotPermitted` **antes** de tocar nada.
    ///
    /// Devuelve la referencia con la vida `'a` (copiada del `Option`, que es
    /// `Copy`), no atada al préstamo de `&self`; así el llamante puede seguir
    /// tomando `ctx.confirm` en préstamo mutable sin conflicto.
    fn require_admin(&self) -> BackendResult<&'a dyn LocalAdmin> {
        self.admin.ok_or_else(|| {
            BackendError::NotPermitted(
                "este comando solo está disponible en modo local".to_string(),
            )
        })
    }
}

/// Ejecuta un comando ya parseado. Devuelve el `Output` a renderizar o un error
/// tipado. Los comandos de salida (`exit`/`quit`) los intercepta el loop antes
/// de llegar aquí; sus brazos son defensivos.
pub fn execute(cmd: Command, ctx: &mut ExecCtx) -> BackendResult<Output> {
    match cmd {
        Command::Show(ShowCmd::Artists { limit }) => {
            let items = ctx
                .rt
                .block_on(ctx.backend.list_artists(limit.unwrap_or(DEFAULT_LIMIT)))?;
            let rows = items
                .into_iter()
                .map(|a| vec![a.id, cell(&a.name, 48), opt(&a.image_url)])
                .collect();
            Ok(Output::table(&["id", "nombre", "imagen"], rows))
        }

        Command::Show(ShowCmd::Albums { artist }) => {
            let items = ctx
                .rt
                .block_on(ctx.backend.list_albums(artist.as_deref(), DEFAULT_LIMIT))?;
            let rows = items
                .into_iter()
                .map(|a| {
                    vec![
                        a.id,
                        cell(&a.title, 40),
                        opt(&a.artist_name),
                        a.release_year.map(|y| y.to_string()).unwrap_or_else(|| "-".into()),
                    ]
                })
                .collect();
            Ok(Output::table(&["id", "título", "artista", "año"], rows))
        }

        Command::Show(ShowCmd::Tracks {
            album,
            artist,
            limit,
        }) => {
            let items = ctx.rt.block_on(ctx.backend.list_tracks(
                album.as_deref(),
                artist.as_deref(),
                limit.unwrap_or(DEFAULT_LIMIT),
            ))?;
            let rows = items
                .into_iter()
                .map(|t| {
                    vec![
                        t.track_id,
                        cell(&t.track_name, 40),
                        opt(&t.artist_name),
                        duration(t.duration_seconds),
                    ]
                })
                .collect();
            Ok(Output::table(&["id", "título", "artista", "dur"], rows))
        }

        Command::Describe(DescribeCmd::Track { id }) => {
            let t = ctx.rt.block_on(ctx.backend.describe_track(&id))?;
            let text = format!(
                "id:       {}\ntítulo:   {}\nartista:  {}\nálbum:    {}\nduración: {}\nletras:   {}\ncover:    {}",
                t.track_id,
                t.track_name,
                opt(&t.artist_name),
                opt(&t.album_name),
                duration(t.duration_seconds),
                if t.has_lyrics { "sí" } else { "no" },
                opt(&t.cover_art_url),
            );
            Ok(Output::Text(text))
        }

        Command::Search { query } => {
            let q = query.join(" ");
            if q.trim().is_empty() {
                return Err(BackendError::Invalid("la consulta está vacía".into()));
            }
            let res = ctx.rt.block_on(ctx.backend.search(&q, 20))?;
            Ok(render_search(&res))
        }

        Command::Stats => {
            let s = ctx.rt.block_on(ctx.backend.stats())?;
            Ok(Output::table(
                &["métrica", "valor"],
                vec![
                    vec!["artistas".into(), s.artists.to_string()],
                    vec!["álbumes".into(), s.albums.to_string()],
                    vec!["pistas".into(), s.tracks.to_string()],
                    vec!["enlaces".into(), s.links.to_string()],
                ],
            ))
        }

        Command::Add(AddCmd::Artist { name, mbid }) => {
            let name = name.join(" ");
            if name.trim().is_empty() {
                return Err(BackendError::Invalid("el nombre está vacío".into()));
            }
            let a = ctx
                .rt
                .block_on(ctx.backend.add_artist(&name, mbid.as_deref()))?;
            Ok(Output::Text(format!(
                "artista creado: {} ({})",
                a.name, a.id
            )))
        }

        Command::Link(LinkCmd::Track { id, mbid }) => {
            ctx.rt.block_on(ctx.backend.link_track_mbid(&id, &mbid))?;
            Ok(Output::Text(format!("pista {id} enlazada a mbid {mbid}")))
        }

        Command::Status => {
            let s = ctx.rt.block_on(ctx.backend.status())?;
            let uptime = s.uptime.as_secs();
            Ok(Output::table(
                &["campo", "valor"],
                vec![
                    vec!["modo".into(), s.mode.label().to_string()],
                    vec![
                        "conectado".into(),
                        if s.connected { "sí".into() } else { "no".into() },
                    ],
                    vec!["destino".into(), s.target],
                    vec!["versión".into(), s.version],
                    vec![
                        "uptime".into(),
                        format!("{}m {}s", uptime / 60, uptime % 60),
                    ],
                ],
            ))
        }

        Command::Logs { tail, errors } => {
            let entries = ctx.logs.snapshot(tail, errors);
            if entries.is_empty() {
                return Ok(Output::Empty);
            }
            let rows = entries
                .into_iter()
                .map(|e| {
                    vec![
                        render::age(e.at),
                        e.level.to_string(),
                        cell(&e.target, 28),
                        cell(&e.message, 80),
                    ]
                })
                .collect();
            Ok(Output::table(&["hace", "nivel", "target", "mensaje"], rows))
        }

        Command::Health => {
            let h = ctx.rt.block_on(ctx.backend.health())?;
            let rows = h
                .checks
                .into_iter()
                .map(|c| vec![c.name, render::ok_flag(c.ok), cell(&c.detail, 60)])
                .collect();
            Ok(Output::table(&["chequeo", "estado", "detalle"], rows))
        }

        // ── Solo-local: guarda de modo ANTES de tocar recurso alguno ──
        Command::Import { path } => {
            let admin = ctx.require_admin()?;
            let p = std::path::PathBuf::from(&path);
            let s = ctx.rt.block_on(admin.import_path(&p))?;
            Ok(Output::Text(format!(
                "import: {} escaneados, {} importados, {} omitidos",
                s.scanned, s.imported, s.skipped
            )))
        }

        Command::Delete(DeleteCmd::Artist { id, cascade, yes }) => {
            let admin = ctx.require_admin()?;
            if !yes
                && !ctx.confirm.confirm(&format!(
                    "¿Borrar artista {id}{}? [y/N] ",
                    if cascade { " EN CASCADA" } else { "" }
                ))
            {
                return Ok(Output::Text("cancelado".into()));
            }
            let n = ctx.rt.block_on(admin.delete_artist(&id, cascade))?;
            Ok(Output::Text(format!("{n} fila(s) borradas")))
        }

        Command::Delete(DeleteCmd::Track { id, yes }) => {
            let admin = ctx.require_admin()?;
            if !yes && !ctx.confirm.confirm(&format!("¿Borrar pista {id}? [y/N] ")) {
                return Ok(Output::Text("cancelado".into()));
            }
            let n = ctx.rt.block_on(admin.delete_track(&id))?;
            Ok(Output::Text(format!("{n} fila(s) borradas")))
        }

        Command::Migrate { name, yes } => {
            let admin = ctx.require_admin()?;
            if !yes && !ctx.confirm.confirm(&format!("¿Ejecutar migración '{name}'? [y/N] ")) {
                return Ok(Output::Text("cancelado".into()));
            }
            ctx.rt.block_on(admin.run_migration(&name))?;
            Ok(Output::Text(format!("migración '{name}' ejecutada")))
        }

        Command::Help { topic } => Ok(Output::Text(help_text(topic.as_deref()))),

        // Interceptados por el loop; brazos defensivos.
        Command::Exit | Command::Quit => Ok(Output::Empty),
    }
}

fn render_search(res: &SearchResponse) -> Output {
    let mut rows: Vec<Vec<String>> = Vec::new();
    if let Some(hit) = &res.canonical_hit {
        rows.push(vec![
            "canónico".into(),
            hit.track_id.clone(),
            cell(&hit.title, 40),
            hit.artist.clone(),
        ]);
    }
    for a in &res.artists {
        rows.push(vec![
            "artista".into(),
            a.mbid.clone(),
            cell(&a.name, 40),
            "-".into(),
        ]);
    }
    for t in &res.archive_results {
        rows.push(vec![
            "archive".into(),
            t.track_id.clone(),
            cell(&t.title, 40),
            t.artist.clone(),
        ]);
    }
    Output::table(&["tipo", "id", "título", "artista"], rows)
        .with_note(format!("query: '{}'", res.query))
}

const GENERAL_HELP: &str = "\
Comandos disponibles (usa `<comando> --help` para el detalle):

  Lectura (ambos modos):
    show artists [--limit N]
    show albums  [--artist ID]
    show tracks  [--album ID] [--artist ID] [--limit N]
    describe track <id>
    search <query...>
    stats

  Escritura segura (ambos modos):
    add artist <nombre> [--mbid MBID]
    link track <id> --mbid MBID

  Observabilidad (ambos modos):
    status
    logs [--tail N] [--errors]
    health

  Solo-local (requieren modo local):
    import <ruta>
    delete artist <id> [--cascade] [--yes]
    delete track <id> [--yes]
    migrate <nombre> [--yes]

  Meta:
    help [comando]
    exit | quit";

fn help_text(topic: Option<&str>) -> String {
    match topic {
        None => GENERAL_HELP.to_string(),
        Some(t) => match Line::try_parse_from([t, "--help"]) {
            Ok(_) => GENERAL_HELP.to_string(),
            Err(e) => e.to_string(),
        },
    }
}

// =========================================================================
// TESTS DEL PARSER (deliverable #8): entrada vacía, comando inexistente, flags
// malformados, comillas… y que NADA de esto paniquea.
// =========================================================================
#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;
    use crate::backend::{
        AlbumResponse, ArtistResponse, HealthReport, Stats, StatusInfo, TrackMetadataResponse,
    };

    fn cmd(line: &str) -> Command {
        match parse(line) {
            Parsed::Command(c) => c,
            other => panic!(
                "esperaba un comando para {line:?}, obtuve {}",
                match other {
                    Parsed::Empty => "Empty".to_string(),
                    Parsed::Message(m) => format!("Message({m})"),
                    Parsed::Command(_) => unreachable!(),
                }
            ),
        }
    }

    #[test]
    fn entrada_vacia_es_empty() {
        assert!(matches!(parse(""), Parsed::Empty));
        assert!(matches!(parse("    "), Parsed::Empty));
        assert!(matches!(parse("\t \n"), Parsed::Empty));
    }

    #[test]
    fn comando_inexistente_es_message_no_panic() {
        assert!(matches!(parse("frobnicate todo"), Parsed::Message(_)));
        assert!(matches!(parse("show wombats"), Parsed::Message(_)));
    }

    #[test]
    fn flags_malformados_son_message() {
        // --limit sin valor, y valor no numérico.
        assert!(matches!(parse("show artists --limit"), Parsed::Message(_)));
        assert!(matches!(parse("show artists --limit abc"), Parsed::Message(_)));
        // flag desconocido.
        assert!(matches!(parse("stats --nope"), Parsed::Message(_)));
    }

    #[test]
    fn comillas_agrupan_argumentos() {
        match cmd(r#"add artist "Pink Floyd""#) {
            Command::Add(AddCmd::Artist { name, mbid }) => {
                assert_eq!(name, vec!["Pink Floyd".to_string()]);
                assert!(mbid.is_none());
            }
            other => panic!("variante inesperada: {other:?}"),
        }
    }

    #[test]
    fn comillas_sin_cerrar_son_message_no_panic() {
        assert!(matches!(parse(r#"add artist "sin cerrar"#), Parsed::Message(_)));
        assert!(matches!(parse("search 'abierta"), Parsed::Message(_)));
    }

    #[test]
    fn show_artists_con_limit() {
        assert_eq!(
            cmd("show artists --limit 5"),
            Command::Show(ShowCmd::Artists { limit: Some(5) })
        );
        assert_eq!(
            cmd("show artists"),
            Command::Show(ShowCmd::Artists { limit: None })
        );
    }

    #[test]
    fn search_variadico() {
        assert_eq!(
            cmd("search daft punk discovery"),
            Command::Search {
                query: vec!["daft".into(), "punk".into(), "discovery".into()]
            }
        );
        // search sin argumentos: falta el requerido → Message.
        assert!(matches!(parse("search"), Parsed::Message(_)));
    }

    #[test]
    fn link_track_requiere_mbid() {
        assert_eq!(
            cmd("link track T-1 --mbid abc-123"),
            Command::Link(LinkCmd::Track {
                id: "T-1".into(),
                mbid: "abc-123".into()
            })
        );
        // sin --mbid → error recuperable.
        assert!(matches!(parse("link track T-1"), Parsed::Message(_)));
    }

    #[test]
    fn delete_artist_flags() {
        assert_eq!(
            cmd("delete artist A1 --cascade --yes"),
            Command::Delete(DeleteCmd::Artist {
                id: "A1".into(),
                cascade: true,
                yes: true
            })
        );
        assert_eq!(
            cmd("delete artist A1"),
            Command::Delete(DeleteCmd::Artist {
                id: "A1".into(),
                cascade: false,
                yes: false
            })
        );
    }

    #[test]
    fn logs_flags() {
        assert_eq!(
            cmd("logs --tail 10 --errors"),
            Command::Logs {
                tail: Some(10),
                errors: true
            }
        );
    }

    #[test]
    fn exit_y_quit() {
        assert!(cmd("exit").is_exit());
        assert!(cmd("quit").is_exit());
        assert!(!cmd("stats").is_exit());
    }

    #[test]
    fn help_general_y_por_topico_no_panican() {
        assert!(matches!(parse("help"), Parsed::Command(Command::Help { topic: None })));
        match cmd("help show") {
            Command::Help { topic } => assert_eq!(topic.as_deref(), Some("show")),
            other => panic!("inesperado: {other:?}"),
        }
        // que help_text no paniquee con tópicos raros:
        let _ = help_text(Some("show"));
        let _ = help_text(Some("noexiste"));
        let _ = help_text(None);
    }

    #[test]
    fn ayuda_flag_es_message() {
        // `--help` de clap se captura como Message (texto), no como pánico/exit.
        assert!(matches!(parse("--help"), Parsed::Message(_)));
        assert!(matches!(parse("show --help"), Parsed::Message(_)));
    }

    // ── Guarda de modo: los destructivos sin `admin` (modo prod) devuelven
    //    NotPermitted ANTES de tocar recurso alguno. ──
    struct MockBackend;

    #[async_trait::async_trait]
    impl TidolBackend for MockBackend {
        async fn list_artists(&self, _l: u32) -> BackendResult<Vec<ArtistResponse>> {
            Err(BackendError::NotImplemented("mock".into()))
        }
        async fn list_albums(&self, _a: Option<&str>, _l: u32) -> BackendResult<Vec<AlbumResponse>> {
            Err(BackendError::NotImplemented("mock".into()))
        }
        async fn list_tracks(
            &self,
            _al: Option<&str>,
            _ar: Option<&str>,
            _l: u32,
        ) -> BackendResult<Vec<TrackMetadataResponse>> {
            Err(BackendError::NotImplemented("mock".into()))
        }
        async fn describe_track(&self, _id: &str) -> BackendResult<TrackMetadataResponse> {
            Err(BackendError::NotImplemented("mock".into()))
        }
        async fn search(&self, _q: &str, _l: u32) -> BackendResult<SearchResponse> {
            Err(BackendError::NotImplemented("mock".into()))
        }
        async fn stats(&self) -> BackendResult<Stats> {
            Err(BackendError::NotImplemented("mock".into()))
        }
        async fn add_artist(&self, _n: &str, _m: Option<&str>) -> BackendResult<ArtistResponse> {
            Err(BackendError::NotImplemented("mock".into()))
        }
        async fn link_track_mbid(&self, _t: &str, _m: &str) -> BackendResult<()> {
            Err(BackendError::NotImplemented("mock".into()))
        }
        async fn status(&self) -> BackendResult<StatusInfo> {
            Err(BackendError::NotImplemented("mock".into()))
        }
        async fn health(&self) -> BackendResult<HealthReport> {
            Err(BackendError::NotImplemented("mock".into()))
        }
    }

    struct YesConfirm;
    impl Confirm for YesConfirm {
        fn confirm(&mut self, _: &str) -> bool {
            true
        }
    }

    #[test]
    fn destructivos_sin_admin_son_not_permitted() {
        let rt = tokio::runtime::Builder::new_current_thread()
            .build()
            .unwrap();
        let backend = MockBackend;
        let logs = LogHandle::new(4);
        let mut confirm = YesConfirm;
        let mut ctx = ExecCtx {
            backend: &backend,
            admin: None, // modo prod
            logs: &logs,
            rt: rt.handle(),
            confirm: &mut confirm,
        };
        // Incluso con `--yes` (confirmación no interviene) y con el confirmador
        // diciendo "sí", la guarda de modo rechaza ANTES de tocar nada.
        let destructivos = [
            Command::Delete(DeleteCmd::Artist {
                id: "a".into(),
                cascade: true,
                yes: false,
            }),
            Command::Delete(DeleteCmd::Track {
                id: "t".into(),
                yes: false,
            }),
            Command::Migrate {
                name: "m".into(),
                yes: false,
            },
            Command::Import { path: "/x".into() },
        ];
        for c in destructivos {
            let r = execute(c, &mut ctx);
            assert!(
                matches!(r, Err(BackendError::NotPermitted(_))),
                "esperaba NotPermitted, obtuve {r:?}"
            );
        }
    }

    #[test]
    fn fuzz_no_panica_nunca() {
        // Barrido de entradas hostiles: ninguna debe paniquear (todas devuelven
        // alguna variante de Parsed).
        let big = "a".repeat(10_000);
        let inputs = [
            "",
            "   ",
            "\"",
            "'",
            "\\",
            "show",
            "show --limit",
            "delete",
            "delete artist",
            "migrate",
            "--",
            "-x",
            "search \"a b c",
            "add artist",
            "link track",
            "show tracks --album --artist",
            "🎵🎶 unicode",
            big.as_str(),
        ];
        for i in inputs {
            let _ = parse(i);
        }
    }
}
