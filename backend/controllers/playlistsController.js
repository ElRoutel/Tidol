import db from '../models/db.js';

export const getPlaylists = async (req, res) => {
  try {
    const playlists = await db.all('SELECT * FROM playlists');
    res.json(playlists);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching playlists' });
  }
};
