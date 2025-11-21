import db from "../models/db.js";
import { fetchWithProxy } from "../services/iaProxy.service.js";

// ---------------- CONFIG ----------------
const CACHE_LIMIT = 500;
const CACHE_EXPIRATION_HOURS = 24;
const CACHE_SMART_EXPIRATION_DAYS = 30;
const CONCURRENCY = 6;
const FETCH_RETRIES = 3;
const FETCH_RETRY_BASE_MS = 300;
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

async function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function fetchWithRetry(url, retries = FETCH_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithProxy(url);
      
      const ok = res && (
          (res.response && Array.isArray(res.response.docs)) || 
          Array.isArray(res.files) ||                                 
          (res.items && Array.isArray(res.items)) ||            
          Array.isArray(res)                                    
      );

      if (ok) return res;

      if (attempt === retries) throw new Error("Invalid response shape");
      throw new Error("Invalid response shape (retrying)");

    } catch (err) {
      if (attempt === retries) {
        logStatus("Fetch fallido", false, `URL: ${url} | ${err.message}`);
        return null;
      }
      const backoff = FETCH_RETRY_BASE_MS * 2 ** attempt;
      await sleep(backoff);
    }
  }
  return null;
}

async function runWithConcurrency(items, worker, concurrency = CONCURRENCY) {
  const results = [];
  let index = 0;

  const runner = async () => {
    while (index < items.length) {
      const i = index++;
      const item = items[i];
      try {
        const r = await worker(item);
        if (Array.isArray(r)) results.push(...r);
        else if (r !== undefined && r !== null) results.push(r);
      } catch (e) {
        // Ignoramos errores individuales
      }
    }
  };

  const slots = Math.min(concurrency, items.length || 0);
  await Promise.all(Array.from({ length: slots }, runner));
  return results;
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

// ----------------- PRUNE CACHE -----------------
async function pruneCache() {
  try {
    const countRes = await db.get("SELECT COUNT(*) as total FROM ia_cache");
    const total = countRes?.total || 0;

    if (total > CACHE_LIMIT) {
      const toRemove = total - CACHE_LIMIT;
      const rows = await db.all(`SELECT rowid FROM ia_cache ORDER BY timestamp ASC LIMIT ?`, [toRemove]);
      const ids = rows.map(r => r.rowid).filter(Boolean);
      if (ids.length) {
        await db.run("BEGIN TRANSACTION");
        await db.run(`DELETE FROM ia_cache WHERE rowid IN (${ids.map(() => '?').join(',')})`, ids);
        await db.run("COMMIT");
      }
    }
  } catch (err) {
    try { await db.run("ROLLBACK"); } catch {}
    console.error("❌ Error limpiando el caché:", err.message);
  }
}

// ----------------- LOGICA DE CLICKS Y CACHÉ -----------------
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
      db.all(`SELECT c.id, c.titulo, c.archivo AS url, c.portada, c.duracion, a.nombre AS artista, al.titulo AS album, c.album_id AS albumId FROM canciones c LEFT JOIN artistas a ON c.artista_id = a.id LEFT JOIN albumes al ON c.album_id = al.id WHERE c.titulo LIKE ? OR a.nombre LIKE ? OR al.titulo LIKE ? ORDER BY c.titulo ASC LIMIT 50`, [searchTerm, searchTerm, searchTerm]),
      db.all(`SELECT al.id, al.titulo, al.portada, ar.nombre AS autor FROM albumes al LEFT JOIN artistas ar ON al.artista_id = ar.id WHERE al.titulo LIKE ? OR ar.nombre LIKE ? ORDER BY al.titulo ASC LIMIT 20`, [searchTerm, searchTerm]),
      db.all(`SELECT id, nombre, COALESCE(imagen, '/img/default-artist.png') AS imagen FROM artistas WHERE nombre LIKE ? ORDER BY nombre ASC LIMIT 20`, [searchTerm])
    ]);
    logStatus("Sub-búsqueda Local", true, `Éxito para "${query}"`);
    return { canciones, albums, artists };
  } catch (err) {
    logStatus("Sub-búsqueda Local", false, `Error: ${err.message}`);
    throw new Error("Error en la búsqueda local.");
  }
}

// ----------------- SEARCH ARCHIVE -----------------
async function _searchArchive(originalQuery) {
  await ensureIaTables();
  const queryKey = normalizeQuery(originalQuery);
  const now = Date.now();
  const expirationLimit = now - (CACHE_EXPIRATION_HOURS * 60 * 60 * 1000);
  const smartExpirationLimit = now - (CACHE_SMART_EXPIRATION_DAYS * 24 * 60 * 60 * 1000);

  try {
    const hit = await db.get(`SELECT top_identifier FROM ia_hits WHERE query = ?`, [queryKey]);
    if (hit && hit.top_identifier) {
      const cachedHit = await db.get(`SELECT results, timestamp FROM ia_cache WHERE query = ?`, [queryKey]);
      if (cachedHit) {
        logStatus("Sub-búsqueda IA", true, `HIT ia_hits`);
        await db.run(`UPDATE ia_cache SET last_access = ? WHERE query = ?`, [now, queryKey]);
        return JSON.parse(cachedHit.results);
      }
    }

    const cached = await db.get(`SELECT results, timestamp FROM ia_cache WHERE query = ?`, [queryKey]);
    if (cached) {
      const ts = cached.timestamp || 0;
      if (ts >= expirationLimit) {
        await db.run(`UPDATE ia_cache SET last_access = ? WHERE query = ?`, [now, queryKey]);
        logStatus("Caché IA", true, `HIT fresco`);
        return JSON.parse(cached.results);
      } else if (ts >= smartExpirationLimit) {
        await db.run(`UPDATE ia_cache SET last_access = ? WHERE query = ?`, [now, queryKey]);
        logStatus("Caché IA", true, `HIT viejo-background`);
        (async () => { try { await _searchArchiveForceFetch(originalQuery); } catch {} })();
        return JSON.parse(cached.results);
      }
    }

    return await _searchArchiveForceFetch(originalQuery);
  } catch (err) {
    logStatus("Sub-búsqueda IA", false, `Error: ${err.message}`);
    throw new Error("Error al buscar en Internet Archive.");
  }
}

async function _searchArchiveForceFetch(originalQuery) {
  const STOP_WORDS = ["autor", "desconocido", "sin", "titulo", "artist", "unknown", "track", "audio", "official", "video"];
  const queryKey = normalizeQuery(originalQuery);
  const baseTerms = queryKey.split(" ").filter(w => w.length > 2 && !STOP_WORDS.includes(w));

  const searchQueries = [];
  const mediaFilter = `(mediatype:audio OR mediatype:etree)`;

  // 1. Búsqueda Exacta
  if (queryKey.length > 0) {
    searchQueries.push({ q: `(title:"${queryKey}" OR creator:"${queryKey}") AND ${mediaFilter}`, rows: 60 });
  }
  
  // 2. Búsqueda Estricta (AND)
  if (baseTerms.length > 1) {
    const termsAnd = baseTerms.map(t => `"${t}"`).join(" AND ");
    searchQueries.push({ q: `(title:(${termsAnd}) OR creator:(${termsAnd})) AND ${mediaFilter}`, rows: 40 });
  }

  // 3. Búsqueda Fuzzy (~1) - Salva Typos
  if (baseTerms.length > 0) {
    const fuzzyTerms = baseTerms.map(t => `${t}~1`).join(" AND ");
    searchQueries.push({ q: `(title:(${fuzzyTerms}) OR creator:(${fuzzyTerms})) AND ${mediaFilter}`, rows: 40 });
  }

  const urls = searchQueries.map(sq => {
    const qEncoded = encodeURIComponent(sq.q + ` AND format:(mp3 OR flac OR VBR MP3)`);
    return `https://archive.org/advancedsearch.php?q=${qEncoded}&fl=identifier,title,creator,format,downloads&sort=downloads+desc&rows=${sq.rows}&page=1&output=json`;
  });

  const docs = await runWithConcurrency(
    urls,
    async (url) => {
      const r = await fetchWithRetry(url);
      return r?.response?.docs || [];
    },
    3
  );

  const flatResults = docs || [];
  const uniqueMap = {};

  flatResults.forEach(item => {
    if (!item || !item.identifier) return;
    if (item.identifier.match(/\.(mp3|flac|wav|jpg|png|xml|txt)$/i)) return; 
    if (item.identifier.includes(" ")) return; 

    const id = item.identifier;
    item.downloads = item.downloads ? parseInt(item.downloads, 10) : 0;
    if (!uniqueMap[id]) uniqueMap[id] = item;
  });

  let uniqueResults = Object.values(uniqueMap);

  // Ordenamiento Híbrido
  const queryWords = normalizeQuery(originalQuery).split(" ").filter(w => w.length > 2);
  uniqueResults.sort((a, b) => {
    const aText = normalizeQuery(`${a.title} ${a.creator}`);
    const bText = normalizeQuery(`${b.title} ${b.creator}`);
    let scoreA = 0, scoreB = 0;

    queryWords.forEach(word => {
        if (aText.includes(word)) scoreA += 3;
        if (bText.includes(word)) scoreB += 3;
        if (word.length > 4 && aText.includes(word.substring(0, 4))) scoreA += 1;
        if (word.length > 4 && bText.includes(word.substring(0, 4))) scoreB += 1;
    });

    if (Math.abs(scoreA - scoreB) >= 2) return scoreB - scoreA;
    return (b.downloads || 0) - (a.downloads || 0);
  });

  const limited = uniqueResults.slice(0, 50);

  // Enriquecimiento Híbrido
  const enriched = await runWithConcurrency(
    limited.map(r => r.identifier),
    async (identifier) => {
      return await _getIaSongDetails(identifier, limited);
    },
    CONCURRENCY
  );

  const finalResults = enriched.filter(Boolean);

  try {
    await db.run(`REPLACE INTO ia_cache (query, results, timestamp, last_access) VALUES (?, ?, ?, ?)`, [queryKey, JSON.stringify(finalResults), Date.now(), Date.now()]);
    await pruneCache();
  } catch (err) {
    console.error("Error guardando cache IA:", err.message);
  }

  logStatus("Sub-búsqueda IA", true, `Éxito para "${originalQuery}", ${finalResults.length} resultados.`);
  return finalResults;
}

/**
 * LA FUNCIÓN "TODO TERRENO" (HÍBRIDA)
 * Se mantiene para la búsqueda, pero ya NO se usa para listar Likes.
 */
async function _getIaSongDetails(identifier, limited = null) {
  if (limited && Array.isArray(limited)) {
    const basic = limited.find(x => x.identifier === identifier);
    if (basic && basic.url && basic.portada) return basic;
  }

  try {
    const cleanId = identifier.replace(/\.(mp3|flac|wav|m4a)$/i, '');
    const encodedId = encodeURIComponent(cleanId);
    
    const meta = await fetchWithRetry(`https://archive.org/metadata/${encodedId}`);
    
    if (!meta) {
        if (limited) {
            const fallback = limited.find(x => x.identifier === identifier);
            if (fallback) return fallback;
        }
        throw new Error("Metadata no encontrada");
    }

    const files = meta?.files || [];
    
    let audioFile = files.find(f => f.name && /(\.flac$)/i.test(f.name));
    if (!audioFile) audioFile = files.find(f => f.format === 'VBR MP3');
    if (!audioFile) audioFile = files.find(f => f.name && /(\.mp3$)/i.test(f.name));
    if (!audioFile) audioFile = files.find(f => f.format && /(flac|wav|m4a|mp3)/i.test(f.format));
    
    const filename = audioFile ? audioFile.name : null;
    
    if (!filename) throw new Error("No audio file found");

    const url = `https://archive.org/download/${encodedId}/${encodeURIComponent(filename)}`;
    
    const imageFiles = files.filter(f => f.name && /\.(jpg|jpeg|png|gif)$/i.test(f.name));
    const preferred = imageFiles.find(f => ['cover.jpg', 'folder.jpg', 'album.jpg', 'front.jpg'].includes((f.name || "").toLowerCase()));
    const coverName = preferred ? preferred.name : (imageFiles[0]?.name);
    const cover = coverName 
        ? `https://archive.org/download/${encodedId}/${encodeURIComponent(coverName)}`
        : `https://archive.org/services/img/${encodedId}`;
    
    const metadata = meta.metadata || {};
    
    let tituloFinal = audioFile?.title || metadata.title || "Sin título";
    if (tituloFinal === filename) {
        tituloFinal = tituloFinal.replace(/\.(mp3|flac)$/i, '').replace(/^\d+\s*-?\s*/, '');
    }

    return {
      id: `ia_${cleanId}`,
      identifier: cleanId,
      titulo: tituloFinal,
      artista: metadata.creator || "Autor desconocido",
      url,
      portada: cover,
      duration: audioFile.length ? Number(audioFile.length) : null,
      album: metadata.title 
    };

  } catch (err) {
    return {
      id: `ia_${identifier}`,
      identifier,
      titulo: identifier,
      artista: 'Error de carga',
      url: `https://archive.org/details/${identifier}`,
      portada: `https://archive.org/services/img/${identifier}`,
      duration: null,
      error: err.message
    };
  }
}

// ------------- PUBLIC CONTROLLERS --------------
export const searchAll = async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim() === "") return res.status(400).json({ error: "Consulta vacía" });
  logStatus("Búsqueda Unificada", true, `Iniciando para: "${q}"`);
  try {
    const [localResults, archiveResults] = await Promise.all([ _searchLocal(q), _searchArchive(q) ]);
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
    const results = await _searchArchive(q);
    res.json(results);
  } catch { res.status(500).json({ error: "Error al buscar en Internet Archive" }); }
};

export const getRecommendations = async (req, res) => {
  const { songId } = req.params;
  const { played: playedIds = [] } = req.body;
  try {
    const current = await db.get("SELECT * FROM canciones WHERE id = ?", [songId]);
    if (!current) return res.status(404).json({ error: "Canción no encontrada" });
    const placeholders = playedIds.length ? playedIds.map(() => "?").join(",") : "0";
    const candidates = await db.all(`SELECT c.id, c.titulo, c.archivo AS url, c.portada, c.duracion, a.nombre AS artista, al.titulo AS album, c.album_id AS albumId FROM canciones c LEFT JOIN artistas a ON c.artista_id = a.id LEFT JOIN albumes al ON c.album_id = al.id WHERE (c.artista_id = ? OR c.album_id = ?) AND c.id != ? AND c.id NOT IN (${placeholders}) ORDER BY RANDOM() LIMIT 10`, [current.artista_id, current.album_id, songId, ...playedIds]);
    res.json(candidates);
  } catch (err) {
    console.error("Error en recomendaciones:", err.message);
    res.status(500).json({ error: "Error generando recomendaciones" });
  }
};

export const getSongs = async (req, res) => {
  try {
    const songs = await db.all(`SELECT c.id, c.titulo, c.archivo AS url, c.portada, c.duracion, c.bit_rate, c.bit_depth, c.sample_rate, a.nombre AS artista, al.titulo AS album FROM canciones c LEFT JOIN artistas a ON c.artista_id = a.id LEFT JOIN albumes al ON c.album_id = al.id ORDER BY c.fecha_subida DESC`);
    res.json(songs);
  } catch (err) { res.status(500).json({ error: "Error listando canciones" }); }
};

export const getAlbums = async (req, res) => {
  try {
    const albums = await db.all(`SELECT al.id, al.titulo, al.portada, ar.nombre AS autor FROM albumes al LEFT JOIN artistas ar ON al.artista_id = ar.id ORDER BY al.titulo ASC`);
    res.json(albums);
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
    const canciones = await db.all(`SELECT c.id, c.titulo, c.archivo AS url, c.duracion, c.bit_rate, c.bit_depth, c.sample_rate, c.portada, c.album_id, COALESCE(a.nombre, 'Desconocido') AS artista, COALESCE(al.titulo, 'Sin título') AS album FROM canciones c LEFT JOIN artistas a ON c.artista_id = a.id LEFT JOIN albumes al ON c.album_id = al.id WHERE c.album_id = ? ORDER BY c.titulo ASC`, [id]);
    res.json(canciones);
  } catch (err) { res.status(500).json({ error: "Error al obtener canciones" }); }
};

export const getArtists = async (req, res) => {
  try {
    const artists = await db.all(`SELECT ar.id, ar.nombre, COALESCE(ar.imagen, '/img/default-artist.png') AS imagen, COUNT(DISTINCT al.id) AS albums, COUNT(DISTINCT c.id) AS canciones FROM artistas ar LEFT JOIN albumes al ON al.artista_id = ar.id LEFT JOIN canciones c ON c.artista_id = ar.id GROUP BY ar.id ORDER BY ar.nombre ASC`);
    res.json(artists);
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
    const recommendations = await db.all(`SELECT c.id, c.titulo, c.archivo AS url, c.portada, c.duracion, a.nombre AS artista, al.titulo AS album FROM canciones c LEFT JOIN artistas a ON c.artista_id = a.id LEFT JOIN albumes al ON c.album_id = al.id ORDER BY RANDOM() LIMIT 10`);
    res.json(recommendations);
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

export const toggleLike = async (req, res) => {
  const userId = req.userId;
  const songId = req.params.id;
  if (!userId) return res.status(401).json({ error: "No autorizado" });
  try {
    const existing = await db.get(`SELECT id FROM likes WHERE user_id = ? AND song_id = ?`, [userId, songId]);
    if (existing) {
      await db.run(`DELETE FROM likes WHERE id = ?`, [existing.id]);
      return res.json({ liked: false });
    } else {
      await db.run(`INSERT INTO likes (user_id, song_id) VALUES (?, ?)`, [userId, songId]);
      return res.json({ liked: true });
    }
  } catch (err) { res.status(500).json({ error: "Error al actualizar el like" }); }
};

export const checkIfLiked = async (req, res) => {
  const userId = req.userId;
  const songId = req.params.id;
  if (!userId) return res.status(401).json({ error: "No autorizado" });
  try {
    const like = await db.get(`SELECT id FROM likes WHERE user_id = ? AND song_id = ?`, [userId, songId]);
    res.json({ liked: !!like });
  } catch (err) { res.status(500).json({ error: "Error al verificar like" }); }
};

export const getUserLikes = async (req, res) => {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: "No autorizado" });
  try {
    const likes = await db.all(`SELECT c.id, c.titulo, a.nombre AS artista, c.portada, c.archivo AS url, c.duracion, al.titulo AS album, c.album_id AS albumId, l.id AS likeId FROM likes l JOIN canciones c ON c.id = l.song_id JOIN artistas a ON c.artista_id = a.id LEFT JOIN albumes al ON c.album_id = al.id WHERE l.user_id = ? ORDER BY l.id DESC`, [userId]);
    res.json(likes);
  } catch (err) { res.status(500).json({ error: "Error al obtener canciones con like" }); }
};

export const registerIaClick = async (req, res) => {
  try {
    const { query, identifier, title, creator } = req.body;
    if (!query || !identifier) return res.status(400).json({ error: "Faltan parámetros" });
    await _registerClickInternal(query, identifier, title || "", creator || "");
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
  // IMPORTANTE: El frontend DEBE enviar 'url' (el archivo específico).
  const { identifier, title, artist, source, url, portada, duration } = req.body;

  if (!userId) return res.status(401).json({ error: "No autorizado" });
  if (!identifier) return res.status(400).json({ error: "Falta identifier" });
  if (!url) return res.status(400).json({ error: "Falta url específica de la canción" });

  const songSource = source || 'internet_archive';

  try {
    // 1. Buscar si la canción específica (ID + URL) ya existe en DB
    let externalSong = await db.get(
      `SELECT id FROM canciones_externas WHERE external_id = ? AND song_url = ?`,
      [identifier, url]
    );

    // 2. Si no existe, la creamos
    if (!externalSong) {
      const cleanTitle = title || 'Sin título';
      const cleanArtist = artist || 'Desconocido';
      const coverUrl = portada || `https://archive.org/services/img/${identifier}`;
      const songDuration = duration ? Number(duration) : 0;

      // Insertamos con la nueva restricción UNIQUE(external_id, song_url)
      await db.run(
        `INSERT INTO canciones_externas 
         (external_id, source, title, artist, song_url, cover_url, duration) 
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(external_id, song_url) DO NOTHING`, 
        [identifier, songSource, cleanTitle, cleanArtist, url, coverUrl, songDuration]
      );

      externalSong = await db.get(
        `SELECT id FROM canciones_externas WHERE external_id = ? AND song_url = ?`,
        [identifier, url]
      );
    }

    if (!externalSong) throw new Error("No se pudo registrar la canción externa.");

    // 3. Toggle del Like
    const existingLike = await db.get(
      `SELECT id FROM likes_externos WHERE user_id = ? AND cancion_externa_id = ?`,
      [userId, externalSong.id]
    );

    if (existingLike) {
      await db.run(`DELETE FROM likes_externos WHERE id = ?`, [existingLike.id]);
      return res.json({ liked: false });
    } else {
      await db.run(
        `INSERT INTO likes_externos (user_id, cancion_externa_id, liked_at) VALUES (?, ?, ?)`,
        [userId, externalSong.id, Date.now()]
      );
      return res.json({ liked: true });
    }

  } catch (err) {
    console.error("Error al alternar like de IA:", err.message);
    res.status(500).json({ error: "Error al actualizar el like" });
  }
};

export const checkIfIaLiked = async (req, res) => {
  const userId = req.userId;
  // Necesitamos la URL para ser precisos, pero mantenemos compatibilidad
  const { identifier, url } = req.query;

  if (!userId) return res.status(401).json({ error: "No autorizado" });
  if (!identifier) return res.status(400).json({ error: "Falta identifier" });

  try {
    let query = `SELECT id FROM canciones_externas WHERE external_id = ?`;
    let params = [identifier];

    if (url) {
        query += ` AND song_url = ?`;
        params.push(url);
    }

    const externalSong = await db.get(query, params);

    if (!externalSong) return res.json({ liked: false });

    const like = await db.get(
      `SELECT id FROM likes_externos WHERE user_id = ? AND cancion_externa_id = ?`,
      [userId, externalSong.id]
    );
    
    res.json({ liked: !!like });
  } catch (err) {
    console.error("Error al verificar like de IA:", err);
    res.status(500).json({ error: "Error al verificar like" });
  }
};

export const getUserIaLikes = async (req, res) => {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: "No autorizado" });

  try {
    // LECTURA OPTIMIZADA: Lee directamente de la DB local. 
    // Sin fetch a archive.org = Carga instantánea y sin bloqueos de IP.
    const likedSongs = await db.all(`
      SELECT 
        ce.external_id as identifier,
        ce.title as titulo,
        ce.artist as artista,
        ce.cover_url as portada,
        ce.song_url as url,
        ce.duration,
        le.liked_at
      FROM likes_externos le
      JOIN canciones_externas ce ON ce.id = le.cancion_externa_id
      WHERE le.user_id = ?
      ORDER BY le.liked_at DESC
    `, [userId]);

    const results = likedSongs.map(song => ({
        id: `ia_${song.identifier}`,
        identifier: song.identifier,
        titulo: song.titulo,
        artista: song.artista,
        portada: song.portada,
        url: song.url,
        duration: song.duration,
        source: 'internet_archive'
    }));

    res.json(results);
  } catch (err) {
    console.error("Error al obtener likes de IA:", err);
    res.status(500).json({ error: "Error al obtener canciones con like" });
  }
};

export const getCover = async (req, res) => {
  const identifier = req.params[0]; 
  if (!identifier) return res.status(400).json({ error: "Falta identifier" });
  const cleanId = identifier.replace(/\.(mp3|flac|wav|m4a)$/i, '');
  try {
    const meta = await fetchWithRetry(`https://archive.org/metadata/${encodeURIComponent(cleanId)}`);
    if (!meta) throw new Error("No se encontró metadata");
    const files = meta?.files || [];
    const imageFiles = files.filter(f => f.name && /\.(jpg|jpeg|png|gif)$/i.test(f.name));
    const preferred = imageFiles.find(f => ['cover.jpg', 'folder.jpg', 'album.jpg', 'front.jpg'].includes((f.name || "").toLowerCase()));
    let cover;
    if (preferred) {
      cover = `https://archive.org/download/${cleanId}/${encodeURIComponent(preferred.name)}`;
    } else {
      cover = `https://archive.org/services/img/${cleanId}`;
    }
    res.json({ portada: cover });
  } catch (err) { res.status(500).json({ error: "Error al obtener la portada" }); }
};

export default {
  searchAll, search, searchArchive, getRecommendations, getSongs, getAlbums, getAlbumDetails, getAlbumSongs, getArtists, getArtistDetails, getHomeRecommendations, getLyricsBySong, toggleLike, checkIfLiked, getUserLikes, registerIaClick, registerComparatorRelation, registerIaComparator, toggleIaLike, checkIfIaLiked, getUserIaLikes, getCover
};