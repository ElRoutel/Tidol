// backend/routes/music.routes.js
// Este archivo define las rutas para la API de música
// y las rutas para la API de IA Comparator

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
  getArtistSongs,
  search,
  searchArchive,
  getHomeRecommendations,
  getLyricsBySong,
  toggleLike,
  getUserLikes,
  checkIfLiked,
  // IA / Comparator
  registerIaClick,
  registerComparatorRelation,
  registerIaComparator,
  // IA Likes
  toggleIaLike,
  checkIfIaLiked,
  getUserIaLikes,
  syncLocalSong,
  getIaDiscoveries
} from "../controllers/music.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { getBestCover } from "../services/coverService.js";

const router = Router();

// --- Búsqueda unificada (Local + Internet Archive) ---
router.get("/searchAll", searchAll);

// --- Recomendaciones ---
// Nota: si antes usabas "/recommendations/:songId(*)", puedes mantenerlo como alias si es necesario.
router.post("/recommendations/:songId", authMiddleware, getRecommendations);

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
router.get("/artists/:id/songs", authMiddleware, getArtistSongs);

// --- Búsquedas individuales ---
router.get("/search", authMiddleware, search);
router.get("/searchArchive", searchArchive);
router.get("/proxy/searchArchive", searchArchive);

// --- Home ---
router.get("/home-recommendations", authMiddleware, getHomeRecommendations);

// --- Likes ---
router.post("/songs/:id/like", authMiddleware, toggleLike);
// Mantén el POST para compatibilidad y añade GET como opción semánticamente correcta para lectura
router.post("/songs/:id/isLiked", authMiddleware, checkIfLiked);
router.get("/songs/:id/isLiked", authMiddleware, checkIfLiked);
router.get("/songs/likes", authMiddleware, getUserLikes);

// --- IA Likes ---
router.post("/ia/likes/toggle", authMiddleware, toggleIaLike);
router.get("/ia/likes/check", authMiddleware, checkIfIaLiked);
router.get("/ia/likes", authMiddleware, getUserIaLikes);
router.get("/ia/discoveries", authMiddleware, getIaDiscoveries);

// --- IA: Clicks y Comparator ---
router.post("/ia/click", registerIaClick);
router.post("/ia/comparator/relation", registerComparatorRelation);
router.post("/ia/comparator", registerIaComparator);

// --- Sync Local ---
router.post("/sync-local-song", syncLocalSong);

// --- Cover Art Service ---
router.get("/getCover/:identifier", async (req, res) => {
  const identifier = req.params.identifier;

  try {
    const coverUrl = await getBestCover(identifier);

    if (!coverUrl) {
      return res.status(404).json({ error: "No se encontró portada" });
    }

    return res.json({ portada: coverUrl });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error buscando portada" });
  }
});

export default router;
