# 13 — Archivos legado, sueltos y de documentación

[← Índice](INDICE.md)

Para cuando encuentres un fichero raro y te preguntes "¿esto importa?". Regla general: **lo
de esta lista no participa en el build ni en el deploy** salvo que se diga lo contrario.

## Raíz del repo (`TidolCore/`)

| Fichero | Qué es | ¿Importa? |
|---------|--------|-----------|
| `README.md`, `README.es.md` | README del **frontend** copiado a la raíz | informativo; desactualizado como README del monorepo |
| `.env.production` | plantilla del `.env` del VPS (placeholders) | sí, como plantilla |
| `cleanup_legacy_tables.sql` | DROPs de `user_history`, `user_favorites`, `audioProcessingQueue` con backfill previo | manual, una vez |
| `root.crt` | certificado raíz (CA local de Caddy para la LAN, probablemente) | solo dev |
| `Caddyfile`, `Dockerfile.caddy` | Caddy de desarrollo con DuckDNS | solo dev (y contiene un secreto, ver [12](12-pendientes-y-deuda-tecnica.md#p0--seguridad)) |
| `MIGRATION_AUDIT.md` (en `tidol-workspace/`) | auditoría del 29-jun-2026: qué código ilegal había y dónde (yt-dlp, Piped, Invidious, Deezer, librespot…) | histórico; útil para entender por qué existen ciertas defensas. **Los ficheros que cita ya no existen** |

## `tidol-workspace/` (sueltos en la raíz del workspace)

| Fichero | Qué es | ¿Importa? |
|---------|--------|-----------|
| `fix_main.py`, `fix2.py`, `fix3.py` | scripts que editaban el antiguo `tidol-core/src/main.rs` para quitar `DynamicAIProvider` y el `ai_worker_loop` | no; el `main.rs` que tocan ya no existe |
| `update_main.py` | script que añadía `models`, `broadcast`/`WorkerEvent` al viejo `main.rs` | no |
| `test_security.py` | prueba manual de seguridad (pymysql + JWT + requests) | no; **contiene credenciales**: rotar y borrar |
| `schema_discography.sql` | primera versión de `artists`/`albums`/`album_tracks` | no (lo cubre `schema_full.sql`) |
| `update_schema.sql` | esquema aún más antiguo (`artists.id`, `image_url`) | no |
| `update_indexes.sql` | añadía `artist_id`/`album_id` a `trackMetadata` comprobando `information_schema` | no |
| `clear_cache.sh` (git-ignorado, solo local) | resetea letras/rutas de audio/`audioProcessingQueue` | no; menciona tablas y columnas ya eliminadas |
| `MIGRATION_AUDIT.md` | ver arriba | histórico |
| `docs/ABOUT.md`, `docs/TERMS_OF_SERVICE.md`, `docs/PRIVACY_POLICY.md`, `docs/DMCA_POLICY.md` | textos legales (29-jun-2026) que respaldan el modelo de agregador | sí, son la base de `TermsPage`/`PrivacyPage` del front; mantenerlos coherentes |
| `scripts/test-db.sh` | MariaDB desechable para la suite `db-tests` | sí (pruebas) |
| `covers/`, `storage/` (git-ignorados) | caché local de portadas y almacenamiento de desarrollo | datos locales |
| `venv/` (git-ignorado) | entorno Python para los scripts de arriba | no |
| `.claude/settings.local.json` | permisos locales de Claude Code | no lo commitees |
| `tidol-core/scratch/refactor.py`, `refactor2.py`, `replace_println.py` | scripts del refactor a `tracing`/`TidolError` sobre el viejo `main.rs` | no |
| `tidol-core/postgresql_migration.sql` | esquema para un paso a PostgreSQL nunca realizado | no (decisión pendiente) |

## Frontends de TV

- **`tidol-tv-lite-backup/`** (versionado): copia completa de un frontend para TV
  (`layouts/TvLayout.tsx`, `pages/Tv*Page.tsx`, `TvFullScreenPlayer.tsx`), con
  `PlayerContext.jsx.backup/.bak`, `FullScreenLyrics`, `LyricsView`, `useSpectraSync`. Es
  anterior a la migración legal: **no lo uses como referencia** para la reproducción. Su
  README es la plantilla de Vite. Excluido del deploy y de Docker.
- **`tidol-tv-lite/`**: no tiene ficheros versionados; en disco solo hay `dist/` y
  `node_modules/`. La rama `feature/tidol-tv` se borró al aplastar el historial.

## `plugins/provider-ai/` vendorizado

`whisper.cpp/`, `third_party/`, `models/`, `build/` (≈6,5 GB en disco, git-ignorados salvo
`src/ai_plugin.cpp`, `CMakeLists.txt`, `build.sh`). Ver [06](06-proveedores-plugins-y-workers.md#provider-ai-ccuda-no-es-miembro-del-workspace).

## `target/`

`tidol-workspace/target/` ocupa ~22 GB en la máquina del dev (incluye `target/test-db/` de la
BD de pruebas). Se puede limpiar con `cargo clean` sin perder nada versionado.
