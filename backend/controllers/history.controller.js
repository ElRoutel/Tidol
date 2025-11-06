// backend/controllers/history.controller.js
import db from '../models/db.js';

/**
 * Añade una canción al historial de un usuario o actualiza su fecha de reproducción.
 */
export const addToHistory = async (req, res) => {
  const { userId } = req; // ID del usuario autenticado (del authMiddleware)
  const { songId } = req.body;

  if (!songId) {
    return res.status(400).json({ error: 'Falta el ID de la canción (songId).' });
  }

  try {
    // Gracias al UNIQUE(user_id, song_id), esta consulta inserta una nueva fila
    // o, si ya existe, simplemente actualiza la columna 'played_at'.
    const query = `
      INSERT INTO homeRecomendations (user_id, song_id, played_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, song_id) DO UPDATE SET
        played_at = CURRENT_TIMESTAMP;
    `;
    
    await db.run(query, [userId, songId]);
    
    res.status(201).json({ message: 'Historial actualizado.' });

  } catch (err) {
    console.error('❌ Error al actualizar el historial:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

/**
 * Obtiene el historial de canciones únicas de un usuario.
 */
export const getHistory = async (req, res) => {
  const { userId } = req; // ID del usuario autenticado

  try {
    // Esta consulta obtiene las 20 canciones únicas más recientes del historial del usuario,
    // con toda la información necesaria para mostrarlas.
    const query = `
      SELECT
          c.id, c.titulo, c.archivo AS url, c.portada, c.duracion,
          a.nombre AS artista,
          al.titulo AS album
      FROM homeRecomendations hr
      JOIN canciones c ON hr.song_id = c.id
      LEFT JOIN artistas a ON c.artista_id = a.id
      LEFT JOIN albumes al ON c.album_id = al.id
      WHERE hr.user_id = ?
      GROUP BY hr.song_id
      ORDER BY MAX(hr.played_at) DESC
      LIMIT 20;
    `;

    const history = await db.all(query, [userId]);
    
    res.json(history);

  } catch (err) {
    console.error('❌ Error al obtener el historial:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};
