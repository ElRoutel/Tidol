import db from '../models/db.js';

export const getAlbumes = async (req, res) => {
  try {
    const albumes = await db.all('SELECT id, titulo as nombre FROM albumes');
    res.json(albumes);
  } catch (error) {
    console.error('Error fetching albums:', error);
    res.status(500).json({ error: 'Error fetching albums' });
  }
};
