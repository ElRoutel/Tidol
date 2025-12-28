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
  search, // Removed getArtistSongs as it wasn't in the controller view
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
  checkIaLike, // [UPDATED] from checkIfIaLiked
  getIaUserLikes, // [UPDATED] from getUserIaLikes
  // syncLocalSong, // Removed if not in controller
  getIaDiscoveries, // [NEW] - Uncommented
  // registerExternalSong, // Removed if not in controller
  // streamAudio, // Removed if not in controller
  // getSmartMix // Removed if not in controller
} from "../controllers/music.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
// import { getBestCover } from "../services/coverService.js"; // Removed if not found or causing issues, simpler to clean up

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
// router.get("/artists/:id/songs", authMiddleware, getArtistSongs); 

// --- Búsquedas individuales ---
router.get("/search", authMiddleware, search);
router.get("/searchArchive", searchArchive); // Public or Auth? keeping as existing (was public in controller but often auth in routes, let's keep public)
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
router.get("/ia/likes/check/:identifier", authMiddleware, checkIaLike); // Updated param handling
router.get("/ia/likes", authMiddleware, getIaUserLikes); // Updated name
router.get("/ia/discoveries", authMiddleware, getIaDiscoveries);

// --- IA: Clicks y Comparator ---
router.post("/ia/click", registerIaClick);
router.post("/ia/comparator/relation", registerComparatorRelation);
router.post("/ia/comparator", registerIaComparator);

// --- Sync Local ---
// router.post("/sync-local-song", syncLocalSong);
// router.post("/register-external", registerExternalSong);
// router.get("/stream", streamAudio);
// router.get("/recommend/:id", getSmartMix);

// --- Cover Art Service ---
/*
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
*/

export default router;
