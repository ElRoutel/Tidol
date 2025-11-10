import { Router } from 'express';
import { getPlaylists } from '../controllers/playlistsController.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', authMiddleware, getPlaylists);

export default router;
