import { Vibrant } from 'node-vibrant/node';

/**
 * Extract colors from image path or Buffer
 * OPTIMIZED: Accepts Buffer for in-memory processing (0 disk I/O)
 * @param {string|Buffer} input - File path or Buffer
 * @returns {Promise<string>} JSON string of colors
 */
export async function extractColors(input) {
    try {
        if (!input) return null;

        // node-vibrant accepts Buffer directly!
        const palette = await Vibrant.from(input).getPalette();

        const colors = {
            dominant: palette.Vibrant?.hex || '#1db954',
            lightVibrant: palette.LightVibrant?.hex || '#ffffff',
            darkMuted: palette.DarkMuted?.hex || '#121212',
            darkVibrant: palette.DarkVibrant?.hex || '#181818',
            muted: palette.Muted?.hex || '#535353'
        };

        return JSON.stringify(colors);
    } catch (error) {
        console.error(`[ColorExtraction] Failed:`, error.message);
        return null;
    }
}
