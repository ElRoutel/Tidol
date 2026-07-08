# tidol-shell

REPL interactivo de administración para Tidol. Presenta un prompt persistente
estilo cliente de `mysql` y traduce comandos de texto a llamadas sobre una capa
de backend abstracta. **Nunca paniquea por entrada del usuario**: cualquier input
malformado, comando inexistente, flag inválido o error del backend se maneja como
error recuperable, se imprime y devuelve el control al prompt.

## Dos modos

| Modo  | Prompt          | Backend                              | Destructivos |
|-------|-----------------|--------------------------------------|--------------|
| local | `TidolCore>` 🟢 | directo a `tidol-core` / BD local    | **sí**       |
| prod  | `Tidol(prod)>` 🔴| API HTTP de `tidol-server` (reqwest) | **no** (garantía por tipos) |

La imposibilidad de borrar en prod es **estructural**: solo `LocalBackend`
implementa el trait `LocalAdmin`, y el REPL solo tiene `admin: Some(_)` en local.
`RemoteBackend` no lo implementa jamás.

## Cómo correr

### Local (por defecto)

Necesita las mismas variables que `tidol-server` (usa `.env` del workspace):

```bash
# DATABASE_URL es obligatoria; el resto tiene defaults.
export DATABASE_URL='mysql://user:pass@localhost:3306/tidol'
cargo run -p tidol-shell
# con la biblioteca local (import) habilitada:
cargo run -p tidol-shell --features local-library
```

### Prod (remoto)

La `base_url` sale de `TIDOL_PROD_URL` o de `~/.config/tidol/<perfil>.url`. El
token **nunca** se teclea ni se pasa como argumento: se lee del keyring del OS.

```bash
# 1) Guardar el token una vez (se lee de la env var, no del prompt ni argv):
export TIDOL_PROD_TOKEN='<tu token>'
cargo run -p tidol-shell -- --remote prod --store-token
unset TIDOL_PROD_TOKEN

# 2) Usar el modo prod:
export TIDOL_PROD_URL='https://api.tidol.example'
cargo run -p tidol-shell -- --remote prod
```

Si el keyring no tiene token en modo prod, el REPL explica cómo guardarlo y sale
limpio (no lo pide por prompt en texto plano).

## Comandos (v1)

```
show artists [--limit N]
show albums  [--artist ID]
show tracks  [--album ID] [--artist ID] [--limit N]
describe track <id>
search <query...>
stats

add artist <nombre> [--mbid MBID]
link track <id> --mbid MBID

status
logs [--tail N] [--errors]
health

import <ruta>                 # solo-local (feature local-library)
delete artist <id> [--cascade] [--yes]   # solo-local
delete track <id> [--yes]                # solo-local
migrate <nombre> [--yes]                 # solo-local

help [comando]
exit | quit
```

- `Ctrl-C` cancela la línea (no sale). `Ctrl-D` sale limpio guardando historial.
- `delete`/`migrate` piden confirmación `y/N` salvo `--yes`.
- El historial filtra líneas que parezcan llevar secretos; en prod no se persiste.

## Arquitectura

```
src/
  main.rs        bootstrap: modo, keyring, runtime, CoreConfig
  repl.rs        loop rustyline: señales, historial, confirmación, despacho
  commands/      grammar clap + parse() + execute() (match)  ← definición y ejecución
  backend/       traits (TidolBackend, LocalAdmin) + impls local/remote
  render/        Output {Table,Text,Empty} + color/tablas
  logbuf.rs      Layer de tracing → buffer en memoria (comando `logs`)
  error.rs       BackendError (thiserror)
```

## Cómo agregar un comando nuevo

El flujo es intencionadamente mecánico (**una variante + un brazo [+ un método]**):

1. **Grammar** (`commands/mod.rs`): añade una variante al enum `Command` (o a un
   sub-enum como `ShowCmd`) con sus `#[arg(...)]`. clap se encarga del parseo y de
   los errores recuperables.
2. **Ejecución** (`commands/mod.rs`, fn `execute`): añade un brazo al `match`. Lee
   los datos vía `ctx.backend` (ambos modos) o `ctx.admin` (solo-local; usa
   `ctx.require_admin()?` **antes** de tocar nada). Devuelve un `Output`.
3. **Backend** (si necesitas una operación nueva): añade el método al trait
   `TidolBackend` (o `LocalAdmin`) en `backend/mod.rs` e impleméntalo en
   `backend/local.rs` **y** `backend/remote.rs`. Si `tidol-core` / `tidol-server`
   aún no lo exponen, devuelve `BackendError::todo_core("<firma esperada>")`.
4. **Render**: reutiliza `Output::table(...)` / `Output::Text(...)` y los helpers
   de `render/` (`cell`, `duration`, `opt`, `ok_flag`).
5. **Tests**: añade un caso al módulo `#[cfg(test)]` de `commands/` (parseo).

### Por qué `match` y no un registro de `trait Command`

El conjunto de comandos es un enum pequeño y cerrado y clap ya da despacho tipado.
Un `match` centralizado mantiene **a la vista** la guarda de modo
(`require_admin`) que protege los destructivos — el punto más sensible. Un
registro de objetos-trait la dispersaría. Por encima de ~30 comandos convendría
reconsiderarlo.

## Nota sobre `todo!()` / operaciones pendientes de conectar

La especificación pedía dejar los métodos que `tidol-core` aún no expone como
`todo!()`. Pero `todo!()` es un `panic!`, y la **regla #1 (no negociable)** prohíbe
cualquier pánico provocable desde el prompt. Resolvemos la tensión con un error
tipado `BackendError::NotImplemented` (constructor `todo_core`) que imprime la
**firma exacta** de `tidol-core`/`tidol-server` que hace falta y devuelve el control
al prompt. Están marcados y son greppables:

```bash
grep -rn "todo_core" src/
```

Operaciones hoy sin conectar (devuelven `NotImplemented` con su firma esperada):
`show artists`, `show tracks` (sin filtro), `describe track`, `stats`,
`add artist`, `link track`, `import`, `delete artist`, `delete track`, `migrate`.

Operaciones **reales y funcionales** contra el backend: `show albums`,
`show tracks --album/--artist`, `search`, `status`, `health`, `logs`.

## Puertas de calidad

```bash
cargo build  -p tidol-shell --features tidol-core/local-library
cargo clippy -p tidol-shell -- -D warnings
cargo test   -p tidol-shell
```
