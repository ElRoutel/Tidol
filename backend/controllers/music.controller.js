// backend/controllers/music.controller.js
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
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithProxy(url);
      const ok =
        res &&
        (
          (res.response && Array.isArray(res.response.docs)) || // advancedsearch
          Array.isArray(res.files) ||                           // metadata
          Array.isArray(res)                                    // fallback arrays
        );
      if (ok) return res;
      throw new Error("Invalid response shape");
    } catch (err) {
      lastErr = err;
      if (attempt === retries) {
        logStatus("Fetch con reintentos", false, `URL: ${url} Error: ${err.message}`);
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
      } catch {
        // swallow errors per-task
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
    await db.run(`
      CREATE TABLE IF NOT EXISTS ia_cache (
        query TEXT PRIMARY KEY,
        results TEXT,
        timestamp INTEGER,
        last_access INTEGER
      )
    `);
    await db.run(`CREATE INDEX IF NOT EXISTS ia_cache_timestamp_idx ON ia_cache(timestamp)`);
    await db.run(`CREATE INDEX IF NOT EXISTS ia_cache_last_access_idx ON ia_cache(last_access)`);

    await db.run(`
      CREATE TABLE IF NOT EXISTS ia_clicks (
        query TEXT,
        identifier TEXT,
        clicks INTEGER DEFAULT 1,
        last_clicked INTEGER,
        PRIMARY KEY (query, identifier)
      )
    `);
    await db.run(`CREATE INDEX IF NOT EXISTS ia_clicks_query_idx ON ia_clicks(query)`);

    await db.run(`
      CREATE TABLE IF NOT EXISTS ia_hits (
        query TEXT PRIMARY KEY,
        top_identifier TEXT,
        confidence REAL,
        last_update INTEGER
      )
    `);
    await db.run(`CREATE INDEX IF NOT EXISTS ia_hits_last_update_idx ON ia_hits(last_update)`);

    await db.run(`
      CREATE TABLE IF NOT EXISTS ia_comparator (
        term_a TEXT,
        term_b TEXT,
        strength REAL DEFAULT 0,
        last_update INTEGER,
        PRIMARY KEY (term_a, term_b)
      )
    `);
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
        logStatus("Limpieza de Caché", true, `Eliminados ${ids.length} registros antiguos.`);
      }
    }
  } catch (err) {
    try { await db.run("ROLLBACK"); } catch {}
    console.error("❌ Error limpiando el caché:", err.message);
  }
}

// ----------------- CLICK / COMPARATOR / HITS -----------------
async function _registerClickInternal(queryRaw, identifier, title = "", creator = "") {
  try {
    const query = normalizeQuery(queryRaw);
    const now = Date.now();

    await db.run(`
      INSERT INTO ia_clicks (query, identifier, clicks, last_clicked)
      VALUES (?, ?, 1, ?)
      ON CONFLICT(query, identifier)
      DO UPDATE SET clicks = clicks + 1, last_clicked = ?
    `, [query, identifier, now, now]);

    await db.run(`UPDATE ia_cache SET last_access = ? WHERE query = ?`, [now, query]);

    const qWords = (query.split(" ").filter(Boolean)).slice(0, 8);
    const titleWords = normalizeQuery(title).split(" ").filter(Boolean).slice(0, 8);
    const creatorWords = normalizeQuery(creator).split(" ").filter(Boolean).slice(0, 8);

    await reinforceComparator(qWords, titleWords, creatorWords);

    await maybeComputeHitFromClicks(query);
  } catch (err) {
    console.error("Error registrando click:", err.message);
  }
}

async function reinforceComparator(queryWords = [], titleWords = [], creatorWords = []) {
  try {
    const now = Date.now();
    const all = [...new Set([...(queryWords || []), ...(titleWords || []), ...(creatorWords || [])])];
    const weight = 1.0 / Math.max(1, all.length);

    for (let i = 0; i < all.length; i++) {
      for (let j = 0; j < all.length; j++) {
        if (i === j) continue;
        const a = all[i], b = all[j];
        await db.run(`
          INSERT INTO ia_comparator (term_a, term_b, strength, last_update)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(term_a, term_b)
          DO UPDATE SET strength = strength + ?, last_update = ?
        `, [a, b, weight, now, weight, now]);
      }
    }
  } catch (err) {
    console.error("Error reforzando comparator:", err.message);
  }
}

async function maybeComputeHitFromClicks(queryRaw) {
  try {
    const query = normalizeQuery(queryRaw);
    const rows = await db.all(
      `SELECT identifier, clicks FROM ia_clicks WHERE query = ? ORDER BY clicks DESC LIMIT 10`,
      [query]
    );
    if (!rows || rows.length === 0) return;

    const total = rows.reduce((s, r) => s + (r.clicks || 0), 0);
    if (total === 0) return;

    const top = rows[0];
    const confidence = top.clicks / total;

    if (confidence >= MIN_HIT_CONFIDENCE) {
      await db.run(`
        INSERT OR REPLACE INTO ia_hits (query, top_identifier, confidence, last_update)
        VALUES (?, ?, ?, ?)
      `, [query, top.identifier, confidence, Date.now()]);
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
      db.all(`
        SELECT c.id, c.titulo, c.archivo AS url, c.portada, c.duracion,
               a.nombre AS artista, al.titulo AS album, c.album_id AS albumId
        FROM canciones c
        LEFT JOIN artistas a ON c.artista_id = a.id
        LEFT JOIN albumes al ON c.album_id = al.id
        WHERE c.titulo LIKE ? OR a.nombre LIKE ? OR al.titulo LIKE ?
        ORDER BY c.titulo ASC
        LIMIT 50
      `, [searchTerm, searchTerm, searchTerm]),
      db.all(`
        SELECT al.id, al.titulo, al.portada, ar.nombre AS autor
        FROM albumes al
        LEFT JOIN artistas ar ON al.artista_id = ar.id
        WHERE al.titulo LIKE ? OR ar.nombre LIKE ?
        ORDER BY al.titulo ASC
        LIMIT 20
      `, [searchTerm, searchTerm]),
      db.all(`
        SELECT id, nombre, COALESCE(imagen, '/img/default-artist.png') AS imagen
        FROM artistas
        WHERE nombre LIKE ?
        ORDER BY nombre ASC
        LIMIT 20
      `, [searchTerm])
    ]);
    logStatus("Sub-búsqueda Local", true, `Éxito para "${query}"`);
    return { canciones, albums, artists };
  } catch (err) {
    logStatus("Sub-búsqueda Local", false, `Error para "${query}": ${err.message}`);
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
        const parsed = JSON.parse(cachedHit.results);
        logStatus("Sub-búsqueda IA", true, `HIT ia_hits para "${originalQuery}" -> ${hit.top_identifier}`);
        await db.run(`UPDATE ia_cache SET last_access = ? WHERE query = ?`, [now, queryKey]);
        return parsed;
      }
    }

    const cached = await db.get(`SELECT results, timestamp FROM ia_cache WHERE query = ?`, [queryKey]);
    if (cached) {
      const ts = cached.timestamp || 0;
      if (ts >= expirationLimit) {
        await db.run(`UPDATE ia_cache SET last_access = ? WHERE query = ?`, [now, queryKey]);
        logStatus("Caché IA (Sub-búsqueda)", true, `HIT fresco: "${queryKey}"`);
        return JSON.parse(cached.results);
      } else if (ts >= smartExpirationLimit) {
        await db.run(`UPDATE ia_cache SET last_access = ? WHERE query = ?`, [now, queryKey]);
        logStatus("Caché IA (Sub-búsqueda)", true, `HIT viejo-servir: "${queryKey}", refresh en background`);
        (async () => {
          try {
            await _searchArchiveForceFetch(originalQuery);
          } catch {
            // swallow
          }
        })();
        return JSON.parse(cached.results);
      }
    }

    return await _searchArchiveForceFetch(originalQuery);
  } catch (err) {
    logStatus("Sub-búsqueda IA", false, `Error para "${originalQuery}": ${err.message}`);
    throw new Error("Error al buscar en Internet Archive.");
  }
}

async function _searchArchiveForceFetch(originalQuery) {
  const queryKey = normalizeQuery(originalQuery);
  const baseTerms = queryKey.split(" ").filter(Boolean);
  let expandedTerms = [...baseTerms];

  try {
    if (baseTerms.length) {
      const placeholders = baseTerms.map(() => '?').join(',');
      const comparatorRows = await db.all(
        `SELECT term_b, strength FROM ia_comparator WHERE term_a IN (${placeholders}) ORDER BY strength DESC LIMIT 6`,
        baseTerms
      );
      const extra = (comparatorRows || []).map(r => r.term_b).filter(Boolean);
      expandedTerms.push(...extra);
    }
  } catch {
    // ignore comparator errors
  }

  expandedTerms = [...new Set(expandedTerms)].slice(0, 6);

  const searchQueries = [];
  if (originalQuery.trim().length > 0) {
    searchQueries.push({
      q: `(${`title:"${originalQuery}" OR creator:"${originalQuery}"`}) AND mediatype:audio`,
      rows: 30
    });
  }
  if (expandedTerms.length > 0) {
    const orTerms = expandedTerms.map(t => `"${t}"`).join(" OR ");
    searchQueries.push({
      q: `((title:(${orTerms}) OR creator:(${orTerms}))) AND mediatype:audio`,
      rows: 50
    });
  }
  for (const t of expandedTerms.slice(0, 3)) {
    searchQueries.push({ q: `(title:"${t}" OR creator:"${t}") AND mediatype:audio`, rows: 30 });
  }

  const urls = searchQueries.map(sq => {
    const qEncoded = encodeURIComponent(sq.q + ` AND format:(mp3 OR flac OR wav OR m4a)`);
    return `https://archive.org/advancedsearch.php?q=${qEncoded}&fl[]=identifier,title,creator,format&sort[]=downloads+desc&rows=${sq.rows}&page=1&output=json`;
  });

  const docs = await runWithConcurrency(
    urls,
    async (url) => {
      const r = await fetchWithRetry(url);
      if (!r) return [];
      return r.response?.docs || [];
    },
    CONCURRENCY
  );

  const flatResults = docs || [];
  const counter = {};
  flatResults.forEach(item => {
    if (!item || !item.identifier) return;
    counter[item.identifier] = (counter[item.identifier] || 0) + 1;
  });

  const uniqueMap = {};
  flatResults.forEach(item => {
    if (!item || !item.identifier) return;
    const id = item.identifier;
    if (!uniqueMap[id]) uniqueMap[id] = item;
    else {
      const preferScore = (itm) => {
        const fmt = Array.isArray(itm.format) ? itm.format.join(",") : (itm.format || "");
        if (/flac/i.test(fmt)) return 3;
        if (/wav|m4a/i.test(fmt)) return 2;
        if (/mp3/i.test(fmt)) return 1;
        return 0;
      };
      if (preferScore(item) > preferScore(uniqueMap[id])) uniqueMap[id] = item;
    }
  });

  const uniqueResults = Object.values(uniqueMap);
  uniqueResults.sort((a, b) => (counter[b.identifier] || 0) - (counter[a.identifier] || 0));
  const limited = uniqueResults.slice(0, 50);

  const enriched = await runWithConcurrency(
    limited.map(r => r.identifier),
    async (identifier) => {
      try {
        const meta = await fetchWithRetry(`https://archive.org/metadata/${identifier}`);
        const files = meta?.files || [];
        let audioFile = files.find(f => f.name && /(\.flac$|\.wav$|\.m4a$|\.mp3$)/i.test(f.name));
        if (!audioFile) audioFile = files.find(f => f.format && /(flac|wav|m4a|mp3)/i.test(f.format));
        const filename = audioFile ? audioFile.name : null;
        const url = filename
          ? `https://archive.org/download/${identifier}/${encodeURIComponent(filename)}`
          : `https://archive.org/details/${identifier}`;
        const duration = audioFile && audioFile.length ? Number(audioFile.length) : null;
        const imageFiles = files.filter(f => f.name && /\.(jpg|jpeg|png|gif)$/i.test(f.name));
        const preferred = imageFiles.find(f =>
          ['cover.jpg', 'folder.jpg', 'album.jpg', 'front.jpg'].includes((f.name || "").toLowerCase())
        );
        const cover = preferred
          ? `https://archive.org/download/${identifier}/${encodeURIComponent(preferred.name)}`
          : `https://archive.org/services/img/${identifier}`;
        const basic = limited.find(x => x.identifier === identifier) || {};
        return {
          id: `ia_${identifier}`,
          identifier,
          titulo: basic.title || 'Sin título',
          artista: basic.creator || 'Autor desconocido',
          url,
          portada: cover,
          duration
        };
      } catch {
        return {
          identifier,
          titulo: 'Sin título',
          artista: 'Autor desconocido',
          url: `https://archive.org/details/${identifier}`,
          portada: `https://archive.org/services/img/${identifier}`,
          duration: null
        };
      }
    },
    CONCURRENCY
  );

  try {
    await db.run(
      `REPLACE INTO ia_cache (query, results, timestamp, last_access) VALUES (?, ?, ?, ?)`,
      [queryKey, JSON.stringify(enriched), Date.now(), Date.now()]
    );
    await pruneCache();
  } catch (err) {
    console.error("Error guardando cache IA:", err.message);
  }

  logStatus("Sub-búsqueda IA", true, `Éxito para "${originalQuery}", ${enriched.length} resultados.`);
  return enriched;
}

// ------------- PUBLIC CONTROLLERS --------------
export const searchAll = async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim() === "") {
    return res.status(400).json({ error: "Consulta vacía" });
  }

  logStatus("Búsqueda Unificada", true, `Iniciando para: "${q}"`);
  try {
    const [localResults, archiveResults] = await Promise.all([
      _searchLocal(q),
      _searchArchive(q)
    ]);

    res.json({
      ...localResults,
      archive: archiveResults
    });
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
  } catch {
    res.status(500).json({ error: "Error en la búsqueda" });
  }
};

export const searchArchive = async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: "Falta el parámetro q" });

  try {
    const results = await _searchArchive(q);
    res.json(results);
  } catch {
    res.status(500).json({ error: "Error al buscar en Internet Archive" });
  }
};

export const getRecommendations = async (req, res) => {
  const { songId } = req.params;
  const { played: playedIds = [] } = req.body;

  try {
    const current = await db.get("SELECT * FROM canciones WHERE id = ?", [songId]);
    if (!current) return res.status(404).json({ error: "Canción no encontrada" });

    const placeholders = playedIds.length ? playedIds.map(() => "?").join(",") : "0";

    const candidates = await db.all(`
      SELECT c.id, c.titulo, c.archivo AS url, c.portada, c.duracion,
             a.nombre AS artista, al.titulo AS album, c.album_id AS albumId 
      FROM canciones c
      LEFT JOIN artistas a ON c.artista_id = a.id
      LEFT JOIN albumes al ON c.album_id = al.id
      WHERE (c.artista_id = ? OR c.album_id = ?)
      AND c.id != ?
      AND c.id NOT IN (${placeholders})
      ORDER BY RANDOM()
      LIMIT 10
    `, [current.artista_id, current.album_id, songId, ...playedIds]);

    res.json(candidates);
  } catch (err) {
    console.error("Error en recomendaciones:", err.message);
    res.status(500).json({ error: "Error generando recomendaciones" });
  }
};

export const getSongs = async (req, res) => {
  try {
    const songs = await db.all(`
      SELECT c.id, c.titulo, c.archivo AS url, c.portada, c.duracion, c.bit_rate, c.bit_depth, c.sample_rate,
             a.nombre AS artista, al.titulo AS album
      FROM canciones c
      LEFT JOIN artistas a ON c.artista_id = a.id
      LEFT JOIN albumes al ON c.album_id = al.id
      ORDER BY c.fecha_subida DESC
    `);
    logStatus("Listado de canciones", true, `${songs.length} canciones`);
    res.json(songs);
  } catch (err) {
    logStatus("Listado de canciones", false, err.message);
    res.status(500).json({ error: "Error listando canciones" });
  }
};

export const getAlbums = async (req, res) => {
  try {
    const albums = await db.all(`
      SELECT al.id, al.titulo, al.portada, ar.nombre AS autor
      FROM albumes al
      LEFT JOIN artistas ar ON al.artista_id = ar.id
      ORDER BY al.titulo ASC
    `);
    logStatus("Listado de álbumes", true, `${albums.length} álbumes`);
    res.json(albums);
  } catch (err) {
    logStatus("Listado de álbumes", false, err.message);
    res.status(500).json({ error: "Error al obtener los álbumes" });
  }
};

export const getAlbumDetails = async (req, res) => {
  const { id } = req.params;
  try {
    const album = await db.get(`
      SELECT al.*, ar.nombre AS autor
      FROM albumes al
      LEFT JOIN artistas ar ON al.artista_id = ar.id
      WHERE al.id = ?
    `, [id]);
    if (!album) return res.status(404).json({ error: "Álbum no encontrado" });

    logStatus("Detalle álbum", true, `ID: ${id}`);
    res.json(album);
  } catch (err) {
    logStatus("Detalle álbum", false, err.message);
    res.status(500).json({ error: "Error al obtener el álbum" });
  }
};

export const getAlbumSongs = async (req, res) => {
  const { id } = req.params;
  try {
    const canciones = await db.all(`
      SELECT c.id, c.titulo, c.archivo AS url, c.duracion, c.bit_rate, c.bit_depth, c.sample_rate, c.portada, c.album_id,
             COALESCE(a.nombre, 'Desconocido') AS artista,
             COALESCE(al.titulo, 'Sin título') AS album
      FROM canciones c
      LEFT JOIN artistas a ON c.artista_id = a.id
      LEFT JOIN albumes al ON c.album_id = al.id
      WHERE c.album_id = ?
      ORDER BY c.titulo ASC
    `, [id]);
    logStatus("Canciones de álbum", true, `ID: ${id}, Canciones: ${canciones.length}`);
    res.json(canciones);
  } catch (err) {
    logStatus("Canciones de álbum", false, err.message);
    res.status(500).json({ error: "Error al obtener canciones" });
  }
};

export const getArtists = async (req, res) => {
  try {
    const artists = await db.all(`
      SELECT ar.id, ar.nombre, COALESCE(ar.imagen, '/img/default-artist.png') AS imagen,
             COUNT(DISTINCT al.id) AS albums, COUNT(DISTINCT c.id) AS canciones
      FROM artistas ar
      LEFT JOIN albumes al ON al.artista_id = ar.id
      LEFT JOIN canciones c ON c.artista_id = ar.id
      GROUP BY ar.id
      ORDER BY ar.nombre ASC
    `);
    logStatus("Listado de artistas", true, `${artists.length} artistas`);
    res.json(artists);
  } catch (err) {
    logStatus("Listado de artistas", false, err.message);
    res.status(500).json({ error: "Error al obtener los artistas" });
  }
};

export const getArtistDetails = async (req, res) => {
  const { id } = req.params;
  try {
    const artist = await db.get(`
      SELECT ar.id, ar.nombre, COALESCE(ar.imagen, '/img/default-artist.png') AS imagen,
             COUNT(DISTINCT c.id) AS canciones
      FROM artistas ar
      LEFT JOIN canciones c ON c.artista_id = ar.id
      WHERE ar.id = ?
    `, [id]);
    if (!artist) return res.status(404).json({ error: "Artista no encontrado" });

    const albums = await db.all(`
      SELECT al.id, al.titulo, al.portada, COUNT(c.id) AS canciones
      FROM albumes al
      LEFT JOIN canciones c ON c.album_id = al.id
      WHERE al.artista_id = ?
      GROUP BY al.id
      ORDER BY al.titulo ASC
    `, [id]);

    logStatus("Detalle artista", true, `ID: ${id}, Álbumes: ${albums.length}`);
    res.json({ ...artist, albums });
  } catch (err) {
    logStatus("Detalle artista", false, err.message);
    res.status(500).json({ error: "Error al obtener el artista" });
  }
};

export const getHomeRecommendations = async (req, res) => {
  try {
    const recommendations = await db.all(`
      SELECT c.id, c.titulo, c.archivo AS url, c.portada, c.duracion,
             a.nombre AS artista, al.titulo AS album
      FROM canciones c
      LEFT JOIN artistas a ON c.artista_id = a.id
      LEFT JOIN albumes al ON c.album_id = al.id
      ORDER BY RANDOM()
      LIMIT 10
    `);
    res.json(recommendations);
  } catch (err) {
    console.error("Error getting home recommendations:", err.message);
    res.status(500).json({ error: "Error getting home recommendations" });
  }
};

// ----------------- LYRICS -----------------
export const getLyricsBySong = async (req, res) => {
  const songId = req.params.id;
  try {
    const lyrics = await db.all(
      "SELECT time_ms, line FROM lyrics WHERE song_id = ? ORDER BY time_ms ASC",
      [songId]
    );
    if (!lyrics || lyrics.length === 0) {
      return res.status(404).json({ success: false, error: "No hay letras para esta canción." });
    }
    logStatus("Letras cargadas", true, `Canción ID: ${songId}, Líneas: ${lyrics.length}`);
    res.json({ success: true, lyrics });
  } catch (err) {
    console.error("❌ Error obteniendo letras:", err.message);
    res.status(500).json({ error: "Error al obtener las letras" });
  }
};

// ----------------- LIKES -----------------
export const toggleLike = async (req, res) => {
  const userId = req.userId;
  const songId = req.params.id;

  if (!userId) return res.status(401).json({ error: "No autorizado" });

  try {
    const existing = await db.get(
      `SELECT id FROM likes WHERE user_id = ? AND song_id = ?`,
      [userId, songId]
    );
    if (existing) {
      await db.run(`DELETE FROM likes WHERE id = ?`, [existing.id]);
      return res.json({ liked: false });
    } else {
      await db.run(`INSERT INTO likes (user_id, song_id) VALUES (?, ?)`, [userId, songId]);
      return res.json({ liked: true });
    }
  } catch (err) {
    console.error("Error al alternar like:", err);
    res.status(500).json({ error: "Error al actualizar el like" });
  }
};

export const checkIfLiked = async (req, res) => {
  const userId = req.userId;
  const songId = req.params.id;

  if (!userId) return res.status(401).json({ error: "No autorizado" });

  try {
    const like = await db.get(
      `SELECT id FROM likes WHERE user_id = ? AND song_id = ?`,
      [userId, songId]
    );
    res.json({ liked: !!like });
  } catch (err) {
    console.error("Error al verificar like:", err);
    res.status(500).json({ error: "Error al verificar like" });
  }
};

export const getUserLikes = async (req, res) => {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: "No autorizado" });

  try {
    const likes = await db.all(`
      SELECT 
        c.id, 
        c.titulo, 
        a.nombre AS artista, 
        c.portada, 
        c.archivo AS url,
        c.duracion,
        al.titulo AS album,
        c.album_id AS albumId,
        l.id AS likeId
      FROM likes l
      JOIN canciones c ON c.id = l.song_id
      JOIN artistas a ON c.artista_id = a.id
      LEFT JOIN albumes al ON c.album_id = al.id
      WHERE l.user_id = ?
      ORDER BY l.id DESC
    `, [userId]);

    res.json(likes);
  } catch (err) {
    console.error("Error al obtener likes:", err);
    res.status(500).json({ error: "Error al obtener canciones con like" });
  }
};

// ----------------- IA CLICK CONTROLLER -----------------
export const registerIaClick = async (req, res) => {
  try {
    const { query, identifier, title, creator } = req.body;

    if (!query || !identifier) {
      return res.status(400).json({ error: "Faltan parámetros: query e identifier son obligatorios" });
    }

    await _registerClickInternal(query, identifier, title || "", creator || "");

    return res.json({ success: true, message: "Click registrado correctamente" });
  } catch (err) {
    console.error("Error en registerIaClick:", err);
    return res.status(500).json({ error: "Error al registrar el click" });
  }
};

// ----------------- IA COMPARATOR CONTROLLERS -----------------
export const registerComparatorRelation = async (req, res) => {
  try {
    const { query, title, artist } = req.body;

    if (!query || !title) {
      return res.status(400).json({ error: "Faltan datos obligatorios: query o title" });
    }

    const queryWords = normalizeQuery(query).split(/\s+/).filter(Boolean);
    const titleWords = normalizeQuery(title).split(/\s+/).filter(Boolean);
    const artistWords = artist ? normalizeQuery(artist).split(/\s+/).filter(Boolean) : [];

    await reinforceComparator(queryWords, titleWords, artistWords);

    const all = [...new Set([...queryWords, ...titleWords, ...artistWords])];

    return res.json({
      success: true,
      message: "Relación registrada en comparador",
      relatedTerms: all
    });
  } catch (err) {
    console.error("Error en registerComparatorRelation:", err);
    return res.status(500).json({ error: "Error al registrar relación en comparador" });
  }
};

export const registerIaComparator = async (req, res) => {
  try {
    const { query, related } = req.body;
    if (!query || !Array.isArray(related) || related.length === 0) {
      return res.status(400).json({ error: "Faltan datos obligatorios: query o related" });
    }
    const queryWords = normalizeQuery(query).split(/\s+/).filter(Boolean);
    const relatedWords = related
      .flatMap(t => normalizeQuery(t).split(/\s+/))
      .filter(Boolean)
      .slice(0, 16);

    await reinforceComparator(queryWords, relatedWords, []);
    const all = [...new Set([...queryWords, ...relatedWords])];

    return res.json({
      success: true,
      message: "Relación registrada en comparador",
      relatedTerms: all
    });
  } catch (err) {
    console.error("Error en registerIaComparator:", err);
    return res.status(500).json({ error: "Error al registrar relación en comparador" });
  }
};

// ============================================
// -----------------IA LIKES CONTROLLERS -----------------
export const toggleIaLike = async (req, res) => {
  const userId = req.userId;
  const { identifier, title, artist, source } = req.body;

  if (!userId) return res.status(401).json({ error: "No autorizado" });
  if (!identifier) return res.status(400).json({ error: "Falta identifier" });

  try {
    // Verificar si canción externa existe
    let externalSong = await db.get(
      `SELECT id FROM canciones_externas WHERE external_id = ? AND source = ?`,
      [identifier, source || 'internet_archive']
    );

    // Si no existe, crearla
    if (!externalSong) {
      await db.run(
        `INSERT INTO canciones_externas (external_id, source, title, artist) 
         VALUES (?, ?, ?, ?)`,
        [identifier, source || 'internet_archive', title || '', artist || '']
      );
      externalSong = await db.get(
        `SELECT id FROM canciones_externas WHERE external_id = ?`,
        [identifier]
      );
    }

    // Verificar si ya tiene like
    const existing = await db.get(
      `SELECT id FROM likes_externos WHERE user_id = ? AND cancion_externa_id = ?`,
      [userId, externalSong.id]
    );

    if (existing) {
      await db.run(`DELETE FROM likes_externos WHERE id = ?`, [existing.id]);
      return res.json({ liked: false });
    } else {
      await db.run(
        `INSERT INTO likes_externos (user_id, cancion_externa_id) VALUES (?, ?)`,
        [userId, externalSong.id]
      );
      return res.json({ liked: true });
    }
  } catch (err) {
    console.error("Error al alternar like de IA:", err);
    res.status(500).json({ error: "Error al actualizar el like" });
  }
};

export const checkIfIaLiked = async (req, res) => {
  const userId = req.userId;
  const { identifier, source } = req.query;

  if (!userId) return res.status(401).json({ error: "No autorizado" });
  if (!identifier) return res.status(400).json({ error: "Falta identifier" });

  try {
    const externalSong = await db.get(
      `SELECT id FROM canciones_externas WHERE external_id = ? AND source = ?`,
      [identifier, source || 'internet_archive']
    );

    if (!externalSong) {
      return res.json({ liked: false });
    }

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
    const likes = await db.all(`
      SELECT 
        ce.id,
        ce.external_id as identifier,
        ce.source,
        ce.title,
        ce.artist,
        ce.song_url as url,
        ce.cover_url as portada,
        ce.duration,
        le.id as likeId
      FROM likes_externos le
      JOIN canciones_externas ce ON ce.id = le.cancion_externa_id
      WHERE le.user_id = ?
      ORDER BY le.liked_at DESC
    `, [userId]);

    res.json(likes);
  } catch (err) {
    console.error("Error al obtener likes de IA:", err);
    res.status(500).json({ error: "Error al obtener canciones con like" });
  }
};

// ============================================
// -----------------EXPORT DEFAULT -----------------
export default {
  searchAll,
  search,
  searchArchive,
  getRecommendations,
  getSongs,
  getAlbums,
  getAlbumDetails,
  getAlbumSongs,
  getArtists,
  getArtistDetails,
  getHomeRecommendations,
  getLyricsBySong,
  toggleLike,
  checkIfLiked,
  getUserLikes,
  registerIaClick,
  registerComparatorRelation,
  registerIaComparator,
  toggleIaLike,
  checkIfIaLiked,
  getUserIaLikes
};
