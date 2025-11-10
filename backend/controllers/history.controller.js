//backend/controllers/history.controller.js
import db from '../models/db.js';

/**
 * Añade una canción al historial de un usuario (local o de IA).
 */
export const addToHistory = async (req, res) => {
  const { userId } = req;
  const { songId, titulo, artista, url, portada } = req.body; // 'songId' puede ser un ID local o un identifier de IA

  if (!songId) {
    return res.status(400).json({ error: 'Falta el ID de la canción (songId).' });
  }

  try {
    // -----------------------------------------------------------------
    // LÓGICA DE "ENRUTAMIENTO"
    // 1. Verificamos si la canción existe en nuestra tabla 'canciones'
    const checkQuery = 'SELECT id FROM canciones WHERE id = ?';
    const song = await db.get(checkQuery, [songId]);

    let query;
    let params;

    if (song) {
      // -----------------------------------------------------------------
      // CASO 1: Es una canción local. Usamos la tabla 'homeRecomendations'.
      query = `
        INSERT INTO homeRecomendations (user_id, song_id, played_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, song_id) DO UPDATE SET
          played_at = CURRENT_TIMESTAMP;
      `;
      params = [userId, songId];
      
    } else {
      // -----------------------------------------------------------------
      // CASO 2: No es local. Asumimos que es de IA y usamos 'ia_history'.
      // El 'songId' se guarda como 'ia_identifier'.
      query = `
        INSERT INTO ia_history (user_id, ia_identifier, titulo, artista, url, portada, played_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, ia_identifier) DO UPDATE SET
          played_at = CURRENT_TIMESTAMP,
          titulo = EXCLUDED.titulo,
          artista = EXCLUDED.artista,
          url = EXCLUDED.url,
          portada = EXCLUDED.portada;
      `;
      params = [userId, songId, titulo, artista, url, portada];
    }
    
    // 4. Ejecutamos la consulta decidida
    await db.run(query, params);
    
    res.status(201).json({ message: 'Historial actualizado.' });
    // -----------------------------------------------------------------

  } catch (err) {
    // Si la ID de IA tampoco tuviera un formato válido, 
    // el 'UNIQUE constraint' podría fallar, pero es muy raro.
    console.error('❌ Error al actualizar el historial:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};


/**
 * Obtiene el historial combinado (local y de IA) de un usuario.
 */
export const getHistory = async (req, res) => {
  const { userId } = req;

  try {
    // -----------------------------------------------------------------
    // ¡NUEVA CONSULTA CON UNION!
    // Esta consulta combina los resultados de ambas tablas.
    const query = `
      -- 1. Obtenemos las canciones LOCALES
      SELECT
        c.id, c.titulo, c.archivo AS url, c.portada, c.duracion,
        a.nombre AS artista,
        al.titulo AS album,
        hr.played_at,
        'local' as type -- Añadimos un campo 'type' para distinguirlas
      FROM homeRecomendations hr
      JOIN canciones c ON hr.song_id = c.id
      LEFT JOIN artistas a ON c.artista_id = a.id
      LEFT JOIN albumes al ON c.album_id = al.id
      WHERE hr.user_id = ?

      UNION ALL

      -- 2. Obtenemos las canciones de INTERNET ARCHIVE
      SELECT
        ia.ia_identifier AS id,
        ia.titulo,
        ia.url,
        ia.portada,
        NULL AS duracion, -- No tenemos la duración para canciones de IA en esta tabla
        ia.artista,
        'Internet Archive' AS album,   -- Mantenemos un valor genérico para el álbum si no se almacena
        ia.played_at,
        'ia' as type -- Añadimos el tipo 'ia'
      FROM ia_history ia
      WHERE ia.user_id = ?

      -- 3. Ordenamos la lista COMBINADA por fecha y la limitamos
      ORDER BY played_at DESC
      LIMIT 20;
    `;
    // -----------------------------------------------------------------
    
    // Pasamos el userId dos veces, uno para cada parte del UNION
    const history = await db.all(query, [userId, userId]);
    
    res.json(history);

  } catch (err) {
    console.error('❌ Error al obtener el historial:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};