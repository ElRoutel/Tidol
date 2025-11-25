// backend/services/iaProxy.service.js
import axios from "axios";
import { SocksProxyAgent } from "socks-proxy-agent";
import db from "../models/db.js";

// Fallback default
const DEFAULT_PROXY = 'socks5://127.0.0.1:9050';

/**
 * Retrieves the active proxy from the database or falls back to env/default.
 */
async function getActiveProxy() {
    try {
        const row = await db.get("SELECT address FROM proxies WHERE active = 1 LIMIT 1");
        if (row && row.address) {
            return row.address;
        }
    } catch (err) {
        console.warn("⚠️ Error reading proxies table (using fallback):", err.message);
    }
    return process.env.TOR_PROXY_ADDRESS || DEFAULT_PROXY;
}

/**
 * Fetches data from a given URL through a Tor SOCKS5 proxy.
 * @param {string} url - The URL to fetch.
 * @returns {Promise<any>} The data from the response.
 */
export const fetchWithProxy = async (url) => {
    const proxyAddress = await getActiveProxy();
    const httpsAgent = new SocksProxyAgent(proxyAddress);

    try {
        // console.log(`🌐 Proxy: ${proxyAddress} -> ${url}`);

        const response = await axios.get(url, {
            httpsAgent,
            httpAgent: httpsAgent,
            headers: {
                'User-Agent': 'Tidol/1.0 (Personal Music Client; Maintainer: ElRoutel <ElRoutel@hotmail.com>)'
            },
            timeout: 30000 // 30s timeout for Tor latency
        });

        return response.data;
    } catch (error) {
        console.error(`❌ Error proxy (${proxyAddress}) -> ${url}:`, error.message);

        if (error.response) {
            console.error('Proxy Error Response:', {
                status: error.response.status,
                data: error.response.data,
            });
        }

        throw new Error(`Failed to fetch data from ${url} via proxy.`);
    }
};
