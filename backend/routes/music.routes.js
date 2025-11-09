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
    getHomeRecommendations
} from "../controllers/music.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = Router();

// Búsqueda unificada (Local + Internet Archive)
router.get("/searchAll", searchAll);

// Recomendaciones
router.post("/recommendations/:songId(*)", authMiddleware, getRecommendations);

// Música local
router.get("/songs", getSongs);

// Álbumes
router.get("/albums", authMiddleware, getAlbums);
router.get("/albums/:id", authMiddleware, getAlbumDetails);
router.get("/albums/:id/songs", authMiddleware, getAlbumSongs);

// Artistas
router.get("/artists", authMiddleware, getArtists);
router.get("/artists/:id", authMiddleware, getArtistDetails);

// Búsquedas individuales
router.get("/search", authMiddleware, search);
router.get("/searchArchive", searchArchive);
router.get("/proxy/searchArchive", searchArchive);

// Home
router.get("/home-recommendations", authMiddleware, getHomeRecommendations);

export default router;
