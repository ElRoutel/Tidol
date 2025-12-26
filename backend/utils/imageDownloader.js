import axios from 'axios';

/**
 * Download image as Buffer (in-memory, no disk I/O)
 * @param {string} url - Image URL
 * @returns {Promise<Buffer>} Image buffer
 */
export async function downloadImageBuffer(url) {
    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 10000, // 10s timeout
            headers: {
                'User-Agent': 'Tidol-Music-Player/1.0'
            }
        });

        return Buffer.from(response.data);
    } catch (error) {
        throw new Error(`Failed to download image from ${url}: ${error.message}`);
    }
}
