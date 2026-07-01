use crate::models::{
    AlbumResponse, ArtistProfileResponse, PaginationMeta, SearchResponse, TrackResponse,
};
use musicbrainz_rs::entity::artist::Artist;
use musicbrainz_rs::entity::recording::Recording;
use musicbrainz_rs::entity::release_group::ReleaseGroup;
use musicbrainz_rs::{Fetch, Search};
use reqwest::Client;
use serde::Deserialize;
use tracing::{error, info, warn};

#[derive(Deserialize)]
struct ItunesSearchResponse {
    results: Vec<ItunesTrack>,
}
#[derive(Deserialize)]
struct ItunesTrack {
    artworkUrl100: Option<String>,
    artistName: Option<String>,
}

pub fn is_valid_match(query_artist: &str, result_artist: &str) -> bool {
    let normalize = |s: &str| -> String {
        s.to_lowercase()
            .replace("remix", "")
            .replace("feat", "")
            .replace("ft.", "")
            .replace("vevo", "")
            .replace("topic", "")
            .replace("(", "")
            .replace(")", "")
            .replace("-", "")
            .replace(",", "")
            .replace(".", "")
            .replace(" ", "")
            .replace("/ ","")
            .trim()
            .to_string()
    };

    let q_norm = normalize(query_artist);
    let r_norm = normalize(result_artist);

    if q_norm.is_empty() || r_norm.is_empty() {
        return false;
    }

    r_norm.contains(&q_norm) || q_norm.contains(&r_norm)
}

pub struct MetadataOrchestrator {
    http_client: Client,
}

impl MetadataOrchestrator {
    pub fn new() -> Self {
        Self {
            http_client: Client::builder()
                .user_agent("TidolCore/1.0")
                .build()
                .unwrap(),
        }
    }

    pub async fn search_catalog(
        &self,
        query: &str,
        limit: u32,
        offset: u32,
    ) -> Result<SearchResponse, Box<dyn std::error::Error + Send + Sync>> {
        let mut mb_query = Recording::search(query.to_string());
        mb_query.limit(limit as u8).offset(offset as u16);

        let mut artist_query = Artist::search(query.to_string());
        artist_query.limit(3);

        // Ejecutamos ambas en paralelo si es posible, o secuencial.
        let (mb_results_res, artist_results_res) =
            tokio::join!(mb_query.execute_async(), artist_query.execute_async());

        let mb_results = mb_results_res?;
        let mut searched_artists = Vec::new();
        if let Ok(artist_results) = artist_results_res {
            for artist in artist_results.entities {
                let cover_url = self.fetch_apple_artwork(&artist.name, &artist.name).await;
                searched_artists.push(crate::models::ArtistSearchResponse {
                    mbid: artist.id,
                    name: artist.name,
                    cover_url: Some(cover_url),
                });
            }
        }

        let mut enriched_tracks = Vec::new();

        // Términos que delatan grabaciones no canónicas (megamix/karaoke/etc.)
        const BAD_DISAMBIG: [&str; 9] = [
            "megamix",
            "dj-mix",
            "dj mix",
            "mashup",
            "karaoke",
            "tribute",
            "made famous by",
            "originally performed",
            "instrumental",
        ];

        for recording in mb_results.entities {
            // Descartar grabaciones no canónicas según su disambiguation.
            if let Some(disambig) = recording.disambiguation.as_ref() {
                let d = disambig.to_lowercase();
                if BAD_DISAMBIG.iter().any(|b| d.contains(b)) {
                    continue;
                }
            }
            // Descartar videos (versiones en vivo/clips) cuando MB lo marca.
            if recording.video == Some(true) {
                continue;
            }

            let track_id = recording.id;
            let title = recording.title;
            let artist_name = recording
                .artist_credit
                .as_ref()
                .and_then(|c| c.first())
                .map(|c| c.name.clone())
                .unwrap_or_else(|| "Artista Desconocido".to_string());
            let duration_ms = recording.length.unwrap_or(0);

            // Fetch Apple 4K cover
            let apple_cover = self.fetch_apple_artwork(&title, &artist_name).await;

            enriched_tracks.push(TrackResponse {
                track_id,
                title,
                artist: artist_name.clone(),
                cover_url: Some(apple_cover),
                source: "musicbrainz".to_string(),
                duration: Some((duration_ms / 1000) as i32),
                has_lyrics: false,
            });
        }

        Ok(SearchResponse {
            query: query.to_string(),
            canonical_hit: enriched_tracks.first().cloned(),
            local_results: vec![],
            archive_results: enriched_tracks,
            artists: searched_artists,
            pagination: PaginationMeta {
                current_page: (offset / limit) + 1,
                has_next_page: mb_results.count as u32 > (offset + limit),
                total_results: Some(mb_results.count as u32),
            },
        })
    }

    pub async fn get_artist_details(
        &self,
        mbid: &str,
    ) -> Result<ArtistProfileResponse, Box<dyn std::error::Error + Send + Sync>> {
        // Fetch the artist basic details
        let artist = Artist::fetch().id(mbid).execute_async().await?;

        // Try to fetch top release groups for the artist
        let mut rg_query = ReleaseGroup::search(format!(
            "arid:{} AND (primarytype:album OR primarytype:ep)",
            mbid
        ));
        rg_query.limit(10);

        let mut albums = Vec::new();
        if let Ok(rg_results) = rg_query.execute_async().await {
            for rg in rg_results.entities {
                let release_year = rg
                    .first_release_date
                    .and_then(|d| d.0.split('-').next().unwrap_or("").parse::<i32>().ok());
                let album_title = rg.title.clone();
                let cover_url =
                    format!("https://coverartarchive.org/release-group/{}/front", rg.id);

                albums.push(AlbumResponse {
                    id: rg.id,
                    title: album_title,
                    artist_id: artist.id.clone(),
                    artist_name: Some(artist.name.clone()),
                    release_year,
                    cover_url: Some(cover_url),
                });
            }
        }

        // Fetch artist cover and bio
        let artist_cover = self.fetch_apple_artwork(&artist.name, &artist.name).await;
        let biography = self.fetch_wikipedia_bio(&artist.name).await;

        Ok(ArtistProfileResponse {
            id: artist.id,
            name: artist.name,
            cover_url: artist_cover,
            biography,
            albums,
        })
    }

    pub async fn get_artist_discography(
        &self,
        artist_mbid: &str,
        db: &sqlx::MySqlPool,
    ) -> Result<ArtistProfileResponse, Box<dyn std::error::Error + Send + Sync>> {
        // Consultar caché local
        let artist_row: Option<(String, String, Option<String>, String)> =
            sqlx::query_as("SELECT mbid, name, cover_url, status FROM artists WHERE mbid = ?")
                .bind(artist_mbid)
                .fetch_optional(db)
                .await?;

        if let Some((db_mbid, db_name, db_cover, status)) = &artist_row {
            if status == "full_discography_synced" {
                // Traer todos los álbumes
                let album_rows: Vec<(String, String, Option<i32>, Option<String>, Option<String>)> = sqlx::query_as(
                    "SELECT mbid, title, release_year, cover_url, cover_status FROM albums WHERE artist_mbid = ?"
                )
                .bind(artist_mbid)
                .fetch_all(db)
                .await?;

                let albums = album_rows
                    .into_iter()
                    .map(|(id, title, year, cover, status)| AlbumResponse {
                        id,
                        title,
                        artist_id: db_mbid.clone(),
                        artist_name: Some(db_name.clone()),
                        release_year: year,
                        cover_url: if status.as_deref() == Some("not_found") {
                            Some("/default-album.png".to_string())
                        } else {
                            cover
                        },
                    })
                    .collect();

                let biography = self.fetch_wikipedia_bio(db_name).await;

                return Ok(ArtistProfileResponse {
                    id: db_mbid.clone(),
                    name: db_name.clone(),
                    cover_url: db_cover.clone().unwrap_or_default(),
                    biography,
                    albums,
                });
            }
        }

        // Si no está sincronizado, pedir de MusicBrainz
        let mb_url = format!(
            "https://musicbrainz.org/ws/2/artist/{}?fmt=json",
            artist_mbid
        );
        let client = reqwest::Client::new();
        let res = client
            .get(&mb_url)
            .header("User-Agent", "TidolCore/0.1.0 ( contact@tidol.com )")
            .send()
            .await?;

        let mb_data: serde_json::Value = res.json().await?;
        let artist_name = mb_data["name"]
            .as_str()
            .unwrap_or("Unknown Artist")
            .to_string();

        // Obtener Discografía (límite 100)
        let rg_url = format!(
            "https://musicbrainz.org/ws/2/release-group?artist={}&limit=100&fmt=json",
            artist_mbid
        );
        let rg_res = client
            .get(&rg_url)
            .header("User-Agent", "TidolCore/0.1.0 ( contact: elroutel@hotmail.com )")
            .send()
            .await?;
        let rg_data: serde_json::Value = rg_res.json().await?;

        let cover_url = self.fetch_apple_artwork(&artist_name, &artist_name).await;

        // Actualizar/Insertar Artista y marcar como sincronizado
        sqlx::query(
            r#"
            INSERT INTO artists (mbid, name, cover_url, status)
            VALUES (?, ?, ?, 'full_discography_synced')
            ON DUPLICATE KEY UPDATE
                name = VALUES(name),
                cover_url = VALUES(cover_url),
                status = 'full_discography_synced'
            "#,
        )
        .bind(artist_mbid)
        .bind(&artist_name)
        .bind(&cover_url)
        .execute(db)
        .await?;

        let mut albums_res = Vec::new();

        if let Some(release_groups) = rg_data["release-groups"].as_array() {
            for rg in release_groups {
                let rg_id = rg["id"].as_str().unwrap_or("").to_string();
                if rg_id.is_empty() {
                    continue;
                }
                let rg_title = rg["title"].as_str().unwrap_or("").to_string();
                let first_release_date = rg["first-release-date"].as_str().unwrap_or("");
                let release_year = first_release_date
                    .split('-')
                    .next()
                    .and_then(|y| y.parse::<i32>().ok());
                let rg_type = rg["primary-type"].as_str().unwrap_or("album").to_string();

                let rg_cover = format!("https://coverartarchive.org/release-group/{}/front", rg_id);

                // Insertar/actualizar álbum
                sqlx::query(
                    r#"
                    INSERT INTO albums (mbid, artist_mbid, title, release_year, cover_url, type)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        title = VALUES(title),
                        release_year = VALUES(release_year),
                        cover_url = VALUES(cover_url),
                        type = VALUES(type)
                    "#,
                )
                .bind(&rg_id)
                .bind(artist_mbid)
                .bind(&rg_title)
                .bind(release_year)
                .bind(&rg_cover)
                .bind(&rg_type)
                .execute(db)
                .await?;

                albums_res.push(AlbumResponse {
                    id: rg_id,
                    title: rg_title,
                    artist_id: artist_mbid.to_string(),
                    artist_name: Some(artist_name.clone()),
                    release_year,
                    cover_url: Some(rg_cover),
                });
            }
        }

        let biography = self.fetch_wikipedia_bio(&artist_name).await;

        Ok(ArtistProfileResponse {
            id: artist_mbid.to_string(),
            name: artist_name,
            cover_url,
            biography,
            albums: albums_res,
        })
    }

    pub async fn get_album_details(
        &self,
        album_mbid: &str,
        db: &sqlx::MySqlPool,
    ) -> Result<crate::models::AlbumDetailsResponse, Box<dyn std::error::Error + Send + Sync>> {
        let album_row: Option<(
            String,
            Option<String>,
            Option<i32>,
            Option<String>,
            Option<String>,
        )> = sqlx::query_as(
            r#"
            SELECT a.title, ar.name, a.release_year, a.cover_url, a.cover_status
            FROM albums a
            LEFT JOIN artists ar ON a.artist_mbid = ar.mbid
            WHERE a.mbid = ?
            "#,
        )
        .bind(album_mbid)
        .fetch_optional(db)
        .await?;

        let (title, artist_name, release_year, cover_url, cover_status) = match album_row {
            Some(row) => row,
            None => return Err("Album not found in local database".into()),
        };

        let artist_name = artist_name.unwrap_or_else(|| "Desconocido".to_string());

        let mut tracks: Vec<(String, String, Option<i32>, Option<i32>)> = sqlx::query_as(
            r#"
            SELECT track_mbid, title, duration, track_number
            FROM album_tracks
            WHERE album_mbid = ?
            ORDER BY track_number ASC
            "#,
        )
        .bind(album_mbid)
        .fetch_all(db)
        .await?;

        if tracks.is_empty() {
            let client = reqwest::Client::new();
            let mb_search_url = format!(
                "https://musicbrainz.org/ws/2/release?release-group={}&inc=recordings&fmt=json",
                album_mbid
            );
            let res = client
                .get(&mb_search_url)
                .header("User-Agent", "TidolCore/1.0")
                .send()
                .await?;
            let mut mb_data: serde_json::Value = res.json().await?;

            if let Some(releases) = mb_data.get("releases").and_then(|v| v.as_array()) {
                if let Some(first_release) = releases.first() {
                    mb_data = first_release.clone();
                }
            }

            if let Some(media) = mb_data.get("media").and_then(|v| v.as_array()) {
                for m in media {
                    if let Some(track_list) = m.get("tracks").and_then(|v| v.as_array()) {
                        for tr in track_list {
                            let recording = tr.get("recording").unwrap_or(tr);
                            let tr_id = recording["id"].as_str().unwrap_or("").to_string();
                            let tr_title =
                                recording["title"].as_str().unwrap_or("Unknown").to_string();
                            let duration_ms = recording
                                .get("length")
                                .and_then(|v| v.as_i64())
                                .or_else(|| tr.get("length").and_then(|v| v.as_i64()));

                            let duration_sec = duration_ms.map(|d| (d / 1000) as i32);
                            let track_number = tr
                                .get("position")
                                .and_then(|v| v.as_i64())
                                .map(|n| n as i32);

                            if !tr_id.is_empty() {
                                sqlx::query(
                                    r#"
                                    INSERT IGNORE INTO album_tracks (track_mbid, album_mbid, title, duration, track_number)
                                    VALUES (?, ?, ?, ?, ?)
                                    "#
                                )
                                .bind(&tr_id)
                                .bind(album_mbid)
                                .bind(&tr_title)
                                .bind(duration_sec)
                                .bind(track_number)
                                .execute(db)
                                .await?;

                                tracks.push((tr_id, tr_title, duration_sec, track_number));
                            }
                        }
                    }
                }
            }
        }

        let tracks_response = tracks
            .into_iter()
            .map(|(tid, t, d, n)| crate::models::AlbumTrackResponse {
                track_id: tid,
                title: t,
                duration: d,
                track_number: n,
            })
            .collect();

        let final_cover = if cover_status.as_deref() == Some("not_found") {
            "/default-album.png".to_string()
        } else {
            cover_url.unwrap_or_else(|| "/default-album.png".to_string())
        };

        Ok(crate::models::AlbumDetailsResponse {
            mbid: album_mbid.to_string(),
            title,
            artist_name: artist_name.clone(),
            release_year,
            cover_url: Some(final_cover),
            tracks: tracks_response,
        })
    }

    pub async fn fetch_wikipedia_bio(&self, artist_name: &str) -> Option<String> {
        let url = format!(
            "https://es.wikipedia.org/api/rest_v1/page/summary/{}",
            urlencoding::encode(artist_name)
        );
        if let Ok(res) = self.http_client.get(&url).send().await {
            if res.status().is_success() {
                if let Ok(json) = res.json::<serde_json::Value>().await {
                    if let Some(extract) = json.get("extract").and_then(|v| v.as_str()) {
                        return Some(extract.to_string());
                    }
                }
            }
        }
        None
    }

    async fn fetch_apple_artwork(&self, title: &str, artist: &str) -> String {
        let term = format!("{} {}", title, artist);
        let url = format!(
            "https://itunes.apple.com/search?term={}&media=music&limit=3",
            urlencoding::encode(&term)
        );
        let fallback_url = "https://via.placeholder.com/500?text=No+Cover".to_string();

        if let Ok(res) = self.http_client.get(&url).send().await {
            if let Ok(json) = res.json::<ItunesSearchResponse>().await {
                for track in json.results {
                    if let Some(result_artist) = &track.artistName {
                        if is_valid_match(artist, result_artist) {
                            if let Some(artwork_100) = track.artworkUrl100 {
                                return artwork_100.replace("100x100bb.jpg", "1000x1000bb.jpg");
                            }
                        }
                    }
                }
            }
        }
        fallback_url
    }

    pub async fn fetch_apple_music_cover(&self, artist: &str, title: &str) -> Option<String> {
        fn normalize_string(input: &str) -> String {
            let lower = input.to_lowercase();
            let mut result = String::with_capacity(lower.len());
            for c in lower.chars() {
                match c {
                    'á' | 'à' | 'ä' | 'â' => result.push('a'),
                    'é' | 'è' | 'ë' | 'ê' => result.push('e'),
                    'í' | 'ì' | 'ï' | 'î' => result.push('i'),
                    'ó' | 'ò' | 'ö' | 'ô' => result.push('o'),
                    'ú' | 'ù' | 'ü' | 'û' => result.push('u'),
                    'ñ' => result.push('n'),
                    c if c.is_alphanumeric() => result.push(c),
                    _ => {}
                }
            }
            result
        }

        let term = format!("{} {}", artist, title);
        let url = format!(
            "https://itunes.apple.com/search?term={}&entity=song&limit=20",
            urlencoding::encode(&term)
        );

        if let Ok(res) = self.http_client.get(&url).send().await {
            if let Ok(json) = res.json::<serde_json::Value>().await {
                if let Some(results) = json.get("results").and_then(|r| r.as_array()) {
                    let expected_artist = normalize_string(artist);
                    for item in results {
                        if let Some(result_artist_raw) =
                            item.get("artistName").and_then(|a| a.as_str())
                        {
                            let result_artist = normalize_string(result_artist_raw);

                            if result_artist.contains(&expected_artist)
                                || expected_artist.contains(&result_artist)
                            {
                                if let Some(artwork) =
                                    item.get("artworkUrl100").and_then(|a| a.as_str())
                                {
                                    return Some(
                                        artwork
                                            .replace("100x100bb.jpg", "600x600bb.jpg")
                                            .replace("100x100bb", "600x600bb"),
                                    );
                                }
                            }
                        }
                    }
                }
            }
        }
        None
    }

    pub async fn resolve_full_track(
        &self,
        mbid: &str,
        db: &sqlx::MySqlPool,
    ) -> Result<TrackProfile, String> {
        let local_record = sqlx::query(
            "SELECT mbid, title, artist, yt_video_id, genius_id, cover_url FROM track_links WHERE mbid = ? LIMIT 1"
        )
        .bind(mbid)
        .fetch_optional(db)
        .await
        .map_err(|e| format!("Error en base de datos: {}", e))?;

        if let Some(row) = &local_record {
            use sqlx::Row;
            let mbid_str: String = row.get("mbid");
            let title: String = row.get("title");
            let artist: String = row.get("artist");
            let yt_video_id: Option<String> = row.get("yt_video_id");
            let genius_id: Option<String> = row.get("genius_id");
            let cover_url: Option<String> = row.get("cover_url");

            if title != "Unknown" && !title.is_empty() {
                if cover_url.is_none() {
                    if let Some(new_cover) = self.fetch_apple_music_cover(&artist, &title).await {
                        let _ = sqlx::query("UPDATE track_links SET cover_url = ? WHERE mbid = ?")
                            .bind(&new_cover)
                            .bind(&mbid_str)
                            .execute(db)
                            .await;
                    }
                }

                let stream_url = None;
                return Ok(TrackProfile {
                    mbid: mbid_str,
                    title,
                    artist,
                    yt_video_id,
                    genius_id,
                    stream_url,
                });
            }
        }

        // 2. Discovery: obtener de MusicBrainz y buscar
        let recording = Recording::fetch()
            .id(mbid)
            .with_artists()
            .execute_async()
            .await
            .map_err(|e| format!("MusicBrainz lookup failed: {}", e))?;

        let title = recording.title;
        let artist = recording
            .artist_credit
            .as_ref()
            .and_then(|c| c.first())
            .map(|c| c.name.clone())
            .unwrap_or_else(|| "Artista Desconocido".to_string());

        let yt_video_id: Option<String> = None; // YouTube video ID resolved on-demand via embed
        let genius_id = Some(format!(
            "genius_{}",
            mbid.chars().take(8).collect::<String>()
        ));

        let cover_url = self.fetch_apple_music_cover(&artist, &title).await;

        // Guardar nuevo registro maestro o actualizar si es Unknown
       sqlx::query(
    r#"
    INSERT INTO track_links (
        mbid, title, artist, yt_video_id, genius_id, cover_url, soundcloud_track_id
    )
    VALUES (?, ?, ?, ?, ?, ?, NULL)
    ON DUPLICATE KEY UPDATE
        title = VALUES(title),
        artist = VALUES(artist),
        yt_video_id = VALUES(yt_video_id),
        genius_id = VALUES(genius_id),
        cover_url = VALUES(cover_url)
    "#,
)
.bind(mbid)
.bind(&title)
.bind(&artist)
.bind(&yt_video_id)
.bind(&genius_id)
.bind(&cover_url)
.execute(db)
.await
.map_err(|e| format!("Fallo al persistir enlace: {}", e))?;

        let stream_url = None;

        Ok(TrackProfile {
            mbid: mbid.to_string(),
            title,
            artist,
            yt_video_id,
            genius_id,
            stream_url,
        })
    }

    pub async fn get_similar_tracks(
        &self,
        artist: &str,
        title: &str,
        limit: u8,
        db: &sqlx::MySqlPool,
    ) -> Result<Vec<TrackProfile>, String> {
        //Hey dude no use my api key ;D
        let lastfm_api_key = "27ef86c506629a10c7378bd848149f2e";
        let url = format!(
            "http://ws.audioscrobbler.com/2.0/?method=track.getsimilar&artist={}&track={}&api_key={}&format=json&limit={}",
            urlencoding::encode(artist),
            urlencoding::encode(title),
            lastfm_api_key,
            limit
        );

        let res = self
            .http_client
            .get(&url)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;

        let similar_tracks = json
            .get("similartracks")
            .and_then(|s| s.get("track"))
            .and_then(|t| t.as_array());

        let mut result_tracks = Vec::new();

        if let Some(tracks) = similar_tracks {
            for track in tracks {
                let track_name = track["name"].as_str().unwrap_or("");
                let artist_name = track["artist"]["name"].as_str().unwrap_or("");

                if track_name.is_empty() || artist_name.is_empty() {
                    continue;
                }

                let query = format!(
                    "recording:\"{}\" AND artist:\"{}\"",
                    track_name, artist_name
                );
                let mb_url = format!(
                    "https://musicbrainz.org/ws/2/recording?query={}&fmt=json&limit=1",
                    urlencoding::encode(&query)
                );

                if let Ok(mb_res) = self
                    .http_client
                    .get(&mb_url)
                    .header("User-Agent", "TidolCore/1.0")
                    .send()
                    .await
                {
                    if let Ok(mb_json) = mb_res.json::<serde_json::Value>().await {
                        if let Some(recordings) =
                            mb_json.get("recordings").and_then(|r| r.as_array())
                        {
                            if let Some(first) = recordings.first() {
                                if let Some(mbid) = first.get("id").and_then(|id| id.as_str()) {
                                    if let Ok(profile) = self.resolve_full_track(mbid, db).await {
                                        result_tracks.push(profile);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        Ok(result_tracks)
    }

    pub async fn get_listen_again(
        &self,
        db: &sqlx::MySqlPool,
        limit: u8,
        user_id: i64,
    ) -> Result<Vec<crate::models::TrackResponse>, String> {
        let lim = limit as i64;
        let records = sqlx::query!(
            r#"
            SELECT t.mbid, t.title, t.artist, t.cover_url, COUNT(p.id) as play_count, MAX(p.played_at) as last_played
            FROM play_history p
            JOIN track_links t ON p.track_mbid = t.mbid
            WHERE p.user_id = ?
            GROUP BY t.mbid, t.title, t.artist, t.cover_url
            ORDER BY play_count DESC, last_played DESC
            LIMIT ?
            "#,
            user_id,
            lim
        )
        .fetch_all(db)
        .await
        .map_err(|e| e.to_string())?;

        let mut mapped = Vec::new();
        for r in records {
            mapped.push(crate::models::TrackResponse {
                track_id: r.mbid.clone(),
                title: r.title,
                artist: r.artist,
                cover_url: r.cover_url,
                source: "musicbrainz".to_string(),
                duration: None,
                has_lyrics: false,
            });
        }

        for track in mapped.iter().take(3) {
            trigger_bad_engine_prefetch(
                track.track_id.clone(),
                track.artist.clone(),
                track.title.clone(),
                db.clone(),
            );
        }

        Ok(mapped)
    }

    pub async fn get_home_dashboard(
        &self,
        db: &sqlx::MySqlPool,
        user_id: i64,
    ) -> Result<crate::models::HomeDashboardDTO, String> {
        let recent_fut = async {
            let records = sqlx::query!(
                r#"
                SELECT t.mbid, t.title, t.artist, t.cover_url
                FROM play_history p
                JOIN track_links t ON p.track_mbid = t.mbid
                WHERE p.user_id = ?
                GROUP BY t.mbid, t.title, t.artist, t.cover_url
                ORDER BY MAX(p.played_at) DESC
                LIMIT 10
                "#,
                user_id
            )
            .fetch_all(db)
            .await
            .map_err(|e| e.to_string())?;

            let mut mapped = Vec::new();
            for r in records {
                mapped.push(crate::models::TrackResponse {
                    track_id: r.mbid.clone(),
                    title: r.title,
                    artist: r.artist,
                    cover_url: r.cover_url,
                    source: "musicbrainz".to_string(),
                    duration: None,
                    has_lyrics: false,
                });
            }
            Ok::<_, String>(mapped)
        };

        let top_artists_fut = async {
            let records = sqlx::query!(
                r#"
                SELECT a.mbid, a.name, a.cover_url
                FROM play_history p
                JOIN track_links t ON p.track_mbid = t.mbid
                JOIN artists a ON t.artist = a.name
                WHERE p.user_id = ?
                GROUP BY a.mbid, a.name, a.cover_url
                ORDER BY COUNT(p.id) DESC
                LIMIT 6
                "#,
                user_id
            )
            .fetch_all(db)
            .await
            .map_err(|e| e.to_string())?;

            let mut mapped = Vec::new();
            for r in records {
                mapped.push(crate::models::HomeArtistResponse {
                    mbid: r.mbid,
                    name: r.name,
                    cover_url: r.cover_url,
                });
            }
            Ok::<_, String>(mapped)
        };

        let recs_fut = async {
            let most_played = sqlx::query!(
                r#"
                SELECT t.artist, t.title
                FROM play_history p
                JOIN track_links t ON p.track_mbid = t.mbid
                WHERE p.user_id = ?
                GROUP BY t.artist, t.title
                ORDER BY COUNT(p.id) DESC
                LIMIT 1
                "#,
                user_id
            )
            .fetch_optional(db)
            .await
            .map_err(|e| e.to_string())?;

            if let Some(record) = most_played {
                let lastfm_recs = self
                    .get_similar_tracks(&record.artist, &record.title, 10, db)
                    .await
                    .unwrap_or_else(|_| vec![]);
                if !lastfm_recs.is_empty() {
                    let mut mapped = Vec::new();
                    for t in lastfm_recs {
                        mapped.push(crate::models::TrackResponse {
                            track_id: t.mbid.clone(),
                            title: t.title,
                            artist: t.artist,
                            cover_url: Some(format!(
                                "http://localhost:3000/api/v1/covers/{}",
                                t.mbid
                            )),
                            source: "musicbrainz".to_string(),
                            duration: None,
                            has_lyrics: false,
                        });
                    }
                    return Ok::<_, String>(mapped);
                }
            }

            let random_tracks = sqlx::query!(
                r#"
                SELECT mbid, title, artist, cover_url
                FROM track_links
                ORDER BY RAND()
                LIMIT 10
                "#
            )
            .fetch_all(db)
            .await
            .map_err(|e| e.to_string())?;

            let mut mapped = Vec::new();
            for r in random_tracks {
                mapped.push(crate::models::TrackResponse {
                    track_id: r.mbid.clone(),
                    title: r.title,
                    artist: r.artist,
                    cover_url: r.cover_url,
                    source: "musicbrainz".to_string(),
                    duration: None,
                    has_lyrics: false,
                });
            }
            Ok::<_, String>(mapped)
        };

        let (listen_again, recently_played, top_artists, recommendations) = tokio::try_join!(
            self.get_listen_again(db, 20, user_id),
            recent_fut,
            top_artists_fut,
            recs_fut
        )?;

        Ok(crate::models::HomeDashboardDTO {
            listen_again,
            recently_played,
            top_artists,
            recommendations,
        })
    }
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct TrackProfile {
    pub mbid: String,
    pub title: String,
    pub artist: String,
    pub yt_video_id: Option<String>,
    pub genius_id: Option<String>,
    pub stream_url: Option<String>,
}

pub fn trigger_bad_engine_prefetch(
    mbid: String,
    artist: String,
    title: String,
    db: sqlx::MySqlPool,
) {
    tokio::spawn(async move {
        let needs_processing = match sqlx::query_as::<_, (Option<String>,)>(
            "SELECT lyrics_status FROM track_links WHERE mbid = ? LIMIT 1",
        )
        .bind(&mbid)
        .fetch_optional(&db)
        .await
        {
            Ok(Some((Some(ref status),))) => {
                matches!(status.as_str(), "pending" | "not_found" | "plain_only")
            }
            Ok(Some((None,))) => true,
            Ok(None) => true,
            Err(_) => false,
        };

        if needs_processing {
            info!(
                "[Prefetch] 🚀 Pre-calentando Bad Engine para: {} - {} ({})",
                artist, title, mbid
            );
            let workspace_dir = std::env::current_dir()
                .unwrap_or_else(|_| {
                    std::path::PathBuf::from("/home/routel/TidolCore/tidol-workspace")
                });

            let ai_plugin_path = workspace_dir.join("plugins/provider-ai/target/release");

            let _ = tokio::process::Command::new("cargo")
                .arg("run")
                .arg("--release")
                .arg("--bin")
                .arg("bad_engine")
                .current_dir(&workspace_dir)
                .env("TARGET_MBID", &mbid)
                .env("TARGET_ARTIST", &artist)
                .env("TARGET_TITLE", &title)
                .env("LD_LIBRARY_PATH", ai_plugin_path.to_str().unwrap_or(""))
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null())
                .output()
                .await;
        }
    });
}

pub async fn get_radio_tracks(db: &sqlx::MySqlPool) -> Result<Vec<TrackResponse>, String> {
    let records = sqlx::query!(
        r#"
        SELECT mbid, title, artist, cover_url
        FROM track_links 
        WHERE provisional_audio_path IS NOT NULL 
           OR premium_audio_path IS NOT NULL
        ORDER BY RAND() 
        LIMIT 50
        "#
    )
    .fetch_all(db)
    .await
    .map_err(|e| e.to_string())?;

    let tracks = records
        .into_iter()
        .map(|r| TrackResponse {
            track_id: r.mbid,
            title: r.title,
            artist: r.artist,
            cover_url: r.cover_url,
            source: "radio".to_string(),
            duration: None,
            has_lyrics: false,
        })
        .collect();

    Ok(tracks)
}
// RADIO
pub async fn search_tracks_m3u(
    db: &sqlx::MySqlPool,
    query: &str,
) -> Result<Vec<TrackResponse>, String> {
    let like_query = format!("%{}%", query);
    let records = sqlx::query!(
        r#"
        SELECT mbid, title, artist, cover_url 
        FROM track_links 
        WHERE title LIKE ? OR artist LIKE ?
        LIMIT 50
        "#,
        like_query,
        like_query
    )
    .fetch_all(db)
    .await
    .map_err(|e| e.to_string())?;

    let tracks = records
        .into_iter()
        .map(|r| TrackResponse {
            track_id: r.mbid,
            title: r.title,
            artist: r.artist,
            cover_url: r.cover_url,
            source: "search".to_string(),
            duration: None,
            has_lyrics: false,
        })
        .collect();

    Ok(tracks)
}

pub async fn get_album_tracks_m3u(
    db: &sqlx::MySqlPool,
    album_mbid: &str,
) -> Result<Vec<TrackResponse>, String> {
    let records = sqlx::query!(
        r#"
        SELECT tl.mbid, tl.title, tl.artist, tl.cover_url
        FROM album_tracks at
        JOIN track_links tl ON at.track_mbid = tl.mbid
        WHERE at.album_mbid = ?
        ORDER BY at.track_number ASC
        "#,
        album_mbid
    )
    .fetch_all(db)
    .await
    .map_err(|e| e.to_string())?;

    let tracks = records
        .into_iter()
        .map(|r| TrackResponse {
            track_id: r.mbid,
            title: r.title,
            artist: r.artist,
            cover_url: r.cover_url,
            source: "album".to_string(),
            duration: None,
            has_lyrics: false,
        })
        .collect();

    Ok(tracks)
}
