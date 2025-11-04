import db from "../models/db.js";

/**
 * Fetches cached results for a given query if they are not expired.
 * @param {string} queryKey - The normalized search query.
 * @param {number} expirationTime - The timestamp to filter expired entries.
 * @returns {Promise<object|null>} The parsed results or null if not found.
 */
export const getCachedQuery = async (queryKey, expirationTime) => {
    const cached = await db.get(
        "SELECT results FROM ia_cache WHERE query = ? AND timestamp > ?", 
        [queryKey, expirationTime]
    );
    return cached ? JSON.parse(cached.results) : null;
};

/**
 * Saves search results to the cache.
 * @param {string} queryKey - The normalized search query.
 * @param {object} results - The search results to cache.
 * @param {number} timestamp - The current timestamp.
 */
export const saveQueryToCache = async (queryKey, results, timestamp) => {
    await db.run(
        "REPLACE INTO ia_cache (query, results, timestamp) VALUES (?, ?, ?)",
        [queryKey, JSON.stringify(results), timestamp]
    );
};

/**
 * Prunes the cache to a specific limit by removing the oldest entries.
 * @param {number} limit - The maximum number of entries to keep in the cache.
 */
export const pruneCache = async (limit) => {
    const countRes = await db.get("SELECT COUNT(*) as total FROM ia_cache");
    const total = countRes.total;

    if (total > limit) {
        const toRemove = total - limit;
        await db.run(`
            DELETE FROM ia_cache
            WHERE query IN (
                SELECT query FROM ia_cache
                ORDER BY timestamp ASC
                LIMIT ?
            )
        `, [toRemove]);
        return toRemove; // Return the number of removed items for logging
    }
    return 0;
};
