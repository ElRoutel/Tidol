import { Router } from "express";
import { 
    getRecommendations, 
    getSongs, 
    getAlbums, 
    getAlbumDetails, 
    getAlbumSongs, 
    getArtists, 
    getArtistDetails, 
    search, 
    searchArchive 
} from "../controllers/music.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/recommendations/:songId", authMiddleware, getRecommendations);
router.get("/songs", getSongs);
router.get("/albums", authMiddleware, getAlbums);
router.get("/albums/:id", authMiddleware, getAlbumDetails);
router.get("/albums/:id/canciones", authMiddleware, getAlbumSongs);
router.get("/artists", authMiddleware, getArtists);
router.get("/artists/:id", authMiddleware, getArtistDetails);
router.get("/search", authMiddleware, search);
router.get("/searchArchive", searchArchive);

export default router;
