import express from 'express';
import { extractColorsFromUrl, extractColorsBatch } from '../controllers/colors.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

// Single color extraction
router.post('/extract', authMiddleware, extractColorsFromUrl);

// Batch color extraction (for search results)
router.post('/batch', authMiddleware, extractColorsBatch);

export default router;
