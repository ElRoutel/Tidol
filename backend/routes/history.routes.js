// backend/routes/history.routes.js
import { Router } from 'express';
import { addToHistory, getHistory } from '../controllers/history.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

// Añadir una canción al historial del usuario autenticado
router.post('/add', authMiddleware, addToHistory);

// Obtener el historial de canciones del usuario autenticado
router.get('/', authMiddleware, getHistory);

export default router;
