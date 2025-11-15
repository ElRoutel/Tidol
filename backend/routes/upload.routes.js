import { Router } from "express";
import { upload, uploadMusic, uploadArtistImage } from "../controllers/upload.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/musica", 
    authMiddleware, 
    upload.fields([
        // Aquí se define el límite de canciones que se pueden subir por álbum.
        { name: "song", maxCount: 35 },
        { name: "coverFile", maxCount: 1 }
    ]), 
    uploadMusic
);

router.post("/artists/:id/imagen", authMiddleware, ...uploadArtistImage);

export default router;
