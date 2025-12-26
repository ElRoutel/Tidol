import db from '../models/db.js';
import { extractColors } from '../services/colorExtraction.service.js';
import { downloadImageBuffer } from '../utils/imageDownloader.js';
import pLimit from 'p-limit';

/**
 * Batch process ALL songs without colors
 * OPTIMIZED: In-memory buffer processing + concurrency queue (max 2 simultaneous)
 */

// Concurrency limiter: max 2 concurrent downloads to avoid IA rate limits
const limit = pLimit(2);

async function processSong(song) {
    try {
        let imageBuffer;

        // Handle local vs URL
        if (song.portada.startsWith('http')) {
            imageBuffer = await downloadImageBuffer(song.portada);
        } else {
            // For local files, still read as buffer for consistency
            const fs = await import('fs');
            const path = await import('path');
            const fullPath = song.portada.startsWith('/uploads')
                ? path.join(process.cwd(), song.portada)
                : song.portada;
            imageBuffer = fs.readFileSync(fullPath);
        }

        const colorsJSON = await extractColors(imageBuffer);

        if (!colorsJSON) {
            console.error(`✗ Failed song ${song.id}: No colors extracted`);
            return { id: song.id, success: false };
        }

        const table = song.source === 'internet_archive' ? 'canciones_externas' : 'canciones';
        await db.run(
            `UPDATE ${table} SET extracted_colors = ? WHERE id = ?`,
            [colorsJSON, song.id]
        );

        console.log(`✓ Processed song ${song.id} (${song.titulo || 'unknown'})`);
        return { id: song.id, success: true };
    } catch (error) {
        console.error(`✗ Failed song ${song.id}:`, error.message);
        return { id: song.id, success: false, error: error.message };
    }
}

async function processAllSongs() {
    console.log('🎨 [Batch Color Extraction] Starting...\n');

    // Get all songs without colors (fixed column names for canciones_externas)
    const songs = await db.all(`
    SELECT id, titulo, portada, 'local' as source 
    FROM canciones 
    WHERE extracted_colors IS NULL AND portada IS NOT NULL
    UNION ALL
    SELECT id, title as titulo, cover_url as portada, 'internet_archive' as source
    FROM canciones_externas 
    WHERE extracted_colors IS NULL AND cover_url IS NOT NULL
  `);

    console.log(`📊 Found ${songs.length} songs to process\n`);

    if (songs.length === 0) {
        console.log('✅ All songs already have colors!');
        process.exit(0);
    }

    const startTime = Date.now();

    // Process with concurrency limit (max 2 at a time)
    const tasks = songs.map(song => limit(() => processSong(song)));
    const results = await Promise.all(tasks);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;

    console.log(`\n✨ Processing complete in ${duration}s`);
    console.log(`✓ Successful: ${successful}`);
    console.log(`✗ Failed: ${failed}`);

    process.exit(0);
}

processAllSongs().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
