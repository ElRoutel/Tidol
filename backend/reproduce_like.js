import dotenv from "dotenv";
dotenv.config();
import jwt from "jsonwebtoken";
import axios from "axios";

async function run() {
  try {
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET not found in env');
      process.exit(1);
    }

    const token = jwt.sign({ id: 1, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const base = 'http://localhost:3000/api';

    console.log('Fetching song list...');
    const songsRes = await axios.get(`${base}/music/songs`, { headers: { Authorization: `Bearer ${token}` } });
    const songs = songsRes.data;
    if (!Array.isArray(songs) || songs.length === 0) {
      console.error('No songs found to test');
      return;
    }

    const song = songs[0];
    console.log('Using song:', song.id, song.titulo || song.title);

    console.log('Posting like...');
    const likeRes = await axios.post(`${base}/music/songs/${encodeURIComponent(song.id)}/like`, null, { headers: { Authorization: `Bearer ${token}` } });
    console.log('Like response:', likeRes.status, likeRes.data);

    console.log('Fetching user likes...');
    const likesRes = await axios.get(`${base}/music/songs/likes`, { headers: { Authorization: `Bearer ${token}` } });
    console.log('User likes count:', likesRes.data.length);
    const found = likesRes.data.find(l => l.id === song.id);
    console.log('Is liked present in GET /songs/likes?', !!found);

    // Toggle back to clean up
    console.log('Toggling like back to original state...');
    const unlikeRes = await axios.post(`${base}/music/songs/${encodeURIComponent(song.id)}/like`, null, { headers: { Authorization: `Bearer ${token}` } });
    console.log('Unlike response:', unlikeRes.status, unlikeRes.data);

  } catch (err) {
    if (err.response) {
      console.error('Request failed:', err.response.status, err.response.data);
    } else {
      console.error('Error:', err.message);
    }
  }
}

run();
