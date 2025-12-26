import db from '../models/db.js';
import { extractColors } from '../services/colorExtraction.service.js';
import { downloadImageBuffer } from '../utils/imageDownloader.js';

/**
 * Extract colors from image URL (in-memory, no disk I/O)
 * POST /api/colors/extract
 */
export const extractColorsFromUrl = async (req, res) => {
    try {
        const { imageUrl, songId, source } = req.body;

        if (!imageUrl || !songId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        let imageBuffer;

        // Handle local files vs remote URLs
        if (imageUrl.startsWith('/uploads/') || imageUrl.startsWith('uploads/')) {
            // Local file - read from filesystem
            const fs = await import('fs');
            const path = await import('path');
            const { fileURLToPath } = await import('url');
            const __dirname = path.dirname(fileURLToPath(import.meta.url));

            const fullPath = path.join(__dirname, '..', imageUrl.replace(/^\//, ''));

            if (!fs.existsSync(fullPath)) {
                return res.status(404).json({ error: `Local file not found: ${imageUrl}` });
            }

            imageBuffer = fs.readFileSync(fullPath);
            console.log(`[Colors] Reading local file: ${fullPath}`);
        } else {
            // Remote URL - download as buffer
            imageBuffer = await downloadImageBuffer(imageUrl);
            console.log(`[Colors] Downloaded remote image: ${imageUrl}`);
        }

        // Extract colors from buffer
        const colorsJSON = await extractColors(imageBuffer);

        if (!colorsJSON) {
            return res.status(500).json({ error: 'Color extraction failed' });
        }

        const colors = JSON.parse(colorsJSON);

        // Update database
        const table = source === 'internet_archive' ? 'canciones_externas' : 'canciones';
        await db.run(
            `UPDATE ${table} SET extracted_colors = ? WHERE id = ?`,
            [colorsJSON, songId]
        );

        console.log(`[Colors] ✓ Extracted colors for song ${songId}`);

        res.json({ success: true, colors });
    } catch (error) {
        console.error('[Colors] Extraction error (using fallback):', error.message);
        // Fallback to prevent crash
        res.json({
            success: true,
            colors: {
                dominant: '#1db954',
                secondary: '#000000',
                accent: '#ffffff'
            }
        });
    }
};

/**
 * Batch extract colors for multiple songs
 * POST /api/colors/batch
 * Body: { songs: [{ id, imageUrl, source }] }
 */
export const extractColorsBatch = async (req, res) => {
    try {
        const { songs } = req.body;

        if (!Array.isArray(songs)) {
            return res.status(400).json({ error: 'songs must be an array' });
        }

        const results = [];
        const errors = [];

        // Process sequentially to avoid overwhelming IA servers
        for (const song of songs.slice(0, 5)) { // Max 5 at a time
            try {
                const imageBuffer = await downloadImageBuffer(song.imageUrl);
                const colorsJSON = await extractColors(imageBuffer);

                if (colorsJSON) {
                    const colors = JSON.parse(colorsJSON);
                    const table = song.source === 'internet_archive' ? 'canciones_externas' : 'canciones';

                    await db.run(
                        `UPDATE ${table} SET extracted_colors = ? WHERE id = ?`,
                        [colorsJSON, song.id]
                    );

                    results.push({ id: song.id, colors });
                }
            } catch (error) {
                errors.push({ id: song.id, error: error.message });
            }
        }

        res.json({ success: true, processed: results.length, errors });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
