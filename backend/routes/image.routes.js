import { Router } from 'express';
import { optimizeImage } from '../services/imageOptimizer.js';
import path from 'path';
import fs from 'fs';

const router = Router();

// GET /api/images/optimize?path=...&w=...&h=...&q=...
router.get('/optimize', async (req, res) => {
    const { path: imagePath, w, h, q } = req.query;

    if (!imagePath) {
        return res.status(400).json({ error: 'Missing path parameter' });
    }

    try {
        // Si es una URL externa (Internet Archive, etc.), por ahora redirigimos o devolvemos error
        // (El plan actual se enfoca en optimizar imágenes locales primero)
        if (imagePath.startsWith('http')) {
            return res.redirect(imagePath);
        }

        const optimizedPath = await optimizeImage(imagePath, {
            width: w,
            height: h,
            quality: q
        });

        // Servir el archivo
        res.sendFile(optimizedPath, (err) => {
            if (err) {
                console.error('Error sending file:', err);
                if (!res.headersSent) {
                    res.status(500).send('Error serving image');
                }
            }
        });

    } catch (err) {
        console.error('Image optimization error:', err.message);
        // Fallback: intentar servir la imagen original si existe, o 404
        if (err.message === 'Image not found') {
            return res.status(404).send('Image not found');
        }
        res.status(500).send('Internal server error');
    }
});

export default router;
