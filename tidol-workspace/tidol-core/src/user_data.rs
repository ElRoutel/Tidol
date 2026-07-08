use serde::Deserialize;
use thiserror::Error;
use uuid::Uuid;

use crate::TidolCore;

// -------------------------------------------------------------------------
// PAYLOADS
// -------------------------------------------------------------------------
#[derive(Deserialize)]
pub struct CreatePlaylistPayload {
    pub nombre: String,
}

/// Solo `cancion_id` es obligatorio: los metadatos son opcionales. Exigirlos hacía
/// que Axum rechazase la petición con un 422 sin cuerpo antes de llegar al handler.
#[derive(Deserialize)]
pub struct AddSongToPlaylistPayload {
    pub cancion_id: String,
    pub song_source: Option<String>,
    #[serde(default)]
    pub titulo: Option<String>,
    #[serde(default)]
    pub artista: Option<String>,
    #[serde(default)]
    pub portada: Option<String>,
    #[serde(default)]
    pub url: Option<String>,
    pub duracion: Option<i32>,
}

#[derive(Deserialize)]
pub struct AddHistoryPayload {
    // Tolerante: el frontend puede enviar el id como string o como número. Aceptamos
    // ambos (y ausencia) para no devolver un 422 opaco; validamos en el handler.
    #[serde(default)]
    pub cancion_id: Option<serde_json::Value>,
}

#[derive(Deserialize)]
pub struct RenamePlaylistPayload {
    pub nombre: String,
}

#[derive(Deserialize)]
pub struct ReorderPlaylistPayload {
    /// track_ids en el nuevo orden (completo o parcial: solo se actualizan los listados).
    pub order: Vec<String>,
}

/// Convierte un id JSON (string o número) a String no vacío.
pub fn json_id_to_string(v: &serde_json::Value) -> Option<String> {
    let s = match v {
        serde_json::Value::String(s) => s.clone(),
        serde_json::Value::Number(n) => n.to_string(),
        _ => return None,
    };
    if s.trim().is_empty() {
        None
    } else {
        Some(s)
    }
}

#[derive(Deserialize)]
pub struct ToggleLikePayload {
    pub id: Option<String>,
    pub identifier: Option<String>,
    pub name: Option<String>,
    pub title: Option<String>,
    pub creator: Option<String>,
    pub artist: Option<String>,
    #[allow(dead_code)]
    pub album: Option<String>,
    pub portada: Option<String>,
    pub duration: Option<f64>,
}

#[derive(Deserialize)]
pub struct LikesDetailedQuery {
    /// 'local' | 'archive' | ausente (= todos)
    pub source: Option<String>,
}

// -------------------------------------------------------------------------
// ERRORES DE DOMINIO (el binario mapea a status; el mensaje = cuerpo)
// -------------------------------------------------------------------------
#[derive(Debug, Error)]
pub enum RenameError {
    #[error("Nombre requerido")]
    EmptyName,
    #[error("No encontrada")]
    NotFound,
    #[error("Error DB: {0}")]
    Db(sqlx::Error),
}

/// `NotFound` → 404 "Playlist no encontrada"; `Db` → 500 "Error DB".
#[derive(Debug)]
pub enum TogglePlaylistLikeError {
    NotFound,
    Db,
}

/// `NotFound` → 404 "Playlist no encontrada"; `Insert` → 500 "Error al añadir canción".
#[derive(Debug)]
pub enum AddSongError {
    NotFound,
    Insert,
}

/// `Invalid` → 400 "Orden inválido"; `NotFound` → 404 "Playlist no encontrada";
/// `Db` → 500 "Error DB".
#[derive(Debug)]
pub enum ReorderError {
    Invalid,
    NotFound,
    Db,
}

/// `MissingId` → 400 "Missing ID".
#[derive(Debug)]
pub enum ToggleIaLikeError {
    MissingId,
}

impl TidolCore {
    // -------------------------------------------------------------------------
    // PLAYLISTS
    // -------------------------------------------------------------------------
    pub async fn get_playlists(&self, user_id: i64) -> Vec<serde_json::Value> {
        // Enriquecido: dueño, nº de canciones, duración total, likes y portada
        // (primera canción). Antes solo {id, nombre} y la Library mostraba
        // "0 canciones" y sin imagen para todo.
        let rows = sqlx::query!(
            r#"
            SELECT
                p.id, p.name, p.created_at,
                u.username AS owner,
                (SELECT COUNT(*) FROM playlist_songs ps WHERE ps.playlist_id = p.id) AS song_count,
                (SELECT CAST(COALESCE(SUM(ps.duration), 0) AS SIGNED) FROM playlist_songs ps WHERE ps.playlist_id = p.id) AS total_duration,
                (SELECT COUNT(*) FROM playlist_likes pl WHERE pl.playlist_id = p.id) AS likes,
                (SELECT ps.cover_url FROM playlist_songs ps WHERE ps.playlist_id = p.id ORDER BY ps.position ASC, ps.added_at ASC LIMIT 1) AS cover_url
            FROM playlists p
            JOIN users u ON u.id = p.user_id
            WHERE p.user_id = ?
            ORDER BY p.created_at DESC
            "#,
            user_id
        )
        .fetch_all(&self.db)
        .await
        .unwrap_or_else(|e| {
            // No silenciar: antes un fallo de DB devolvía lista vacía sin rastro.
            tracing::error!("user_data: error de DB en listado de playlists: {}", e);
            Vec::new()
        });

        rows.into_iter()
            .map(|r| {
                serde_json::json!({
                    "id": r.id,
                    "nombre": r.name,
                    "creada_en": r.created_at.map(|dt| dt.unix_timestamp()),
                    "owner": r.owner,
                    "songCount": r.song_count,
                    "totalDuration": r.total_duration,
                    "likes": r.likes,
                    "coverUrl": r.cover_url
                })
            })
            .collect()
    }

    pub async fn create_playlist(
        &self,
        user_id: i64,
        payload: CreatePlaylistPayload,
    ) -> Result<serde_json::Value, crate::error::TidolError> {
        let playlist_id = Uuid::new_v4().to_string();

        // El `?` convierte sqlx::Error → TidolError::Db (vía #[from]); el binario
        // lo mapea a (500, "Error DB: {e}") preservando el cuerpo legado.
        sqlx::query!(
            "INSERT INTO playlists (id, user_id, name) VALUES (?, ?, ?)",
            playlist_id,
            user_id,
            payload.nombre
        )
        .execute(&self.db)
        .await?;

        Ok(serde_json::json!({
            "id": playlist_id,
            "nombre": payload.nombre
        }))
    }

    /// Devuelve `true` si se eliminó (rows > 0). Un error de DB o 0 filas → `false`
    /// (idéntico al comportamiento previo: ambos casos daban 404).
    pub async fn delete_playlist(&self, user_id: i64, playlist_id: &str) -> bool {
        sqlx::query!(
            "DELETE FROM playlists WHERE id = ? AND user_id = ?",
            playlist_id,
            user_id
        )
        .execute(&self.db)
        .await
        .map(|res| res.rows_affected() > 0)
        .unwrap_or(false)
    }

    /// GET /api/v1/playlists/:id — metadata de una playlist + sus canciones.
    /// `None` → 404, tanto si no existe como si es de otro usuario: una playlist
    /// ajena es indistinguible de una inexistente.
    pub async fn get_playlist(
        &self,
        user_id: i64,
        playlist_id: &str,
    ) -> Option<serde_json::Value> {
        let playlist = sqlx::query!(
            r#"
            SELECT
                p.id, p.name, p.created_at, p.user_id,
                u.username AS owner,
                (SELECT COUNT(*) FROM playlist_likes pl WHERE pl.playlist_id = p.id) AS likes,
                (SELECT CAST(EXISTS(
                    SELECT 1 FROM playlist_likes pl2 WHERE pl2.playlist_id = p.id AND pl2.user_id = ?
                ) AS SIGNED)) AS liked_by_me
            FROM playlists p
            JOIN users u ON u.id = p.user_id
            WHERE p.id = ? AND p.user_id = ?
            "#,
            user_id,
            playlist_id,
            user_id
        )
        .fetch_optional(&self.db)
        .await
        .unwrap_or(None);

        let playlist = playlist?;

        let rows = sqlx::query!(
            "SELECT track_id, song_source, title, artist, cover_url, duration, url FROM playlist_songs WHERE playlist_id = ? ORDER BY position ASC, added_at ASC",
            playlist_id
        )
        .fetch_all(&self.db)
        .await
        .unwrap_or_else(|e| {
            // No silenciar: antes un fallo de DB devolvía lista vacía sin rastro.
            tracing::error!("user_data: error de DB en listado: {}", e);
            Vec::new()
        });

        let total_duration: i64 = rows.iter().map(|r| r.duration.unwrap_or(0) as i64).sum();

        let songs: Vec<serde_json::Value> = rows
            .into_iter()
            .map(|r| {
                // Claves alineadas con normalizeTrack() del frontend: emitimos los
                // nombres canónicos (trackName/artistName/coverArtUrl) además de los
                // legacy (titulo/artista/portada). Antes solo se enviaba
                // artist/artworkUrl → el normalizador los ignoraba y mostraba
                // "Unknown Artist" y la portada por defecto.
                serde_json::json!({
                    "id": r.track_id,
                    "trackId": r.track_id,
                    "sourceType": r.song_source.unwrap_or_else(|| "local".to_string()),
                    "trackName": r.title,
                    "title": r.title,
                    "titulo": r.title,
                    "artistName": r.artist,
                    "artist": r.artist,
                    "artista": r.artist,
                    "coverArtUrl": r.cover_url,
                    "artworkUrl": r.cover_url,
                    "portada": r.cover_url,
                    "duration": r.duration,
                    "duracion": r.duration,
                    // URL de reproducción directa (Internet Archive); las pistas de
                    // catálogo (MusicBrainz) no la tienen y se resuelven vía embed.
                    "url": r.url,
                    "playbackUrl": r.url
                })
            })
            .collect();

        Some(serde_json::json!({
            "id": playlist.id,
            "nombre": playlist.name,
            "creada_en": playlist.created_at.map(|dt| dt.unix_timestamp()),
            "owner": playlist.owner,
            // Siempre `true`: la consulta ya filtra por dueño. Se mantiene en el
            // payload por compatibilidad con los clientes que lo leen.
            "isOwner": playlist.user_id == user_id,
            "likes": playlist.likes,
            "likedByMe": playlist.liked_by_me != 0,
            "songCount": songs.len(),
            "totalDuration": total_duration,
            "songs": songs
        }))
    }

    /// POST /api/v1/playlists/:id/like — alterna el like y devuelve estado + contador.
    pub async fn toggle_playlist_like(
        &self,
        user_id: i64,
        playlist_id: &str,
    ) -> Result<serde_json::Value, TogglePlaylistLikeError> {
        // La playlist debe existir (FK lo garantiza, pero devolvemos 404 limpio).
        let exists = sqlx::query!("SELECT id FROM playlists WHERE id = ?", playlist_id)
            .fetch_optional(&self.db)
            .await
            .unwrap_or(None);
        if exists.is_none() {
            return Err(TogglePlaylistLikeError::NotFound);
        }

        // Toggle: si el DELETE no afectó filas, no había like → insertar.
        let deleted = sqlx::query!(
            "DELETE FROM playlist_likes WHERE playlist_id = ? AND user_id = ?",
            playlist_id,
            user_id
        )
        .execute(&self.db)
        .await
        .map(|r| r.rows_affected())
        .unwrap_or(0);

        let liked = if deleted == 0 {
            let res = sqlx::query!(
                "INSERT IGNORE INTO playlist_likes (playlist_id, user_id) VALUES (?, ?)",
                playlist_id,
                user_id
            )
            .execute(&self.db)
            .await;
            if let Err(e) = res {
                tracing::error!("toggle_playlist_like: fallo al insertar: {}", e);
                return Err(TogglePlaylistLikeError::Db);
            }
            true
        } else {
            false
        };

        let likes = sqlx::query!(
            "SELECT COUNT(*) AS n FROM playlist_likes WHERE playlist_id = ?",
            playlist_id
        )
        .fetch_one(&self.db)
        .await
        .map(|r| r.n)
        .unwrap_or(0);

        Ok(serde_json::json!({ "liked": liked, "likes": likes }))
    }

    /// PATCH /api/v1/playlists/:id — renombra una playlist.
    pub async fn rename_playlist(
        &self,
        user_id: i64,
        playlist_id: &str,
        payload: RenamePlaylistPayload,
    ) -> Result<serde_json::Value, RenameError> {
        let nombre = payload.nombre.trim().to_string();
        if nombre.is_empty() {
            return Err(RenameError::EmptyName);
        }

        let result = sqlx::query!(
            "UPDATE playlists SET name = ? WHERE id = ? AND user_id = ?",
            nombre,
            playlist_id,
            user_id
        )
        .execute(&self.db)
        .await;

        match result {
            Ok(res) if res.rows_affected() > 0 => {
                Ok(serde_json::json!({ "id": playlist_id, "nombre": nombre }))
            }
            Ok(_) => Err(RenameError::NotFound),
            Err(e) => Err(RenameError::Db(e)),
        }
    }

    /// Canciones de una playlist. `None` → 404, igual para una playlist ajena que
    /// para una inexistente.
    pub async fn get_playlist_songs(
        &self,
        user_id: i64,
        playlist_id: &str,
    ) -> Option<Vec<serde_json::Value>> {
        let playlist = sqlx::query!(
            "SELECT id FROM playlists WHERE id = ? AND user_id = ?",
            playlist_id,
            user_id
        )
        .fetch_optional(&self.db)
        .await
        .unwrap_or(None);

        playlist.as_ref()?;

        let rows = sqlx::query!(
            "SELECT track_id, song_source, title, artist, cover_url, duration, url FROM playlist_songs WHERE playlist_id = ? ORDER BY position ASC, added_at ASC",
            playlist_id
        )
        .fetch_all(&self.db)
        .await
        .unwrap_or_else(|e| {
            // No silenciar: antes un fallo de DB devolvía lista vacía sin rastro.
            tracing::error!("user_data: error de DB en listado: {}", e);
            Vec::new()
        });

        let songs: Vec<serde_json::Value> = rows
            .into_iter()
            .map(|r| {
                serde_json::json!({
                    "id": r.track_id,
                    "trackId": r.track_id,
                    "sourceType": r.song_source.unwrap_or_else(|| "local".to_string()),
                    "trackName": r.title,
                    "title": r.title,
                    "titulo": r.title,
                    "artistName": r.artist,
                    "artist": r.artist,
                    "artista": r.artist,
                    "coverArtUrl": r.cover_url,
                    "artworkUrl": r.cover_url,
                    "portada": r.cover_url,
                    "duration": r.duration,
                    "duracion": r.duration,
                    "url": r.url,
                    "playbackUrl": r.url
                })
            })
            .collect();

        Some(songs)
    }

    pub async fn add_song_to_playlist(
        &self,
        user_id: i64,
        playlist_id: &str,
        payload: AddSongToPlaylistPayload,
    ) -> Result<serde_json::Value, AddSongError> {
        let playlist = sqlx::query!(
            "SELECT id FROM playlists WHERE id = ? AND user_id = ?",
            playlist_id,
            user_id
        )
        .fetch_optional(&self.db)
        .await
        .unwrap_or(None);

        if playlist.is_none() {
            return Err(AddSongError::NotFound);
        }

        let source = payload.song_source.unwrap_or_else(|| "local".to_string());
        let duration = payload.duracion.unwrap_or(0);
        let titulo = payload.titulo.unwrap_or_default();
        let artista = payload.artista.unwrap_or_default();
        let portada = payload.portada.unwrap_or_default();
        let url = payload.url.unwrap_or_default();

        // Duplicado: no re-insertar ni mover la canción; avisar al frontend.
        let existing = sqlx::query!(
            "SELECT track_id FROM playlist_songs WHERE playlist_id = ? AND track_id = ?",
            playlist_id,
            payload.cancion_id
        )
        .fetch_optional(&self.db)
        .await
        .unwrap_or(None);

        if existing.is_some() {
            return Ok(serde_json::json!({ "added": false, "already": true }));
        }

        // Orden estable: la canción nueva va al final (MAX(position) + 1).
        let result = sqlx::query!(
            r#"
            INSERT INTO playlist_songs
                (playlist_id, track_id, song_source, title, artist, cover_url, duration, url, position)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?,
                (SELECT COALESCE(MAX(ps.position), 0) + 1 FROM playlist_songs ps WHERE ps.playlist_id = ?))
            ON DUPLICATE KEY UPDATE added_at = added_at
            "#,
            playlist_id,
            payload.cancion_id,
            source,
            titulo,
            artista,
            portada,
            duration,
            url,
            playlist_id
        )
        .execute(&self.db)
        .await;

        match result {
            Ok(_) => Ok(serde_json::json!({ "added": true, "already": false })),
            Err(e) => {
                tracing::error!("add_song_to_playlist: fallo al insertar: {}", e);
                Err(AddSongError::Insert)
            }
        }
    }

    /// PUT /api/v1/playlists/:id/songs/order — persiste el nuevo orden (drag & drop).
    pub async fn reorder_playlist_songs(
        &self,
        user_id: i64,
        playlist_id: &str,
        order: Vec<String>,
    ) -> Result<serde_json::Value, ReorderError> {
        if order.is_empty() || order.len() > 1000 {
            return Err(ReorderError::Invalid);
        }

        let playlist = sqlx::query!(
            "SELECT id FROM playlists WHERE id = ? AND user_id = ?",
            playlist_id,
            user_id
        )
        .fetch_optional(&self.db)
        .await
        .unwrap_or(None);

        if playlist.is_none() {
            return Err(ReorderError::NotFound);
        }

        // Transacción: o se aplica el orden completo o no se aplica nada.
        let mut tx = match self.db.begin().await {
            Ok(tx) => tx,
            Err(e) => {
                tracing::error!("reorder_playlist: no se pudo abrir transacción: {}", e);
                return Err(ReorderError::Db);
            }
        };

        for (idx, track_id) in order.iter().enumerate() {
            let res = sqlx::query!(
                "UPDATE playlist_songs SET position = ? WHERE playlist_id = ? AND track_id = ?",
                (idx as i32) + 1,
                playlist_id,
                track_id
            )
            .execute(&mut *tx)
            .await;
            if let Err(e) = res {
                tracing::error!("reorder_playlist: fallo al actualizar posición: {}", e);
                let _ = tx.rollback().await;
                return Err(ReorderError::Db);
            }
        }

        if let Err(e) = tx.commit().await {
            tracing::error!("reorder_playlist: fallo al hacer commit: {}", e);
            return Err(ReorderError::Db);
        }

        Ok(serde_json::json!({ "ok": true }))
    }

    /// Devuelve `false` si la playlist no existe/no es del usuario (→ 404); `true`
    /// tras intentar el borrado (idéntico al comportamiento previo).
    pub async fn remove_song_from_playlist(
        &self,
        user_id: i64,
        playlist_id: &str,
        track_id: &str,
    ) -> bool {
        let playlist = sqlx::query!(
            "SELECT id FROM playlists WHERE id = ? AND user_id = ?",
            playlist_id,
            user_id
        )
        .fetch_optional(&self.db)
        .await
        .unwrap_or(None);

        if playlist.is_none() {
            return false;
        }

        let _ = sqlx::query!(
            "DELETE FROM playlist_songs WHERE playlist_id = ? AND track_id = ?",
            playlist_id,
            track_id
        )
        .execute(&self.db)
        .await;

        true
    }

    // -------------------------------------------------------------------------
    // HISTORIAL
    // -------------------------------------------------------------------------
    pub async fn get_history(&self, user_id: i64) -> Vec<serde_json::Value> {
        // Fuente única: play_history (la escribe POST /tracks/:mbid/log-play y la
        // leen también Home y "Volver a escuchar").
        let rows = sqlx::query!(
            r#"
            SELECT p.track_mbid AS track_id, p.played_at, t.title, t.artist, t.cover_url
            FROM play_history p
            JOIN track_links t ON t.mbid = p.track_mbid
            WHERE p.user_id = ?
            ORDER BY p.played_at DESC
            LIMIT 50
            "#,
            user_id
        )
        .fetch_all(&self.db)
        .await
        .unwrap_or_else(|e| {
            // No silenciar: antes un fallo de DB devolvía lista vacía sin rastro.
            tracing::error!("user_data: error de DB en listado: {}", e);
            Vec::new()
        });

        rows.into_iter()
            .map(|r| {
                serde_json::json!({
                    "id": r.track_id,
                    "title": r.title,
                    "artist": r.artist,
                    "artworkUrl": r.cover_url,
                    "playedAt": r.played_at.map(|dt| dt.unix_timestamp())
                })
            })
            .collect()
    }

    // -------------------------------------------------------------------------
    // LIKES
    // -------------------------------------------------------------------------
    /// GET /api/v1/music/likes/detailed — favoritos CON metadata para la Library.
    pub async fn get_likes_detailed(
        &self,
        user_id: i64,
        source: Option<String>,
    ) -> Vec<serde_json::Value> {
        // La metadata puede vivir en track_links (mbid, catálogo) o en trackMetadata
        // (caché de búsquedas/IA); se toma la primera disponible.
        let rows = sqlx::query!(
            r#"
            SELECT
                ul.track_id,
                ul.source,
                ul.liked_at,
                COALESCE(tl.title, tm.trackName)        AS title,
                COALESCE(tl.artist, tm.artistName)      AS artist,
                COALESCE(tl.cover_url, tm.coverArtUrl)  AS cover_url
            FROM user_likes ul
            LEFT JOIN track_links   tl ON tl.mbid    = ul.track_id
            LEFT JOIN trackMetadata tm ON tm.trackId = ul.track_id
            WHERE ul.user_id = ?
              AND (? IS NULL
                   OR (? = 'local'   AND ul.source = 'local')
                   OR (? = 'archive' AND ul.source != 'local'))
            ORDER BY ul.liked_at DESC
            "#,
            user_id,
            source,
            source,
            source
        )
        .fetch_all(&self.db)
        .await
        .unwrap_or_else(|e| {
            tracing::error!("user_data: error de DB en likes detailed: {}", e);
            Vec::new()
        });

        rows.into_iter()
            .map(|r| {
                let cover = r
                    .cover_url
                    .filter(|c| !c.is_empty())
                    .unwrap_or_else(|| format!("/api/v1/covers/{}", r.track_id));
                serde_json::json!({
                    "id": r.track_id,
                    "trackId": r.track_id,
                    "title": r.title.unwrap_or_else(|| "Sin título".to_string()),
                    "artist": r.artist.unwrap_or_else(|| "Artista desconocido".to_string()),
                    "coverUrl": cover,
                    "source": r.source,
                    "likedAt": r.liked_at.map(|dt| dt.unix_timestamp())
                })
            })
            .collect()
    }

    pub async fn get_local_likes(&self, user_id: i64) -> Vec<String> {
        let rows = sqlx::query!(
            "SELECT track_id FROM user_likes WHERE user_id = ? AND source = 'local'",
            user_id
        )
        .fetch_all(&self.db)
        .await
        .unwrap_or_else(|e| {
            tracing::error!("user_data: error de DB en listado: {}", e);
            Vec::new()
        });

        rows.into_iter().map(|r| r.track_id).collect()
    }

    pub async fn get_ia_likes(&self, user_id: i64) -> Vec<String> {
        let rows = sqlx::query!(
            "SELECT track_id FROM user_likes WHERE user_id = ? AND source != 'local'",
            user_id
        )
        .fetch_all(&self.db)
        .await
        .unwrap_or_else(|e| {
            tracing::error!("user_data: error de DB en listado: {}", e);
            Vec::new()
        });

        rows.into_iter().map(|r| r.track_id).collect()
    }

    /// POST /api/v1/music/songs/:id/like — da like. Idempotente: repetirlo no
    /// lo quita. `uq_user_likes (user_id, track_id)` sostiene el `INSERT IGNORE`.
    pub async fn set_local_like(&self, user_id: i64, track_id: &str) -> serde_json::Value {
        let _ = sqlx::query!(
            "INSERT IGNORE INTO user_likes (user_id, track_id, source) VALUES (?, ?, 'local')",
            user_id,
            track_id
        )
        .execute(&self.db)
        .await;
        serde_json::json!({"liked": true})
    }

    /// DELETE /api/v1/music/songs/:id/like — quita el like. Idempotente.
    pub async fn unset_local_like(&self, user_id: i64, track_id: &str) -> serde_json::Value {
        let _ = sqlx::query!(
            "DELETE FROM user_likes WHERE user_id = ? AND track_id = ?",
            user_id,
            track_id
        )
        .execute(&self.db)
        .await;
        serde_json::json!({"liked": false})
    }

    pub async fn toggle_ia_like(
        &self,
        user_id: i64,
        payload: ToggleLikePayload,
    ) -> Result<serde_json::Value, ToggleIaLikeError> {
        let track_id = payload
            .id
            .clone()
            .unwrap_or_else(|| payload.identifier.clone().unwrap_or_default());
        if track_id.is_empty() {
            return Err(ToggleIaLikeError::MissingId);
        }

        // Persistir la metadata que envía el cliente: antes se ignoraba y, como
        // las pistas IA no existen en track_links ni (normalmente) en
        // trackMetadata, la Library mostraba "Sin título / Artista desconocido".
        // trackMetadata es la caché que ya lee get_likes_detailed.
        let title = payload.title.clone().or(payload.name.clone()).unwrap_or_default();
        let artist = payload
            .artist
            .clone()
            .or(payload.creator.clone())
            .unwrap_or_default();
        if !title.is_empty() {
            let duration_s = payload.duration.map(|d| d.round() as i32);
            let _ = sqlx::query!(
                r#"
                INSERT INTO trackMetadata (trackId, trackName, artistName, coverArtUrl, durationSeconds, isCached)
                VALUES (?, ?, ?, ?, ?, 0)
                ON DUPLICATE KEY UPDATE
                    trackName       = IF(trackName = '' OR trackName IS NULL, VALUES(trackName), trackName),
                    artistName      = COALESCE(artistName, VALUES(artistName)),
                    coverArtUrl     = COALESCE(coverArtUrl, VALUES(coverArtUrl)),
                    durationSeconds = COALESCE(durationSeconds, VALUES(durationSeconds))
                "#,
                track_id,
                title,
                artist,
                payload.portada,
                duration_s
            )
            .execute(&self.db)
            .await
            .map_err(|e| tracing::warn!("toggle_ia_like: no se pudo cachear metadata: {}", e));
        }

        let existing = sqlx::query!(
            "SELECT track_id FROM user_likes WHERE user_id = ? AND track_id = ?",
            user_id,
            track_id
        )
        .fetch_optional(&self.db)
        .await
        .unwrap_or(None);

        if existing.is_some() {
            let _ = sqlx::query!(
                "DELETE FROM user_likes WHERE user_id = ? AND track_id = ?",
                user_id,
                track_id
            )
            .execute(&self.db)
            .await;
            Ok(serde_json::json!({"liked": false}))
        } else {
            let _ = sqlx::query!(
                "INSERT INTO user_likes (user_id, track_id, source) VALUES (?, ?, 'archive')",
                user_id,
                track_id
            )
            .execute(&self.db)
            .await;
            Ok(serde_json::json!({"liked": true}))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // json_id_to_string: tolerancia string/número de la línea base
    // (add_history_handler @ e46be8bb). Un id vacío o de otro tipo → None → 400.

    #[test]
    fn json_id_acepta_string_no_vacio() {
        assert_eq!(
            json_id_to_string(&serde_json::json!("abc-123")),
            Some("abc-123".to_string())
        );
    }

    #[test]
    fn json_id_acepta_numero() {
        assert_eq!(json_id_to_string(&serde_json::json!(42)), Some("42".to_string()));
        assert_eq!(
            json_id_to_string(&serde_json::json!(3.5)),
            Some("3.5".to_string())
        );
    }

    #[test]
    fn json_id_rechaza_vacio_espacios_y_otros_tipos() {
        assert_eq!(json_id_to_string(&serde_json::json!("")), None);
        assert_eq!(json_id_to_string(&serde_json::json!("   ")), None);
        assert_eq!(json_id_to_string(&serde_json::json!(true)), None);
        assert_eq!(json_id_to_string(&serde_json::json!(null)), None);
        assert_eq!(json_id_to_string(&serde_json::json!(["x"])), None);
        assert_eq!(json_id_to_string(&serde_json::json!({"id": "x"})), None);
    }

    // Mensajes de error observables de rename (cuerpo de la respuesta HTTP).
    #[test]
    fn rename_error_cuerpos_de_linea_base() {
        assert_eq!(RenameError::EmptyName.to_string(), "Nombre requerido");
        assert_eq!(RenameError::NotFound.to_string(), "No encontrada");
        assert!(RenameError::Db(sqlx::Error::RowNotFound)
            .to_string()
            .starts_with("Error DB: "));
    }
}
