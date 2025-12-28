import db from '../../models/db.js';
import { fetchWithProxy } from '../../services/iaProxy.service.js';

// Constants taken from music.controller.js
const CACHE_LIMIT = 500;
const CACHE_EXPIRATION_HOURS = 24;
const CACHE_SMART_EXPIRATION_DAYS = 30;
const CONCURRENCY = 6; // slightly increased
const FETCH_RETRIES = 3;
const FETCH_RETRY_BASE_MS = 300;
const MIN_HIT_CONFIDENCE = 0.5;

// Helper functions (Utilities)
async function sleep(ms) {
    return new Promise((res) => setTimeout(res, ms));
}

function normalizeQuery(q) {
    if (!q) return "";
    return q.toString().trim().toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

async function fetchWithRetry(url, retries = FETCH_RETRIES) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const res = await fetchWithProxy(url);
            const ok = res && (
                (res.response && Array.isArray(res.response.docs)) ||
                Array.isArray(res.files) ||
                (res.items && Array.isArray(res.items)) ||
                Array.isArray(res)
            );
            if (ok) return res;
            if (attempt === retries) throw new Error("Invalid response shape");
            throw new Error("Invalid response shape (retrying)");
        } catch (err) {
            if (attempt === retries) {
                console.warn(`❌ [IA Provider] Fetch failed: ${url} | ${err.message}`);
                return null;
            }
            const backoff = FETCH_RETRY_BASE_MS * 2 ** attempt;
            await sleep(backoff);
        }
    }
    return null;
}

async function runWithConcurrency(items, worker, concurrency = 3) {
    const results = [];
    let index = 0;
    const runner = async () => {
        while (index < items.length) {
            const i = index++;
            const item = items[i];
            try {
                const r = await worker(item);
                if (Array.isArray(r)) results.push(...r);
                else if (r !== undefined && r !== null) results.push(r);
            } catch (e) { /* ignore individual errors */ }
        }
    };
    const slots = Math.min(concurrency, items.length || 0);
    await Promise.all(Array.from({ length: slots }, runner));
    return results;
}


class InternetArchiveProvider {
    constructor() {
        this.id = 'archive';
    }

    async ensureTables() {
        // Tables are global in this project structure for now (ia_cache, etc.)
        // Ideally these should be provider specific or core, but we reuse existing ones for now to keep DB intact.
        // Assuming server.js initDB() already created them.
    }

    // ----------------- CACHE LOGIC -----------------
    async pruneCache() {
        try {
            const countRes = await db.get("SELECT COUNT(*) as total FROM ia_cache");
            const total = countRes?.total || 0;
            if (total > CACHE_LIMIT) {
                const toRemove = total - CACHE_LIMIT;
                const rows = await db.all(`SELECT rowid FROM ia_cache ORDER BY timestamp ASC LIMIT ?`, [toRemove]);
                const ids = rows.map(r => r.rowid).filter(Boolean);
                if (ids.length) {
                    await db.run("BEGIN TRANSACTION");
                    await db.run(`DELETE FROM ia_cache WHERE rowid IN (${ids.map(() => '?').join(',')})`, ids);
                    await db.run("COMMIT");
                }
            }
        } catch (err) {
            try { await db.run("ROLLBACK"); } catch { }
            console.error("❌ [IA Provider] Error cleaning cache:", err.message);
        }
    }

    // ----------------- SEARCH IMPLEMENTATION -----------------
    async search(originalQuery) {
        if (!originalQuery) return [];
        const queryKey = normalizeQuery(originalQuery);
        const now = Date.now();
        const expirationLimit = now - (CACHE_EXPIRATION_HOURS * 60 * 60 * 1000);
        const smartExpirationLimit = now - (CACHE_SMART_EXPIRATION_DAYS * 24 * 60 * 60 * 1000);

        let results = [];
        let fromCache = false;

        try {
            // 1. Direct Hints/Hits
            const hit = await db.get(`SELECT top_identifier FROM ia_hits WHERE query = ?`, [queryKey]);
            if (hit && hit.top_identifier) {
                const cachedHit = await db.get(`SELECT results, timestamp FROM ia_cache WHERE query = ?`, [queryKey]);
                if (cachedHit) {
                    await db.run(`UPDATE ia_cache SET last_access = ? WHERE query = ?`, [now, queryKey]);
                    results = JSON.parse(cachedHit.results);
                    this.normalizeResults(results);
                    fromCache = true;
                }
            }

            // 2. Normal Cache
            if (!fromCache) {
                const cached = await db.get(`SELECT results, timestamp FROM ia_cache WHERE query = ?`, [queryKey]);
                if (cached) {
                    const ts = cached.timestamp || 0;
                    if (ts >= expirationLimit) {
                        await db.run(`UPDATE ia_cache SET last_access = ? WHERE query = ?`, [now, queryKey]);
                        results = JSON.parse(cached.results);
                        fromCache = true;
                    } else if (ts >= smartExpirationLimit) {
                        await db.run(`UPDATE ia_cache SET last_access = ? WHERE query = ?`, [now, queryKey]);
                        // Background refresh
                        this.forceFetch(originalQuery).catch(() => { });
                        results = JSON.parse(cached.results);
                        fromCache = true;
                    }
                }
            }

            // 3. Force Fetch
            if (!fromCache) {
                results = await this.forceFetch(originalQuery);
            }

            // 4. Local Enrichment
            // Using logic to check if we have local copies of these IA files
            if (results && results.length > 0) {
                const identifiers = results.map(r => r.identifier).filter(Boolean);
                if (identifiers.length > 0) {
                    const placeholders = identifiers.map(() => '?').join(',');
                    const localMatches = await db.all(
                        `SELECT ia_id, archivo, bit_rate, sample_rate, bit_depth FROM canciones WHERE ia_id IN (${placeholders})`,
                        identifiers
                    );

                    if (localMatches.length > 0) {
                        const localMap = {};
                        localMatches.forEach(m => localMap[m.ia_id] = m);

                        results = results.map(r => {
                            if (localMap[r.identifier]) {
                                const local = localMap[r.identifier];
                                return {
                                    ...r,
                                    url: local.archivo,
                                    isLocal: true,
                                    bit_rate: local.bit_rate,
                                    sample_rate: local.sample_rate,
                                    bit_depth: local.bit_depth,
                                    provider: this.id // Ensure provider is set even for local enriched
                                };
                            }
                            return r;
                        });
                    }
                }
            }

            return results;

        } catch (err) {
            console.error(`❌ [IA Provider] Search error: ${err.message}`);
            return []; // Return empty on error to avoid breaking searchAll
        }
    }

    normalizeResults(results) {
        if (!Array.isArray(results)) return;
        results.forEach(r => {
            if (r.album) r.album = String(r.album).trim();
            if (!r.displayTitle && r.album && (r.artista || r.artist)) {
                const artistName = r.artista || r.artist || 'Archive';
                r.displayTitle = `${artistName} - ${r.album}`;
            }
            // Ensure ID format
            r.provider = this.id;
        });
    }

    async forceFetch(originalQuery) {
        const STOP_WORDS = ["autor", "desconocido", "sin", "titulo", "artist", "unknown", "track", "audio", "official", "video"];
        const queryKey = normalizeQuery(originalQuery);
        const baseTerms = queryKey.split(" ").filter(w => w.length > 2 && !STOP_WORDS.includes(w));

        const searchQueries = [];
        const mediaFilter = `(mediatype:audio OR mediatype:etree)`;

        // Search strategies
        if (queryKey.length > 0) {
            searchQueries.push({ q: `(title:"${queryKey}" OR creator:"${queryKey}") AND ${mediaFilter}`, rows: 60 });
        }
        if (baseTerms.length > 1) {
            const termsAnd = baseTerms.map(t => `"${t}"`).join(" AND ");
            searchQueries.push({ q: `(title:(${termsAnd}) OR creator:(${termsAnd})) AND ${mediaFilter}`, rows: 40 });
        }
        if (baseTerms.length > 0) {
            const fuzzyTerms = baseTerms.map(t => `${t}~1`).join(" AND ");
            searchQueries.push({ q: `(title:(${fuzzyTerms}) OR creator:(${fuzzyTerms})) AND ${mediaFilter}`, rows: 40 });
        }

        const urls = searchQueries.map(sq => {
            const qEncoded = encodeURIComponent(sq.q + ` AND format:(mp3 OR flac OR VBR MP3)`);
            return `https://archive.org/advancedsearch.php?q=${qEncoded}&fl=identifier,title,creator,format,downloads&sort=downloads+desc&rows=${sq.rows}&page=1&output=json`;
        });

        const docs = await runWithConcurrency(
            urls,
            async (url) => {
                const r = await fetchWithRetry(url);
                return r?.response?.docs || [];
            },
            3
        );

        const flatResults = docs || [];
        const uniqueMap = {};

        flatResults.forEach(item => {
            if (!item || !item.identifier) return;
            // Basic filtering
            if (item.identifier.match(/\.(mp3|flac|wav|jpg|png|xml|txt)$/i)) return;
            if (item.identifier.includes(" ")) return;

            const id = item.identifier;
            item.downloads = item.downloads ? parseInt(item.downloads, 10) : 0;
            if (!uniqueMap[id]) uniqueMap[id] = item;
        });

        let uniqueResults = Object.values(uniqueMap);

        // Ranking Logic (Simplified from original controller)
        const queryWords = normalizeQuery(originalQuery).split(" ").filter(w => w.length > 2);
        uniqueResults.sort((a, b) => {
            const aText = normalizeQuery(`${a.title} ${a.creator}`);
            const bText = normalizeQuery(`${b.title} ${b.creator}`);
            let scoreA = 0, scoreB = 0;

            queryWords.forEach(word => {
                if (aText.includes(word)) scoreA += 3;
                if (bText.includes(word)) scoreB += 3;
            });

            if (Math.abs(scoreA - scoreB) >= 2) return scoreB - scoreA;
            return (b.downloads || 0) - (a.downloads || 0);
        });

        const limited = uniqueResults.slice(0, 50);

        // Enrichment
        const enriched = await runWithConcurrency(
            limited.map(r => r.identifier),
            async (identifier) => {
                return await this.getSongDetails(identifier, limited);
            },
            CONCURRENCY
        );

        const finalResults = enriched.filter(Boolean);
        this.normalizeResults(finalResults);

        try {
            await db.run(`REPLACE INTO ia_cache (query, results, timestamp, last_access) VALUES (?, ?, ?, ?)`,
                [queryKey, JSON.stringify(finalResults), Date.now(), Date.now()]);
            await this.pruneCache();
        } catch (e) { console.error("Cache save failed", e); }

        return finalResults;
    }

    async getSongDetails(identifier, limitedContext = null) {
        // Logic to get detailed metadata + stream URL
        if (limitedContext && Array.isArray(limitedContext)) {
            const basic = limitedContext.find(x => x.identifier === identifier);
            // If basic info is enough (it usually isn't fully enough for playback without metadata check)
            // But valid backup strategy.
        }

        try {
            const cleanId = identifier.replace(/\.(mp3|flac|wav|m4a)$/i, '');
            const encodedId = encodeURIComponent(cleanId);
            const meta = await fetchWithRetry(`https://archive.org/metadata/${encodedId}`);

            if (!meta) {
                if (limitedContext) {
                    const fallback = limitedContext.find(x => x.identifier === identifier);
                    if (fallback) return { ...fallback, id: `ia_${identifier}`, provider: this.id };
                }
                throw new Error("Metadata not found");
            }

            const files = meta?.files || [];
            let audioFile = files.find(f => f.name && /(\.flac$)/i.test(f.name));
            if (!audioFile) audioFile = files.find(f => f.format === 'VBR MP3');
            if (!audioFile) audioFile = files.find(f => f.name && /(\.mp3$)/i.test(f.name));
            if (!audioFile) audioFile = files.find(f => f.format && /(flac|wav|m4a|mp3)/i.test(f.format));

            const filename = audioFile ? audioFile.name : null;
            if (!filename) throw new Error("No audio file found");

            const url = `https://archive.org/download/${encodedId}/${encodeURIComponent(filename)}`;

            // Cover Image Logic
            const imageFiles = files.filter(f => f.name && /\.(jpg|jpeg|png|gif)$/i.test(f.name));
            const preferred = imageFiles.find(f => ['cover.jpg', 'folder.jpg', 'album.jpg', 'front.jpg'].includes((f.name || "").toLowerCase()));
            const coverName = preferred ? preferred.name : (imageFiles[0]?.name);
            const cover = coverName
                ? `https://archive.org/download/${encodedId}/${encodeURIComponent(coverName)}`
                : `https://archive.org/services/img/${encodedId}`;

            const metadata = meta.metadata || {};
            const albumTitle = metadata.title || null;
            const trackTitle = audioFile?.title || filename || null;
            let cleanedTrackTitle = trackTitle ? String(trackTitle).replace(/\.(mp3|flac|wav|m4a)$/i, '').replace(/^\d+\s*-?\s*/, '') : null;
            const tituloFinal = albumTitle || cleanedTrackTitle || "Sin título";
            const year = metadata.year || metadata.date || null;
            const creator = metadata.creator || "Autor desconocido";
            const displayTitle = year ? `${creator} - ${albumTitle} (${year})` : `${creator} - ${albumTitle}`;

            return {
                id: `ia_${cleanId}`,
                identifier: cleanId,
                titulo: tituloFinal,
                displayTitle: albumTitle ? displayTitle : undefined,
                artista: creator,
                url, // Remote URL
                portada: cover,
                duration: audioFile.length ? Number(audioFile.length) : null,
                album: albumTitle,
                provider: this.id
            };

        } catch (err) {
            return {
                id: `ia_${identifier}`,
                identifier,
                titulo: identifier,
                artista: 'Error de carga',
                url: `https://archive.org/details/${identifier}`,
                portada: `https://archive.org/services/img/${identifier}`,
                duration: null,
                error: err.message,
                provider: this.id
            };
        }
    }
}

export default InternetArchiveProvider;
