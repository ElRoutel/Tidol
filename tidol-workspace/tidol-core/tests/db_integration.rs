//! Pruebas de integración (P3) contra una BD de prueba DEDICADA.
//!
//! Ejercitan el SQL real movido en el refactor (playlists CRUD, reorder,
//! likes, historial, auth) sin mocks. NO corren en `cargo test` normal: van
//! tras la feature `db-tests` porque necesitan infraestructura.
//!
//! Cómo correrlas:
//! ```text
//! ./scripts/test-db.sh start
//! TIDOL_TEST_DATABASE_URL='mysql://root@127.0.0.1:3307/tidol_test' \
//!     cargo test -p tidol-core --features db-tests
//! ./scripts/test-db.sh stop
//! ```
//!
//! Aislamiento: cada prueba registra su propio usuario (nombre único) y opera
//! solo sobre sus filas; no se trunca nada y pueden correr en paralelo.
#![cfg(feature = "db-tests")]

use std::sync::atomic::{AtomicU64, Ordering};

use tidol_core::config::CoreConfig;
use tidol_core::{
    AddSongToPlaylistPayload, CreatePlaylistPayload, LoginError, LoginPayload, LogPlayPayload,
    RegisterError, RegisterPayload, RenameError, RenamePlaylistPayload, ReorderError, TidolCore,
    ToggleLikePayload,
};

fn test_url() -> String {
    let url = std::env::var("TIDOL_TEST_DATABASE_URL").expect(
        "TIDOL_TEST_DATABASE_URL no definida. Levanta la BD dedicada con \
         ./scripts/test-db.sh start (ver encabezado de este fichero).",
    );
    // Cinturón de seguridad: jamás contra una BD que no sea claramente de prueba.
    assert!(
        url.contains("test"),
        "TIDOL_TEST_DATABASE_URL no parece una BD de prueba: {url}"
    );
    url
}

async fn core() -> TidolCore {
    TidolCore::new(CoreConfig {
        database_url: test_url(),
        database_max_connections: 5,
        proxy_pool: vec!["direct".into()],
        plugins_dir: "/nonexistent".into(), // sin plugin de letras: warn y sigue
        youtube_api_key: String::new(),
        spotify_client_id: String::new(),
        spotify_client_secret: String::new(),
        soundcloud_client_id: String::new(),
        jwt_secret: Some("secreto-integracion".into()),
    })
    .await
    .expect("TidolCore::new contra la BD de prueba (¿está levantada? ver scripts/test-db.sh)")
}

/// Sufijo único por proceso+llamada para usuarios/ids sin colisiones.
fn unique(prefix: &str) -> String {
    static SEQ: AtomicU64 = AtomicU64::new(0);
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .subsec_nanos();
    format!(
        "{prefix}{}_{}_{}",
        std::process::id(),
        nanos,
        SEQ.fetch_add(1, Ordering::Relaxed)
    )
}

/// Registra un usuario nuevo y devuelve (user_id, token, username).
async fn register_user(core: &TidolCore) -> (i64, String, String) {
    let username = unique("u");
    let res = core
        .register(RegisterPayload {
            username: username.clone(),
            password: "password123".into(),
            device_name: "test-device".into(),
            device_type: "cli".into(),
        })
        .await
        .expect("register");
    let token = res["token"].as_str().expect("token en register").to_string();
    let ctx = core.authenticate(&token).await.expect("authenticate tras register");
    (ctx.user_id, token, username)
}

fn song(id: &str, titulo: &str) -> AddSongToPlaylistPayload {
    AddSongToPlaylistPayload {
        cancion_id: id.to_string(),
        song_source: Some("archive".into()),
        titulo: Some(titulo.to_string()),
        artista: Some("Artista Test".into()),
        portada: Some("https://example.invalid/c.jpg".into()),
        url: Some("https://example.invalid/s.mp3".into()),
        duracion: Some(120),
    }
}

fn ids_of(songs: &[serde_json::Value]) -> Vec<String> {
    songs
        .iter()
        .map(|s| s["id"].as_str().unwrap().to_string())
        .collect()
}

// ─────────────────────────────────────────────────────────────────────────
// AUTH con BD real (P2 con infraestructura)
// ─────────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn auth_ciclo_completo_register_login_me_logout() {
    let core = core().await;
    let (user_id, token, username) = register_user(&core).await;

    // authenticate: token válido + device en BD → AuthContext correcto.
    let ctx = core.authenticate(&token).await.expect("authenticate");
    assert_eq!(ctx.user_id, user_id);

    // me: perfil con la forma de la línea base.
    let me = core.me(&ctx).await.expect("me");
    assert_eq!(me["status"], "success");
    assert_eq!(me["username"], serde_json::json!(username));
    assert_eq!(me["user_id"], serde_json::json!(user_id));
    assert_eq!(me["device"]["name"], "test-device");

    // login con la misma contraseña: el hash argon2 guardado verifica
    // (cruce register→login por el camino real).
    let login = core
        .login(LoginPayload {
            username: username.clone(),
            password: "password123".into(),
            device_name: "otro-device".into(),
            device_type: "web".into(),
        })
        .await
        .expect("login");
    assert_eq!(login["status"], "success");
    assert!(login["token"].as_str().is_some());

    // login con contraseña incorrecta → BadLogin (401 en el binario).
    let bad = core
        .login(LoginPayload {
            username: username.clone(),
            password: "incorrecta!".into(),
            device_name: "d".into(),
            device_type: "t".into(),
        })
        .await
        .unwrap_err();
    assert!(matches!(bad, LoginError::BadLogin));
    assert_eq!(bad.to_string(), "Usuario o contraseña incorrectos");

    // logout: borra el device → segundo logout AlreadyClosed → token inservible.
    core.logout(&ctx).await.expect("logout");
    let again = core.logout(&ctx).await.unwrap_err();
    assert_eq!(again.to_string(), "Sesión inválida o ya cerrada");
    assert!(core.authenticate(&token).await.is_err(), "token debe morir con el device");
}

#[tokio::test]
async fn register_username_duplicado_es_conflict() {
    let core = core().await;
    let (_id, _tok, username) = register_user(&core).await;
    let err = core
        .register(RegisterPayload {
            username: username.clone(),
            password: "password123".into(),
            device_name: "d".into(),
            device_type: "t".into(),
        })
        .await
        .unwrap_err();
    assert!(matches!(err, RegisterError::UsernameTaken));
    assert_eq!(err.to_string(), "El nombre de usuario ya está en uso");
}

// ─────────────────────────────────────────────────────────────────────────
// PLAYLISTS CRUD (P3)
// ─────────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn create_get_rename_delete_playlist() {
    let core = core().await;
    let (uid, _tok, _u) = register_user(&core).await;

    let created = core
        .create_playlist(uid, CreatePlaylistPayload { nombre: "Mi lista".into() })
        .await
        .expect("create_playlist");
    let pid = created["id"].as_str().expect("id").to_string();
    assert_eq!(created["nombre"], "Mi lista");

    // Aparece en el listado con los campos enriquecidos de la base.
    let lists = core.get_playlists(uid).await;
    let mine = lists.iter().find(|p| p["id"] == serde_json::json!(pid)).expect("en listado");
    assert_eq!(mine["songCount"], 0);
    assert_eq!(mine["likes"], 0);

    // get_playlist: detalle correcto; isOwner true.
    let detail = core.get_playlist(uid, &pid).await.expect("detalle");
    assert_eq!(detail["nombre"], "Mi lista");
    assert_eq!(detail["isOwner"], true);
    assert_eq!(detail["songCount"], 0);

    // rename: trim aplicado; vacío → EmptyName; ajeno → NotFound.
    let renamed = core
        .rename_playlist(uid, &pid, RenamePlaylistPayload { nombre: "  Nueva  ".into() })
        .await
        .expect("rename");
    assert_eq!(renamed["nombre"], "Nueva");

    let e = core
        .rename_playlist(uid, &pid, RenamePlaylistPayload { nombre: "   ".into() })
        .await
        .unwrap_err();
    assert!(matches!(e, RenameError::EmptyName));

    let (otro_uid, _t, _un) = register_user(&core).await;
    let e = core
        .rename_playlist(otro_uid, &pid, RenamePlaylistPayload { nombre: "hack".into() })
        .await
        .unwrap_err();
    assert!(matches!(e, RenameError::NotFound));

    // delete: solo el dueño; idempotencia → segunda vez false (404).
    assert!(!core.delete_playlist(otro_uid, &pid).await, "ajeno no puede borrar");
    assert!(core.delete_playlist(uid, &pid).await);
    assert!(!core.delete_playlist(uid, &pid).await);
    assert!(core.get_playlist(uid, &pid).await.is_none());
}

/// Una playlist ajena debe ser indistinguible de una inexistente: antes,
/// `get_playlist`/`get_playlist_songs` la servían a cualquier autenticado.
#[tokio::test]
async fn playlist_ajena_no_es_legible() {
    let core = core().await;
    let (dueno, _t1, _u1) = register_user(&core).await;
    let (intruso, _t2, _u2) = register_user(&core).await;

    let created = core
        .create_playlist(dueno, CreatePlaylistPayload { nombre: "Privada".into() })
        .await
        .expect("create_playlist");
    let pid = created["id"].as_str().expect("id").to_string();

    // El dueño sí la lee.
    assert!(core.get_playlist(dueno, &pid).await.is_some());
    assert!(core.get_playlist_songs(dueno, &pid).await.is_some());

    // El intruso no, ni el detalle ni las canciones.
    assert!(core.get_playlist(intruso, &pid).await.is_none(), "detalle ajeno filtrado");
    assert!(core.get_playlist_songs(intruso, &pid).await.is_none(), "canciones ajenas filtradas");

    // Y tampoco asoma en su listado.
    let del_intruso = core.get_playlists(intruso).await;
    assert!(del_intruso.iter().all(|p| p["id"] != serde_json::json!(pid)));
}

#[tokio::test]
async fn add_song_posiciones_duplicados_y_propiedad() {
    let core = core().await;
    let (uid, _tok, _u) = register_user(&core).await;
    let pid = core
        .create_playlist(uid, CreatePlaylistPayload { nombre: "Songs".into() })
        .await
        .unwrap()["id"]
        .as_str()
        .unwrap()
        .to_string();

    let (id_a, id_b) = (unique("track_a"), unique("track_b"));

    // Añadir dos canciones → posiciones estables 1 y 2 (orden de llegada).
    let r = core.add_song_to_playlist(uid, &pid, song(&id_a, "A")).await.unwrap();
    assert_eq!(r, serde_json::json!({ "added": true, "already": false }));
    let r = core.add_song_to_playlist(uid, &pid, song(&id_b, "B")).await.unwrap();
    assert_eq!(r["added"], true);

    let songs = core.get_playlist_songs(uid, &pid).await.expect("lista");
    assert_eq!(ids_of(&songs), vec![id_a.clone(), id_b.clone()]);

    // Payload con todos los alias de clave que espera el frontend.
    let s = &songs[0];
    for key in ["trackName", "title", "titulo"] {
        assert_eq!(s[key], "A", "clave {key}");
    }
    assert_eq!(s["sourceType"], "archive");
    assert_eq!(s["duracion"], 120);
    assert_eq!(s["playbackUrl"], "https://example.invalid/s.mp3");

    // Duplicado: no re-inserta ni reordena; avisa.
    let dup = core.add_song_to_playlist(uid, &pid, song(&id_a, "A")).await.unwrap();
    assert_eq!(dup, serde_json::json!({ "added": false, "already": true }));
    assert_eq!(core.get_playlist_songs(uid, &pid).await.unwrap().len(), 2);

    // Playlist ajena → NotFound (404), sin insertar.
    let (otro, _t, _un) = register_user(&core).await;
    let e = core
        .add_song_to_playlist(otro, &pid, song(&unique("x"), "X"))
        .await
        .unwrap_err();
    assert!(matches!(e, tidol_core::AddSongError::NotFound));

    // Totales agregados en el detalle.
    let detail = core.get_playlist(uid, &pid).await.unwrap();
    assert_eq!(detail["songCount"], 2);
    assert_eq!(detail["totalDuration"], 240);
}

#[tokio::test]
async fn reorder_persiste_el_orden_y_valida_entrada() {
    let core = core().await;
    let (uid, _tok, _u) = register_user(&core).await;
    let pid = core
        .create_playlist(uid, CreatePlaylistPayload { nombre: "Orden".into() })
        .await
        .unwrap()["id"]
        .as_str()
        .unwrap()
        .to_string();

    let (a, b, c) = (unique("ta"), unique("tb"), unique("tc"));
    for (id, t) in [(&a, "A"), (&b, "B"), (&c, "C")] {
        core.add_song_to_playlist(uid, &pid, song(id, t)).await.unwrap();
    }
    assert_eq!(
        ids_of(&core.get_playlist_songs(uid, &pid).await.unwrap()),
        vec![a.clone(), b.clone(), c.clone()]
    );

    // Reordenar C, A, B → la lectura respeta el nuevo orden (position 1..3).
    let ok = core
        .reorder_playlist_songs(uid, &pid, vec![c.clone(), a.clone(), b.clone()])
        .await
        .expect("reorder");
    assert_eq!(ok, serde_json::json!({ "ok": true }));
    assert_eq!(
        ids_of(&core.get_playlist_songs(uid, &pid).await.unwrap()),
        vec![c.clone(), a.clone(), b.clone()]
    );

    // Reorden PARCIAL (contrato de la base): solo los listados cambian de
    // posición; al no listado le queda la suya. [b] → b pasa a posición 1 y
    // empata con c (que ya tenía 1); el desempate es added_at ASC → c antes.
    let ok = core.reorder_playlist_songs(uid, &pid, vec![b.clone()]).await.unwrap();
    assert_eq!(ok["ok"], true);
    let order = ids_of(&core.get_playlist_songs(uid, &pid).await.unwrap());
    assert_eq!(order.len(), 3);
    // b (pos 1) debe ir ahora antes que a (pos 2, intacta).
    let pos_of = |id: &str| order.iter().position(|x| x == id).unwrap();
    assert!(pos_of(&b) < pos_of(&a), "orden tras reorden parcial: {order:?}");

    // Validaciones: vacío y >1000 → Invalid; ajeno / inexistente → NotFound.
    assert!(matches!(
        core.reorder_playlist_songs(uid, &pid, vec![]).await.unwrap_err(),
        ReorderError::Invalid
    ));
    let too_many: Vec<String> = (0..1001).map(|i| format!("t{i}")).collect();
    assert!(matches!(
        core.reorder_playlist_songs(uid, &pid, too_many).await.unwrap_err(),
        ReorderError::Invalid
    ));
    let (otro, _t, _un) = register_user(&core).await;
    assert!(matches!(
        core.reorder_playlist_songs(otro, &pid, vec![a.clone()]).await.unwrap_err(),
        ReorderError::NotFound
    ));
    assert!(matches!(
        core.reorder_playlist_songs(uid, "no-existe", vec![a.clone()]).await.unwrap_err(),
        ReorderError::NotFound
    ));
}

#[tokio::test]
async fn remove_song_respeta_propiedad_e_integridad() {
    let core = core().await;
    let (uid, _tok, _u) = register_user(&core).await;
    let pid = core
        .create_playlist(uid, CreatePlaylistPayload { nombre: "Rm".into() })
        .await
        .unwrap()["id"]
        .as_str()
        .unwrap()
        .to_string();
    let id_a = unique("rm");
    core.add_song_to_playlist(uid, &pid, song(&id_a, "A")).await.unwrap();

    // Ajeno → false (404) y la canción sigue.
    let (otro, _t, _un) = register_user(&core).await;
    assert!(!core.remove_song_from_playlist(otro, &pid, &id_a).await);
    assert_eq!(core.get_playlist_songs(uid, &pid).await.unwrap().len(), 1);

    // Dueño → true y desaparece. Canción inexistente en playlist propia →
    // true igualmente (contrato de la base: 200 "Canción eliminada").
    assert!(core.remove_song_from_playlist(uid, &pid, &id_a).await);
    assert_eq!(core.get_playlist_songs(uid, &pid).await.unwrap().len(), 0);
    assert!(core.remove_song_from_playlist(uid, &pid, "fantasma").await);
}

#[tokio::test]
async fn toggle_playlist_like_alterna_y_cuenta() {
    let core = core().await;
    let (uid, _tok, _u) = register_user(&core).await;
    let pid = core
        .create_playlist(uid, CreatePlaylistPayload { nombre: "Like".into() })
        .await
        .unwrap()["id"]
        .as_str()
        .unwrap()
        .to_string();

    let r = core.toggle_playlist_like(uid, &pid).await.unwrap();
    assert_eq!(r, serde_json::json!({ "liked": true, "likes": 1 }));
    let r = core.toggle_playlist_like(uid, &pid).await.unwrap();
    assert_eq!(r, serde_json::json!({ "liked": false, "likes": 0 }));

    assert!(matches!(
        core.toggle_playlist_like(uid, "no-existe").await.unwrap_err(),
        tidol_core::TogglePlaylistLikeError::NotFound
    ));
}

// ─────────────────────────────────────────────────────────────────────────
// LIKES + HISTORIAL (P3)
// ─────────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn likes_local_e_ia_y_detallados() {
    let core = core().await;
    let (uid, _tok, _u) = register_user(&core).await;
    let local_id = unique("l");
    let ia_id = unique("ia_");

    // Local: dar like es idempotente (repetirlo NO lo quita).
    assert_eq!(
        core.set_local_like(uid, &local_id).await,
        serde_json::json!({ "liked": true })
    );
    assert_eq!(
        core.set_local_like(uid, &local_id).await,
        serde_json::json!({ "liked": true })
    );
    assert!(core.get_local_likes(uid).await.contains(&local_id));
    assert!(!core.get_ia_likes(uid).await.contains(&local_id));

    // IA: sin id → MissingId (400); con metadata la cachea para "detailed".
    let e = core
        .toggle_ia_like(
            uid,
            ToggleLikePayload {
                id: None,
                identifier: None,
                name: None,
                title: None,
                creator: None,
                artist: None,
                album: None,
                portada: None,
                duration: None,
            },
        )
        .await
        .unwrap_err();
    assert!(matches!(e, tidol_core::ToggleIaLikeError::MissingId));

    let r = core
        .toggle_ia_like(
            uid,
            ToggleLikePayload {
                id: Some(ia_id.clone()),
                identifier: None,
                name: None,
                title: Some("Tema IA".into()),
                creator: Some("Autor IA".into()),
                artist: None,
                album: None,
                portada: Some("https://example.invalid/p.jpg".into()),
                duration: Some(93.7),
            },
        )
        .await
        .unwrap();
    assert_eq!(r, serde_json::json!({ "liked": true }));
    assert!(core.get_ia_likes(uid).await.contains(&ia_id));

    // Detailed: el like IA sale con la metadata cacheada; filtro por fuente.
    let detailed = core.get_likes_detailed(uid, Some("archive".into())).await;
    let entry = detailed
        .iter()
        .find(|e| e["id"] == serde_json::json!(ia_id))
        .expect("like IA en detailed");
    assert_eq!(entry["title"], "Tema IA");
    assert_eq!(entry["artist"], "Autor IA");
    let solo_local = core.get_likes_detailed(uid, Some("local".into())).await;
    assert!(solo_local.iter().all(|e| e["id"] != serde_json::json!(ia_id)));

    // Alternar de nuevo el IA like → fuera.
    let r = core
        .toggle_ia_like(
            uid,
            ToggleLikePayload {
                id: Some(ia_id.clone()),
                identifier: None,
                name: None,
                title: None,
                creator: None,
                artist: None,
                album: None,
                portada: None,
                duration: None,
            },
        )
        .await
        .unwrap();
    assert_eq!(r, serde_json::json!({ "liked": false }));

    // Local: quitar el like también es idempotente (nunca lo vuelve a poner).
    assert_eq!(
        core.unset_local_like(uid, &local_id).await,
        serde_json::json!({ "liked": false })
    );
    assert_eq!(
        core.unset_local_like(uid, &local_id).await,
        serde_json::json!({ "liked": false })
    );
    assert!(!core.get_local_likes(uid).await.contains(&local_id));
}

#[tokio::test]
async fn log_play_alimenta_el_historial() {
    let core = core().await;
    let (uid, _tok, _u) = register_user(&core).await;
    let mbid = unique("mb");

    core.log_play(
        &mbid,
        uid,
        Some(LogPlayPayload {
            title: Some("Cancion H".into()),
            artist: Some("Artista H".into()),
            cover_url: Some("https://example.invalid/h.jpg".into()),
        }),
    )
    .await
    .expect("log_play");

    let history = core.get_history(uid).await;
    let entry = history
        .iter()
        .find(|h| h["id"] == serde_json::json!(mbid))
        .expect("entrada de historial");
    assert_eq!(entry["title"], "Cancion H");
    assert_eq!(entry["artist"], "Artista H");
    assert!(entry["playedAt"].as_i64().is_some());
}

// ─────────────────────────────────────────────────────────────────────────
// ARRANQUE: migraciones idempotentes
// ─────────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn migraciones_de_arranque_son_idempotentes() {
    // Dos arranques seguidos no deben fallar (CREATE IF NOT EXISTS / ADD
    // COLUMN IF NOT EXISTS / backfill WHERE position = 0).
    let _a = core().await;
    let _b = core().await;
}
