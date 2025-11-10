import { Router } from "express";
import { 
  searchAll,
  getRecommendations, 
  getSongs, 
  getAlbums, 
  getAlbumDetails, 
  getAlbumSongs, 
  getArtists, 
  getArtistDetails, 
  search, 
  searchArchive, 
  getHomeRecommendations,
  getLyricsBySong,
  toggleLike,          // <-- Nuevo
  getUserLikes,        // <-- Nuevo
  checkIfLiked         // <-- Nuevo
} from "../controllers/music.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { getBestCover } from '../services/coverService.js';
const router = Router();

// --- Búsqueda unificada (Local + Internet Archive) ---
router.get("/searchAll", searchAll);

// --- Recomendaciones ---
router.post("/recommendations/:songId(*)", authMiddleware, getRecommendations);

// --- Música local ---
router.get("/songs", getSongs);

// --- Letras ---
router.get("/songs/:id/lyrics", getLyricsBySong);

// --- Álbumes ---
router.get("/albums", authMiddleware, getAlbums);
router.get("/albums/:id", authMiddleware, getAlbumDetails);
router.get("/albums/:id/songs", authMiddleware, getAlbumSongs);

// --- Artistas ---
router.get("/artists", authMiddleware, getArtists);
router.get("/artists/:id", authMiddleware, getArtistDetails);

// --- Búsquedas individuales ---
router.get("/search", authMiddleware, search);
router.get("/searchArchive", searchArchive);
router.get("/proxy/searchArchive", searchArchive);

// --- Home ---
router.get("/home-recommendations", authMiddleware, getHomeRecommendations);

// --- Likes --- ✅
router.post("/songs/:id/like", authMiddleware, toggleLike);         // Like / Unlike una canción
router.post("/songs/:id/isLiked", authMiddleware, checkIfLiked);     // Ver si el usuario ya dio like
router.get("/songs/likes", authMiddleware, getUserLikes);                 // Obtener todas las canciones que el usuario ha dado like
// --- Cover Art Service ---
router.get('/getCover/:identifier', async (req, res) => {
  const identifier = req.params.identifier;

  try {
    const coverUrl = await getBestCover(identifier);

    if (!coverUrl) {
      return res.status(404).json({ error: 'No se encontró portada' });
    }

    return res.json({ portada: coverUrl });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error buscando portada' });
  }
});
export default router;
