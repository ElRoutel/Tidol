import db from "../models/db.js";
import { fetchWithProxy } from "../services/iaProxy.service.js";
import { mediaCacheService } from "../services/mediaCache.service.js";
import { formatSongsForClient, formatAlbumsForClient, formatArtistsForClient } from "../utils/responseFormatter.js";
import NodeCache from 'node-cache';
import providerManager from "../core/ProviderManager.js"; // [NEW]

// Response Cache (5 min TTL)
const responseCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// ---------------- CONFIG ----------------
const MIN_HIT_CONFIDENCE = 0.5;
// ----------------------------------------

function logStatus(name, success, info = "") {
  const icon = success ? "✅" : "❌";
  console.log(`${icon} ${name} ${info}`);
}

// ------------------ UTIL ------------------
function normalizeQuery(q) {
  if (!q) return "";
  return q
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ----------------- DB BOILERPLATE -----------------
async function ensureIaTables() {
  try {
    await db.run(`CREATE TABLE IF NOT EXISTS ia_cache (query TEXT PRIMARY KEY, results TEXT, timestamp INTEGER, last_access INTEGER)`);
    await db.run(`CREATE INDEX IF NOT EXISTS ia_cache_timestamp_idx ON ia_cache(timestamp)`);
    await db.run(`CREATE INDEX IF NOT EXISTS ia_cache_last_access_idx ON ia_cache(last_access)`);

    await db.run(`CREATE TABLE IF NOT EXISTS ia_clicks (query TEXT, identifier TEXT, clicks INTEGER DEFAULT 1, last_clicked INTEGER, PRIMARY KEY (query, identifier))`);
    await db.run(`CREATE INDEX IF NOT EXISTS ia_clicks_query_idx ON ia_clicks(query)`);

    await db.run(`CREATE TABLE IF NOT EXISTS ia_hits (query TEXT PRIMARY KEY, top_identifier TEXT, confidence REAL, last_update INTEGER)`);
    await db.run(`CREATE INDEX IF NOT EXISTS ia_hits_last_update_idx ON ia_hits(last_update)`);

    await db.run(`CREATE TABLE IF NOT EXISTS ia_comparator (term_a TEXT, term_b TEXT, strength REAL DEFAULT 0, last_update INTEGER, PRIMARY KEY (term_a, term_b))`);
    await db.run(`CREATE INDEX IF NOT EXISTS ia_comparator_a_idx ON ia_comparator(term_a)`);
  } catch (err) {
    console.error("Error asegurando tablas IA:", err);
  }
}

// ----------------- LOGICA DE CLICKS (HIT CONFIDENCE) -----------------
async function _registerClickInternal(queryRaw, identifier, title = "", creator = "") {
  await ensureIaTables();
  try {
    const query = normalizeQuery(queryRaw);
    const now = Date.now();
    await db.run(`
      INSERT INTO ia_clicks (query, identifier, clicks, last_clicked)
      VALUES (?, ?, 1, ?)
      ON CONFLICT(query, identifier) DO UPDATE SET clicks = clicks + 1, last_clicked = ?
    `, [query, identifier, now, now]);
    // Cache access update is now potentially provider specific or handled loosely here, sticking to core clicks logic for now.
    await db.run(`UPDATE ia_cache SET last_access = ? WHERE query = ?`, [now, query]);
    await maybeComputeHitFromClicks(query);
  } catch (err) {
    console.error("Error registrando click:", err.message);
  }
}

async function maybeComputeHitFromClicks(queryRaw) {
  await ensureIaTables();
  try {
    const query = normalizeQuery(queryRaw);
    const rows = await db.all(`SELECT identifier, clicks FROM ia_clicks WHERE query = ? ORDER BY clicks DESC LIMIT 10`, [query]);
    if (!rows || rows.length === 0) return;
    const total = rows.reduce((s, r) => s + (r.clicks || 0), 0);
    if (total === 0) return;
    const top = rows[0];
    const confidence = top.clicks / total;
    if (confidence >= MIN_HIT_CONFIDENCE) {
      await db.run(`INSERT OR REPLACE INTO ia_hits (query, top_identifier, confidence, last_update) VALUES (?, ?, ?, ?)`, [query, top.identifier, confidence, Date.now()]);
    }
  } catch (err) {
    console.error("Error calculando ia_hit:", err.message);
  }
}

// ----------------- SEARCH LOCAL -----------------
async function _searchLocal(query) {
  const searchTerm = `%${query.trim()}%`;
  try {
    const [canciones, albums, artists] = await Promise.all([
      db.all(`SELECT c.id, c.titulo, c.archivo AS url, c.portada, c.duracion, c.bit_depth, c.sample_rate, c.bit_rate, c.extracted_colors, a.nombre AS artista, al.titulo AS album, c.album_id AS albumId FROM canciones c LEFT JOIN artistas a ON c.artista_id = a.id LEFT JOIN albumes al ON c.album_id = al.id WHERE c.titulo LIKE ? OR a.nombre LIKE ? OR al.titulo LIKE ? ORDER BY c.titulo ASC LIMIT 50`, [searchTerm, searchTerm, searchTerm]),
      db.all(`SELECT al.id, al.titulo, al.portada, al.extracted_colors, ar.nombre AS autor FROM albumes al LEFT JOIN artistas ar ON al.artista_id = ar.id WHERE al.titulo LIKE ? OR ar.nombre LIKE ? ORDER BY al.titulo ASC LIMIT 20`, [searchTerm, searchTerm]),
      db.all(`SELECT id, nombre, COALESCE(imagen, '/img/default-artist.png') AS imagen FROM artistas WHERE nombre LIKE ? ORDER BY nombre ASC LIMIT 20`, [searchTerm])
    ]);

    const parsedCanciones = canciones.map(s => ({ ...s, extractedColors: s.extracted_colors ? JSON.parse(s.extracted_colors) : null }));
    const parsedAlbums = albums.map(a => ({ ...a, extractedColors: a.extracted_colors ? JSON.parse(a.extracted_colors) : null }));

    logStatus("Sub-búsqueda Local", true, `Éxito para "${query}"`);
    return { canciones: parsedCanciones, albums: parsedAlbums, artists };
  } catch (err) {
    logStatus("Sub-búsqueda Local", false, `Error: ${err.message}`);
    throw new Error("Error en la búsqueda local.");
  }
}

// ------------- PUBLIC CONTROLLERS --------------
export const searchAll = async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim() === "") return res.status(400).json({ error: "Consulta vacía" });

  logStatus("Búsqueda Unificada (Plugin)", true, `Iniciando para: "${q}"`);

  try {
    // Parallel execution: Local DB Search + Plugins Search (via ProviderManager)
    const [localResults, providerResults] = await Promise.all([
      _searchLocal(q),
      providerManager.searchAll(q)
    ]);

    // Separate results by provider for backward compatibility or structured response
    // Specifically filtering 'archive' provider results to map to 'archive' key in JSON
    const archiveResults = providerResults.filter(r => r.provider === 'archive');

    // Future plugins can be added here or sent in a 'external' array
    res.json({ ...localResults, archive: archiveResults });

  } catch (err) {
    logStatus("Búsqueda Unificada", false, err.message);
    res.status(500).json({ error: "Ocurrió un error durante la búsqueda." });
  }
};

export const search = async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim() === "") return res.status(400).json({ error: "Consulta vacía" });
  try {
    const results = await _searchLocal(q);
    res.json(results);
  } catch { res.status(500).json({ error: "Error en la búsqueda" }); }
};

export const searchArchive = async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: "Falta el parámetro q" });
  try {
    // Explicitly calling archive provider search
    const archiveProvider = providerManager.getProvider('archive');
    if (!archiveProvider) throw new Error("Archive provider not available");

    const results = await archiveProvider.search(q);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: "Error al buscar en Internet Archive", details: err.message });
  }
};

export const getRecommendations = async (req, res) => {
  const { songId } = req.params;
  const { played: playedIds = [] } = req.body;
  try {
    const current = await db.get("SELECT * FROM canciones WHERE id = ?", [songId]);
    if (!current) return res.status(404).json({ error: "Canción no encontrada" });
    const placeholders = playedIds.length ? playedIds.map(() => "?").join(",") : "NULL";
    const candidates = await db.all(`SELECT c.id, c.titulo, c.archivo AS url, c.portada, c.duracion, c.bit_depth, c.sample_rate, c.bit_rate, a.nombre AS artista, al.titulo AS album, c.album_id AS albumId FROM canciones c LEFT JOIN artistas a ON c.artista_id = a.id LEFT JOIN albumes al ON c.album_id = al.id WHERE (c.artista_id = ? OR c.album_id = ?) AND c.id != ? AND c.id NOT IN (${placeholders}) ORDER BY RANDOM() LIMIT 10`, [current.artista_id, current.album_id, songId, ...playedIds]);
    res.json(candidates);
  } catch (err) {
    console.error("Error en recomendaciones:", err.message);
    res.status(500).json({ error: "Error generando recomendaciones" });
  }
};

export const getSongs = async (req, res) => {
  try {
    // Add pagination
    const limit = Math.min(parseInt(req.query.limit) || 50, 100); // Max 100
    const offset = parseInt(req.query.offset) || 0;

    const cacheKey = `songs_${limit}_${offset}`;
    const cached = responseCache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const songs = await db.all(`SELECT c.id, c.titulo, c.archivo AS url, c.portada, c.duracion, c.bit_rate, c.bit_depth, c.sample_rate, c.extracted_colors, a.nombre AS artista, al.titulo AS album, c.album_id FROM canciones c LEFT JOIN artistas a ON c.artista_id = a.id LEFT JOIN albumes al ON c.album_id = al.id ORDER BY c.fecha_subida DESC LIMIT ? OFFSET ?`, [limit, offset]);

    const formatted = formatSongsForClient(songs);
    responseCache.set(cacheKey, formatted);
    res.json(formatted);
  } catch (err) {
    console.error('Error getSongs:', err);
    res.status(500).json({ error: "Error listando canciones" });
  }
};

export const getAlbums = async (req, res) => {
  try {
    const cacheKey = 'albums_all';
    const cached = responseCache.get(cacheKey);
    if (cached) return res.json(cached);

    const albums = await db.all(`SELECT al.id, al.titulo, al.portada, al.extracted_colors, ar.nombre AS autor FROM albumes al LEFT JOIN artistas ar ON al.artista_id = ar.id ORDER BY al.titulo ASC`);

    const formatted = formatAlbumsForClient(albums);
    responseCache.set(cacheKey, formatted);
    res.json(formatted);
  } catch (err) { res.status(500).json({ error: "Error al obtener los álbumes" }); }
};

export const getAlbumDetails = async (req, res) => {
  const { id } = req.params;
  try {
    const album = await db.get(`SELECT al.*, ar.nombre AS autor FROM albumes al LEFT JOIN artistas ar ON al.artista_id = ar.id WHERE al.id = ?`, [id]);
    if (!album) return res.status(404).json({ error: "Álbum no encontrado" });
    res.json(album);
  } catch (err) { res.status(500).json({ error: "Error al obtener el álbum" }); }
};

export const getAlbumSongs = async (req, res) => {
  const { id } = req.params;
  try {
    const cacheKey = `album_songs_${id}`;
    const cached = responseCache.get(cacheKey);
    if (cached) return res.json(cached);

    const canciones = await db.all(`SELECT c.id, c.titulo, c.archivo AS url, c.duracion, c.bit_rate, c.bit_depth, c.sample_rate, c.portada, c.extracted_colors, c.album_id, COALESCE(a.nombre, 'Desconocido') AS artista, COALESCE(al.titulo, 'Sin título') AS album FROM canciones c LEFT JOIN artistas a ON c.artista_id = a.id LEFT JOIN albumes al ON c.album_id = al.id WHERE c.album_id = ? ORDER BY c.titulo ASC`, [id]);

    const formatted = formatSongsForClient(canciones);
    responseCache.set(cacheKey, formatted);
    res.json(formatted);
  } catch (err) { res.status(500).json({ error: "Error al obtener canciones" }); }
};

export const getArtists = async (req, res) => {
  try {
    const cacheKey = 'artists_all';
    const cached = responseCache.get(cacheKey);
    if (cached) return res.json(cached);

    const artists = await db.all(`SELECT ar.id, ar.nombre, COALESCE(ar.imagen, '/img/default-artist.png') AS imagen, COUNT(DISTINCT al.id) AS albums, COUNT(DISTINCT c.id) AS canciones FROM artistas ar LEFT JOIN albumes al ON al.artista_id = ar.id LEFT JOIN canciones c ON c.artista_id = ar.id GROUP BY ar.id ORDER BY ar.nombre ASC`);

    const formatted = formatArtistsForClient(artists);
    responseCache.set(cacheKey, formatted);
    res.json(formatted);
  } catch (err) { res.status(500).json({ error: "Error al obtener los artistas" }); }
};

export const getArtistDetails = async (req, res) => {
  const { id } = req.params;
  try {
    const artist = await db.get(`SELECT ar.id, ar.nombre, COALESCE(ar.imagen, '/img/default-artist.png') AS imagen, COUNT(DISTINCT c.id) AS canciones FROM artistas ar LEFT JOIN canciones c ON c.artista_id = ar.id WHERE ar.id = ?`, [id]);
    if (!artist) return res.status(404).json({ error: "Artista no encontrado" });
    const albums = await db.all(`SELECT al.id, al.titulo, al.portada, COUNT(c.id) AS canciones FROM albumes al LEFT JOIN canciones c ON c.album_id = al.id WHERE al.artista_id = ? GROUP BY al.id ORDER BY al.titulo ASC`, [id]);
    res.json({ ...artist, albums });
  } catch (err) { res.status(500).json({ error: "Error al obtener el artista" }); }
};

export const getHomeRecommendations = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 20); // Max 20

    const recommendations = await db.all(`SELECT c.id, c.titulo, c.archivo AS url, c.portada, c.duracion, c.bit_depth, c.sample_rate, c.bit_rate, c.extracted_colors, a.nombre AS artista, al.titulo AS album, c.album_id FROM canciones c LEFT JOIN artistas a ON c.artista_id = a.id LEFT JOIN albumes al ON c.album_id = al.id ORDER BY RANDOM() LIMIT ?`, [limit]);

    res.json(formatSongsForClient(recommendations));
  } catch (err) { res.status(500).json({ error: "Error getting home recommendations" }); }
};

export const getLyricsBySong = async (req, res) => {
  const songId = req.params.id;
  try {
    const lyrics = await db.all("SELECT time_ms, line FROM lyrics WHERE song_id = ? ORDER BY time_ms ASC", [songId]);
    if (!lyrics || lyrics.length === 0) return res.status(404).json({ success: false, error: "No hay letras." });
    res.json({ success: true, lyrics });
  } catch (err) { res.status(500).json({ error: "Error al obtener las letras" }); }
};

// Helper to resolve a local song id from a flexible identifier
async function resolveLocalSongId(rawId) {
  if (!rawId) return null;

  // Try numeric id first
  const num = parseInt(rawId, 10);
  if (!Number.isNaN(num)) {
    const row = await db.get(`SELECT id FROM canciones WHERE id = ?`, [num]);
    if (row) return num;
  }

  // Try exact archivo match (decoded)
  const decoded = decodeURIComponent(rawId || '');
  let row = await db.get(`SELECT id FROM canciones WHERE archivo = ?`, [decoded]);
  if (row) return row.id;

  // Try matching basename
  const basename = decoded.split('/').pop();
  row = await db.get(`SELECT id FROM canciones WHERE archivo LIKE ?`, [`%${basename}%`]);
  if (row) return row.id;

  return null;
}

export const toggleLike = async (req, res) => {
  const userId = req.userId;
  const rawId = req.params.id;
  if (!userId) return res.status(401).json({ error: "No autorizado" });

  try {
    const songId = await resolveLocalSongId(rawId);

    if (!songId) {
      console.warn('⚠️ toggleLike: no local song matched for', rawId);
      return res.status(400).json({ error: "Invalid song identifier - no matching local song found" });
    }

    const existing = await db.get(`SELECT id FROM likes WHERE user_id = ? AND song_id = ?`, [userId, songId]);
    if (existing) {
      await db.run(`DELETE FROM likes WHERE id = ?`, [existing.id]);
      return res.json({ liked: false });
    } else {
      await db.run(`INSERT INTO likes (user_id, song_id) VALUES (?, ?)`, [userId, songId]);
      return res.json({ liked: true });
    }
  } catch (err) {
    console.error('❌ Error en toggleLike:', err.message, 'rawId:', rawId);
    res.status(500).json({ error: "Error al actualizar el like", details: err.message });
  }
};

export const checkIfLiked = async (req, res) => {
  const userId = req.userId;
  const rawId = req.params.id;
  if (!userId) return res.status(401).json({ error: "No autorizado" });

  try {
    const songId = await resolveLocalSongId(rawId);

    if (!songId) return res.json({ liked: false });

    const like = await db.get(`SELECT id FROM likes WHERE user_id = ? AND song_id = ?`, [userId, songId]);
    res.json({ liked: !!like });
  } catch (err) {
    console.error('❌ Error en checkIfLiked:', err.message, 'rawId:', rawId);
    res.status(500).json({ error: "Error al verificar like", details: err.message });
  }
};

export const getUserLikes = async (req, res) => {
  const userId = req.userId;
  if (userId === undefined || userId === null) return res.status(401).json({ error: "No autorizado" });
  try {
    const likes = await db.all(`SELECT c.id, c.titulo, a.nombre AS artista, c.portada, c.archivo AS url, c.duracion, c.bit_depth, c.sample_rate, c.bit_rate, c.extracted_colors, al.titulo AS album, c.album_id AS albumId, l.id AS likeId FROM likes l JOIN canciones c ON c.id = l.song_id JOIN artistas a ON c.artista_id = a.id LEFT JOIN albumes al ON c.album_id = al.id WHERE l.user_id = ? ORDER BY l.id DESC`, [userId]);
    res.json(likes.map(s => ({ ...s, extractedColors: s.extracted_colors ? JSON.parse(s.extracted_colors) : null })));
  } catch (err) {
    console.error("❌ Error en getUserLikes:", err.message);
    res.status(500).json({ error: "Error al obtener canciones con like", details: err.message });
  }
};

export const registerIaClick = async (req, res) => {
  try {
    const { query, identifier, title, creator } = req.body;
    if (!query || !identifier) return res.status(400).json({ error: "Faltan parámetros" });
    await _registerClickInternal(query, identifier, title || "", creator || "");

    // --- TRIGGEAR CACHÉ (STRATEGY: SAVE ON PLAY) ---
    // Si el usuario le dio play, vale la pena guardarla.
    // Solo si tenemos info suficiente.
    if (identifier && title) {
      // Ejecutar en segundo plano (sin await)
      mediaCacheService.cacheSong(identifier, {
        titulo: title,
        artista: creator || "Desconocido",
        album: title, // Fallback si no hay album explicito, el servicio intenta mejorar esto
        // Mejor: Intentar reconstruir metadatos mínimos o pasarlos desde el frontend
        // Por ahora asumimos que el servicio puede resolver la URL final si es necesario
        // O mejor aún: el frontend a veces manda URL.
        url: req.body.url || `https://archive.org/download/${identifier}/${identifier}.mp3`,
        portada: req.body.portada,
        duration: req.body.duration
      }).catch(err => console.error("Background Cache Error:", err.message));
    }
    // -----------------------------------------------
    return res.json({ success: true });
  } catch (err) { return res.status(500).json({ error: "Error al registrar el click" }); }
};

export const registerComparatorRelation = async (req, res) => {
  return res.json({ success: true }); // Simplificado
};

export const registerIaComparator = async (req, res) => {
  return res.json({ success: true }); // Simplificado
};

// ----------------- IA LIKES CONTROLLERS (OPTIMIZADO) -----------------

export const toggleIaLike = async (req, res) => {
  const userId = req.userId;
  const { identifier, title, artist, source, url, portada, duration } = req.body;

  if (!userId) return res.status(401).json({ error: "No autorizado" });
  if (!identifier) return res.status(400).json({ error: "Falta identifier" });
  // Validación necesaria para la nueva DB
  if (!url) return res.status(400).json({ error: "Falta url específica de la canción" });

  const songSource = source || 'internet_archive';

  try {
    // 1. Primero intentamos registrar la canción en la tabla global
    // IMPORTANTE: Aquí estaba el error. Cambiamos el ON CONFLICT.
    await db.run(
      `INSERT INTO canciones_externas 
       (external_id, source, title, artist, song_url, cover_url, duration) 
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(external_id, song_url) DO NOTHING`, // <--- ESTA ES LA LÍNEA MÁGICA
      [
        identifier,
        songSource,
        title || 'Sin título',
        artist || 'Desconocido',
        url,
        portada || `https://archive.org/services/img/${identifier}`,
        duration ? Number(duration) : 0
      ]
    );

    // 2. Recuperamos el ID interno de esa canción
    const externalSong = await db.get(
      `SELECT id FROM canciones_externas WHERE external_id = ? AND song_url = ?`,
      [identifier, url]
    );

    if (!externalSong) throw new Error("Error crítico: No se pudo recuperar el ID de la canción.");

    // 3. Toggle del Like en la tabla de relación usuario-canción
    const existingLike = await db.get(
      `SELECT id FROM likes_externos WHERE user_id = ? AND cancion_externa_id = ?`,
      [userId, externalSong.id]
    );

    if (existingLike) {
      await db.run(`DELETE FROM likes_externos WHERE id = ?`, [existingLike.id]);
      return res.json({ liked: false });
    } else {
      await db.run(`INSERT INTO likes_externos (user_id, cancion_externa_id) VALUES (?, ?)`, [userId, externalSong.id]);
      return res.json({ liked: true });
    }

  } catch (err) {
    console.error("Error toggleIaLike:", err);
    res.status(500).json({ error: "Error al dar like externo" });
  }
};

export const checkIaLike = async (req, res) => {
  const userId = req.userId;
  const { identifier } = req.params;
  // Para ser precisos en el check, necesitaríamos la URL o asumbir que cualquier versión de ese ID está likeada.
  // Por simplicidad, chequeamos si ALGUNA versión de ese external_id está likeada por el user.

  if (!userId) return res.status(401).json({ error: "No autorizado" });

  try {
    const like = await db.get(
      `SELECT l.id FROM likes_externos l
       JOIN canciones_externas c ON l.cancion_externa_id = c.id
       WHERE l.user_id = ? AND c.external_id = ? LIMIT 1`,
      [userId, identifier]
    );
    res.json({ liked: !!like });
  } catch (err) {
    res.status(500).json({ error: "Error checking ia likes" });
  }
};

export const getIaUserLikes = async (req, res) => {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: "No autorizado" });

  try {
    const likes = await db.all(
      `SELECT c.external_id AS identifier, c.title AS titulo, c.artist AS artista, c.cover_url AS portada, c.song_url AS url, c.duration, l.liked_at 
       FROM likes_externos l
       JOIN canciones_externas c ON l.cancion_externa_id = c.id
       WHERE l.user_id = ?
       ORDER BY l.liked_at DESC`,
      [userId]
    );
    res.json(likes);
  } catch (err) {
    res.status(500).json({ error: "Error getting ia likes" });
  }
};

export const getIaDiscoveries = async (req, res) => {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: "No autorizado" });

  try {
    // Simple implementation: return recently played IA songs from history that aren't liked yet
    // or just random hits for discovery. Let's do random hits for now as "Discovery"
    const discoveries = await db.all(`
      SELECT query, top_identifier as identifier, confidence 
      FROM ia_hits 
      ORDER BY RANDOM() 
      LIMIT 20
    `);

    // We might want to enrich this with metadata if available in ia_cache or just return identifiers
    // For now, client likely expects { identifier, title, ... }
    // Let's try to join with ia_clicks/cache if possible, or just return basic info

    res.json(discoveries);
  } catch (err) {
    console.error("Error getIaDiscoveries:", err);
    res.status(500).json({ error: "Error getting discoveries" });
  }
};