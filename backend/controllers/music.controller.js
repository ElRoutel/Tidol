// backend/controllers/music.controller.js
import db from "../models/db.js";
import axios from "axios";
import { fetchWithProxy } from "../services/iaProxy.service.js";
import * as cheerio from "cheerio"; // Nota: se deja importado por si alguna otra parte lo necesita

// --- CONFIGURACIÓN DEL CACHÉ ---
const CACHE_LIMIT = 500; // Límite de 500 búsquedas
const CACHE_EXPIRATION_HOURS = 24; // Las búsquedas expiran en 24h
// ---------------------------------

function logStatus(name, success, info = "") {
    const icon = success ? "✅" : "❌";
    console.log(`${icon} ${name} ${info}`);
}

// =================================================================================
// NUEVA FUNCIÓN DE BÚSQUEDA UNIFICADA
// =================================================================================
export const searchAll = async (req, res) => {
    const { q } = req.query;
    if (!q || q.trim() === "") {
        return res.status(400).json({ error: "Consulta vacía" });
    }

    logStatus("Búsqueda Unificada", true, `Iniciando para: "${q}"`);

    try {
        // Ejecutamos ambas búsquedas en paralelo para máxima eficiencia
        const [localResults, archiveResults] = await Promise.all([
            _searchLocal(q),
            _searchArchive(q)
        ]);

        // Combinamos los resultados en un solo objeto
        res.json({
            ...localResults, // Contiene canciones, albums, artists
            archive: archiveResults
        });

    } catch (err) {
        logStatus("Búsqueda Unificada", false, err.message);
        res.status(500).json({ error: "Ocurrió un error durante la búsqueda." });
    }
};


// =================================================================================
// LÓGICA DE BÚSQUEDA INTERNA (Refactorizada para ser reutilizable)
// =================================================================================

// Búsqueda en la base de datos local
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
        throw new Error("Error en la búsqueda local."); // Propagamos el error
    }
}

// Búsqueda en Internet Archive (con caché) - AHORA devuelve url reproducible
async function _searchArchive(query) {
    const queryKey = query.trim().toLowerCase();
    const now = Date.now();
    const expirationTime = now - (CACHE_EXPIRATION_HOURS * 60 * 60 * 1000);

    try {
        const cached = await db.get(
            "SELECT results FROM ia_cache WHERE query = ? AND timestamp > ?",
            [queryKey, expirationTime]
        );

        if (cached) {
            logStatus("Caché IA (Sub-búsqueda)", true, `HIT: "${queryKey}"`);
            return JSON.parse(cached.results);
        }

        logStatus("Caché IA (Sub-búsqueda)", false, `MISS: "${queryKey}"`);
        
        const palabras = query.trim().split(/\s+/);
        const combinaciones = [];
        for (let i = 0; i < palabras.length; i++) {
            for (let j = i; j < palabras.length; j++) {
                combinaciones.push(palabras.slice(i, j + 1).join(' '));
            }
        }
        const formatos = ['mp3', 'flac', 'wav', 'm4a'];
        const allPromises = [];

        for (const combo of combinaciones) {
            const keywords = `"${combo}"`;
            for (const f of formatos) {
                const url = `https://archive.org/advancedsearch.php?q=(title:${keywords} OR creator:${keywords}) AND mediatype:audio AND format:${f}&fl[]=identifier,title,creator,format&sort[]=downloads+desc&rows=30&page=1&output=json`;
                allPromises.push(
                    fetchWithProxy(url)
                        .then(data => data.response?.docs || [])
                        .catch(err => { return []; })
                );
            }
        }

        const resultadosPorFormato = await Promise.all(allPromises);
        const flatResults = [].concat(...resultadosPorFormato);
        const contador = {};
        flatResults.forEach(item => contador[item.identifier] = (contador[item.identifier] || 0) + 1);
        const resultadosUnicos = Object.values(
            flatResults.reduce((acc, item) => {
                if (!acc[item.identifier]) acc[item.identifier] = item;
                return acc;
            }, {})
        );
        resultadosUnicos.sort((a, b) => (contador[b.identifier] || 0) - (contador[a.identifier] || 0));
        const resultadosLimitados = resultadosUnicos.slice(0, 50);

        // Para cada resultado obtenemos metadata para localizar un archivo de audio reproducible
        const enriched = await Promise.all(resultadosLimitados.map(async item => {
            try {
                const metaRes = await fetchWithProxy(`https://archive.org/metadata/${item.identifier}`);
                const files = metaRes?.files || [];

                // Buscar el mejor candidato de archivo de audio
                let audioFile = files.find(f => f.name && /(\.mp3$|\.flac$|\.wav$|\.m4a$)/i.test(f.name));
                if (!audioFile) {
                    // fallback por formato textual
                    audioFile = files.find(f => f.format && /(mp3|flac|wav|m4a)/i.test(f.format));
                }
                // Aún si no hay audio, intentamos formar una URL de detalle para que el frontend pueda mostrar la ficha
                const filename = audioFile ? audioFile.name : (item.identifier + '.mp3');
                const url = audioFile ? `https://archive.org/download/${item.identifier}/${encodeURIComponent(filename)}` : `https://archive.org/details/${item.identifier}`;

                const duration = audioFile && audioFile.length ? parseFloat(audioFile.length) : null;

                // Lógica para encontrar la mejor portada
                let coverUrl = `https://archive.org/services/img/${item.identifier}`; // Fallback por defecto

                const imageFiles = files.filter(f => f.name && /\.(jpg|jpeg|png|gif)$/i.test(f.name));
                
                // Priorizar archivos con nombres comunes de portada
                const preferredCoverNames = ['cover.jpg', 'folder.jpg', 'album.jpg', 'front.jpg'];
                let bestCoverFile = imageFiles.find(f => preferredCoverNames.includes(f.name.toLowerCase()));

                // Si no se encuentra un nombre preferido, tomar la primera imagen disponible
                if (!bestCoverFile && imageFiles.length > 0) {
                    bestCoverFile = imageFiles[0];
                }

                if (bestCoverFile) {
                    coverUrl = `https://archive.org/download/${item.identifier}/${encodeURIComponent(bestCoverFile.name)}`;
                }

                return {
                    id: `ia_${item.identifier}`, // Mapeo a id con prefijo
                    identifier: item.identifier,
                    titulo: item.title || 'Sin título', // Mapeo a titulo
                    artista: item.creator || 'Autor desconocido', // Mapeo a artista
                    url,
                    portada: coverUrl, // Usar la URL de portada de mayor calidad
                    duration
                };
            } catch (err) {
                // En caso de fallo con metadata, devolvemos info mínima para que el frontend pueda mostrar algo
                return {
                    identifier: item.identifier,
                    title: item.title || 'Sin título',
                    artist: item.creator || 'Autor desconocido',
                    format: item.format ? (Array.isArray(item.format) ? item.format.join(', ') : item.format) : 'audio',
                    thumbnail: `https://archive.org/services/img/${item.identifier}`,
                    url: `https://archive.org/details/${item.identifier}`,
                    filename: null,
                    duration: null
                };
            }
        }));

        // Guardamos en caché la versión enriquecida (contiene url reproducible cuando fue posible)
        await db.run(
            "REPLACE INTO ia_cache (query, results, timestamp) VALUES (?, ?, ?)",
            [queryKey, JSON.stringify(enriched), now]
        );
        
        await pruneCache();

        logStatus("Sub-búsqueda IA", true, `Éxito para "${query}", ${enriched.length} resultados.`);
        return enriched;

    } catch (err) {
        logStatus("Sub-búsqueda IA", false, `Error para "${query}": ${err.message}`);
        throw new Error("Error al buscar en Internet Archive."); // Propagamos el error
    }
}


// =================================================================================
// ANTIGUOS CONTROLADORES (Ahora delegan a la nueva lógica)
// =================================================================================

export const search = async (req, res) => {
    const { q } = req.query;
    if (!q || q.trim() === "") return res.status(400).json({ error: "Consulta vacía" });

    try {
        const results = await _searchLocal(q);
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: "Error en la búsqueda" });
    }
};

export const searchArchive = async (req, res) => {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: "Falta el parámetro q" });

    try {
        const results = await _searchArchive(q);
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: "Error al buscar en Internet Archive" });
    }
};


// =================================================================================
// OTRAS FUNCIONES DEL CONTROLADOR (Sin cambios)
// =================================================================================

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

        logStatus("====Detalle álbum", true, `ID: ${id}`);
        res.json(album);
    } catch (err) {
        logStatus("====Detalle álbum", false, err.message);
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
        logStatus("Canciones de álbum 🤑 ", true, `ID: ${id}, Canciones: ${canciones.length}`);
        res.json(canciones);
    } catch (err) {
        logStatus("Canciones de álbum 🤑 ", false, err.message);
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

        logStatus("   Detalle artista   ", true, `ID: ${id}, Álbumes: ${albums.length}`);
        res.json({ ...artist, albums });
    } catch (err) {
        logStatus("   Detalle artista   ", false, err.message);
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

// --- NUEVA FUNCIÓN PARA GESTIONAR EL LÍMITE DEL CACHÉ ---
async function pruneCache() {
    try {
        const countRes = await db.get("SELECT COUNT(*) as total FROM ia_cache");
        const total = countRes.total;

        if (total > CACHE_LIMIT) {
            const toRemove = total - CACHE_LIMIT;
            // Borra las N entradas más antiguas (timestamp más bajo)
            await db.run(`
                DELETE FROM ia_cache
                WHERE query IN (
                    SELECT query FROM ia_cache
                    ORDER BY timestamp ASC
                    LIMIT ?
                )
            `, [toRemove]);
            logStatus("Limpieza de Caché", true, `Eliminados ${toRemove} registros antiguos.`);
        }
    } catch (err) {
        console.error("❌ Error limpiando el caché:", err.message);
    }
}
// ===================== NUEVO CONTROLADOR: LETRAS =====================
export const getLyricsBySong = async (req, res) => {
    const songId = req.params.id; // id de la canción

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
        logStatus("Letras cargadas", false, `Error: ${err.message}`);
        res.status(500).json({ success: false, error: "Error al obtener las letras." });
    }
};


// --- Dar o quitar like ---
export const toggleLike = async (req, res) => {
    const userId = req.userId;
    const songId = req.params.id;

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

// --- Verificar si ya tiene like ---
export const checkIfLiked = async (req, res) => {
  const userId = req.userId;
  const songId = req.params.id;

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

// --- Obtener todas las canciones con like ---
export const getUserLikes = async (req, res) => {
  const userId = req.userId;

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
        c.album_id AS albumId
      FROM likes l
      JOIN canciones c ON c.id = l.song_id
      JOIN artistas a ON c.artista_id = a.id
      LEFT JOIN albumes al ON c.album_id = al.id
      WHERE l.user_id = ?
      ORDER BY l.liked_at DESC
    `, [userId]);

    res.json(likes);
  } catch (err) {
    console.error("Error al obtener likes:", err);
    res.status(500).json({ error: "Error al obtener canciones con like" });
  }
};