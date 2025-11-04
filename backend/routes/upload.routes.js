import { Router } from "express";
import { upload, uploadMusic, uploadArtistImage } from "../controllers/upload.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/musica", 
    authMiddleware, 
    upload.fields([
        { name: "song", maxCount: 30 },
        { name: "coverFile", maxCount: 1 }
    ]), 
    uploadMusic
);

router.post("/artists/:id/imagen", authMiddleware, ...uploadArtistImage);

export default router;
