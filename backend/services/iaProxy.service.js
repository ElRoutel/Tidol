// backend/services/iaProxy.service.js
import axios from "axios";
import { SocksProxyAgent } from "socks-proxy-agent";

// Define la dirección de tu proxy Tor.
// Por defecto es 'socks5://127.0.0.1:9050'.
const TOR_PROXY_ADDRESS = process.env.TOR_PROXY_ADDRESS || 'socks5://127.0.0.1:9050';

// Crea un agente de proxy para las peticiones.
const httpsAgent = new SocksProxyAgent(TOR_PROXY_ADDRESS);

/**
 * Fetches data from a given URL through a Tor SOCKS5 proxy.
 * @param {string} url - The URL to fetch.
 * @returns {Promise<any>} The data from the response.
 */
export const fetchWithProxy = async (url) => {
    try {
        console.log(`🌐 Realizando petición a través del proxy Tor: ${url}`);
        
        const response = await axios.get(url, {
            // Usa el agente de proxy para peticiones HTTPS
            httpsAgent,
            // También puedes añadirlo para HTTP si es necesario
            httpAgent: httpsAgent,
            headers: {
                'User-Agent': 'Tidol/1.0 (Personal Music Client; Maintainer: ElRoutel <ElRoutel@hotmail.com>)'
            }
        });

        return response.data;
    } catch (error) {
        console.error(`❌ Error al realizar la petición con proxy a ${url}:`, error.message);
        
        // Si el error está en la respuesta del proxy, muéstralo.
        if (error.response) {
            console.error('Proxy Error Response:', {
                status: error.response.status,
                data: error.response.data,
            });
        }
        
        throw new Error(`Failed to fetch data from ${url} via proxy.`);
    }
};
