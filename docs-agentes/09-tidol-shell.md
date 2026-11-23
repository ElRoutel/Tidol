# 09 — `tidol-shell` (REPL de administración)

[← Índice](INDICE.md) · Ruta: `tidol-workspace/tidol-shell/` · Manual de usuario: `tidol-shell/README.md`

REPL estilo cliente `mysql` para administrar Tidol. Añadido en jul-2026 (merge `666a4c7f`).
**No se compila en la imagen Docker** (el `Dockerfile` solo construye `tidol-server`), así
que tampoco necesita `libdbus` en el deploy.

## Dos modos

| Modo | Prompt | Backend | Destructivos |
|------|--------|---------|--------------|
| local (default) | `TidolCore>` verde | `LocalBackend`: `tidol-core` directo sobre la BD de `.env` | sí |
| prod (`--remote prod`) | `Tidol(prod)>` rojo | `RemoteBackend`: API HTTP de `tidol-server` con reqwest | **imposible por tipos** |

La seguridad es **estructural**: solo `LocalBackend` implementa el trait `LocalAdmin`
(operaciones destructivas); el REPL solo tiene `admin: Some(_)` en local. No es un `if`.

El token de prod **nunca** se teclea ni va en argv: se guarda en el keyring del SO
(`--store-token` lo lee de `TIDOL_PROD_TOKEN`). URL de prod: `TIDOL_PROD_URL` o
`~/.config/tidol/<perfil>.url`.

## Ficheros

| Fichero | Qué hace |
|---------|----------|
| `src/main.rs` | parseo de args, construcción de backends, keyring (servicio `tidol`, cuenta `<perfil>-token`), logging. `#![deny(clippy::unwrap_used)]`. |
| `src/repl.rs` | loop de `rustyline`: historial, Ctrl-C cancela línea, Ctrl-D sale guardando. |
| `src/commands/mod.rs` | gramática (`clap` derive con `try_parse_from`, tokenizado con `shell-words`) + `execute` como un `match` central (deliberado: deja **a la vista** la guarda de modo). Tests de "nada de esto paniquea". |
| `src/backend/mod.rs` | traits `TidolBackend` (ambos modos, object-safe) y `LocalAdmin` (solo local); re-exporta DTOs de `tidol_core::models`. |
| `src/backend/local.rs` | implementación local. **La mayoría de métodos devuelven `BackendError::NotImplemented`** vía `todo_core(...)`, documentando la firma que se espera del core. |
| `src/backend/remote.rs` | implementación HTTP con timeout; 401→`Unauthorized`, 404→`NotFound`, otros→`Network`. |
| `src/error.rs` | `BackendError` (6 variantes de la especificación + `NotImplemented`, que sustituye a `todo!()` para no paniquear). |
| `src/logbuf.rs` | `Layer` de `tracing` que guarda logs en un anillo en memoria (para el comando `logs`). |
| `src/render/mod.rs` | `Output` + tablas (`comfy-table`) y colores (`owo-colors`); resultados a stdout, logs a stderr. |

## Estado de los comandos (modo local)

| Comando | Estado |
|---------|--------|
| `search`, `status`, `health`, `logs`, `help`, `exit` | funcionan |
| `show albums`, `show tracks --album` | parcialmente (sobre `library.rs`) |
| `show artists`, `describe track`, `stats`, `add artist`, `link track`, `delete artist/track`, `migrate`, `import` | **`NotImplemented`** (falta exponer métodos en `tidol-core`) |

Para implementar uno: añade el método en `tidol-core`, sustituye el `todo_core(...)` del
`LocalBackend` y, si aplica al modo prod, el endpoint HTTP + el método en `RemoteBackend`.
El grep `todo_core` / `NotImplemented` lista todo lo pendiente.

Features: `--features local-library` reenvía a `tidol-core/local-library` (placeholder vacío)
y habilita el comportamiento de `import`.
