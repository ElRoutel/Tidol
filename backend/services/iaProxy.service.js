// backend/services/iaProxy.service.js
import axios from "axios";
import { SocksProxyAgent } from "socks-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import db from "../models/db.js";

// --- CONFIGURACIÓN ---
const DEFAULT_PROXY = 'socks5://127.0.0.1:9050';
const CONCURRENCY_PER_PROXY = 3; // Aumentado ligeramente
const REQUEST_TIMEOUT = 30000;   // 30 segundos
const MAX_RETRIES = 5;           // Intentar hasta 5 veces
const COOLDOWN_ERROR_MS = 30000; // 30s castigo por error genérico
const COOLDOWN_429_MS = 120000;  // 2 min castigo por Rate Limit

/**
 * Gestor de Proxies con Rotación Inteligente y Salud
 */
class ProxyRotator {
    constructor() {
        this.proxies = []; // Lista de { address, agent, activeRequests, failureCount, cooldownUntil }
        this.lastRefresh = 0;
        this.refreshInterval = 60000 * 5; // Refrescar lista de DB cada 5 min
        this.queue = []; // Cola de espera
    }

    /**
     * Carga proxies desde DB y crea Agentes HTTP persistentes
     */
    async loadProxies() {
        try {
            if (Date.now() - this.lastRefresh < this.refreshInterval && this.proxies.length > 0) {
                return;
            }

            const rows = await db.all("SELECT address FROM proxies WHERE active = 1");
            const addresses = rows && rows.length > 0
                ? rows.map(r => r.address)
                : [process.env.TOR_PROXY_ADDRESS || DEFAULT_PROXY];

            // Mantenemos estado de proxies existentes
            const newProxies = addresses.map(addr => {
                const existing = this.proxies.find(p => p.address === addr);
                if (existing) return existing;

                const isSocks = addr.startsWith('socks');
                return {
                    address: addr,
                    agent: isSocks
                        ? new SocksProxyAgent(addr, { keepAlive: true, timeout: REQUEST_TIMEOUT })
                        : new HttpsProxyAgent(addr.includes('://') ? addr : `http://${addr}`),
                    activeRequests: 0,
                    failureCount: 0,
                    cooldownUntil: 0,
                    totalSuccess: 0,
                    totalFail: 0
                };
            });

            this.proxies = newProxies;
            this.lastRefresh = Date.now();
            console.log(`🔄 Proxy Pool actualizado: ${this.proxies.length} proxies activos.`);
            this.processQueue();

        } catch (err) {
            console.warn("⚠️ Error cargando proxies, usando fallback:", err.message);
            if (this.proxies.length === 0) {
                this.proxies = [{
                    address: DEFAULT_PROXY,
                    agent: new SocksProxyAgent(DEFAULT_PROXY),
                    activeRequests: 0,
                    failureCount: 0,
                    cooldownUntil: 0
                }];
            }
        }
    }

    /**
     * Obtiene el MEJOR proxy disponible
     */
    async waitForProxy() {
        await this.loadProxies();

        return new Promise((resolve) => {
            this.queue.push(resolve);
            this.processQueue();
        });
    }

    processQueue() {
        if (this.queue.length === 0) return;

        const now = Date.now();

        // Filtrar proxies en cooldown
        const availableProxies = this.proxies.filter(p =>
            p.cooldownUntil < now &&
            p.activeRequests < CONCURRENCY_PER_PROXY
        );

        if (availableProxies.length === 0) return; // Nadie disponible, esperar

        // Ordenar por "Salud": Menos fallos, menos carga
        availableProxies.sort((a, b) => {
            const scoreA = (a.failureCount * 10) + a.activeRequests;
            const scoreB = (b.failureCount * 10) + b.activeRequests;
            return scoreA - scoreB;
        });

        // Asignar al mejor candidato
        const bestProxy = availableProxies[0];
        const nextResolve = this.queue.shift();

        if (nextResolve) {
            bestProxy.activeRequests++;
            nextResolve(bestProxy);
            this.processQueue(); // Seguir procesando si hay más
        }
    }

    releaseProxy(proxy) {
        if (proxy) {
            proxy.activeRequests = Math.max(0, proxy.activeRequests - 1);
            this.processQueue();
        }
    }

    reportSuccess(proxy) {
        proxy.failureCount = Math.max(0, proxy.failureCount - 1); // Reducir score de fallo
        proxy.totalSuccess++;
    }

    reportFailure(proxy, is429 = false) {
        proxy.failureCount++;
        proxy.totalFail++;

        const now = Date.now();
        const penalty = is429 ? COOLDOWN_429_MS : COOLDOWN_ERROR_MS;

        // Cooldown exponencial si falla mucho
        const multiplier = Math.min(proxy.failureCount, 5);
        proxy.cooldownUntil = now + (penalty * multiplier);

        console.warn(`⚠️ Proxy ${proxy.address} castigado por ${proxy.cooldownUntil - now}ms (Fallos: ${proxy.failureCount})`);
    }
}

const rotator = new ProxyRotator();

/**
 * Fetch con Reintentos y Rotación
 */
export const fetchWithProxy = async (url, options = {}) => {
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        const proxyNode = await rotator.waitForProxy();

        try {
            // console.log(`🌐 Intento ${attempt}/${MAX_RETRIES} usando ${proxyNode.address}`);

            const response = await axios.get(url, {
                httpAgent: proxyNode.agent,
                httpsAgent: proxyNode.agent,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) TidolMusic/2.0',
                    'Connection': 'keep-alive',
                    ...options.headers
                },
                timeout: REQUEST_TIMEOUT,
                validateStatus: status => status < 500 // Aceptar 404 como respuesta válida (no error de red)
            });

            rotator.reportSuccess(proxyNode);
            return response.data;

        } catch (error) {
            const is429 = error.response && error.response.status === 429;
            rotator.reportFailure(proxyNode, is429);
            lastError = error;

            // Si es 404, no tiene sentido reintentar (el archivo no existe)
            if (error.response && error.response.status === 404) {
                throw error;
            }

            const errorMsg = error.response ? `Status ${error.response.status}` : error.code || error.message;
            console.warn(`❌ Fallo intento ${attempt} (${proxyNode.address}): ${errorMsg}`);

            // Esperar un poco antes del siguiente reintento
            if (attempt < MAX_RETRIES) {
                await new Promise(r => setTimeout(r, 1000 * attempt));
            }

        } finally {
            rotator.releaseProxy(proxyNode);
        }
    }

    throw lastError || new Error("Max retries exceeded");
};

/**
 * Stream de Audio con Proxies (Soporta Range Headers)
 */
export const getProxyStream = async (url, headers = {}) => {
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        const proxyNode = await rotator.waitForProxy();

        try {
            // console.log(`🎧 Stream Intento ${attempt} via ${proxyNode.address}`);

            const response = await axios({
                method: 'GET',
                url: url,
                responseType: 'stream',
                httpAgent: proxyNode.agent,
                httpsAgent: proxyNode.agent,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) TidolMusic/2.0',
                    'Connection': 'keep-alive',
                    ...headers // Forward Range headers from client
                },
                timeout: 30000, // Timeout de conexión inicial
                validateStatus: status => status < 500
            });

            // Si es exitoso, retornamos el stream y el proxy node para reportar éxito después
            // Nota: No podemos reportar éxito inmediatamente, idealmente sería al terminar el stream
            // Pero por simplicidad, lo marcamos como éxito si conecta.
            rotator.reportSuccess(proxyNode);
            rotator.releaseProxy(proxyNode);

            return {
                stream: response.data,
                headers: response.headers,
                status: response.status
            };

        } catch (error) {
            const is429 = error.response && error.response.status === 429;
            rotator.reportFailure(proxyNode, is429);
            rotator.releaseProxy(proxyNode);
            lastError = error;

            if (error.response && error.response.status === 404) throw error;

            console.warn(`❌ Fallo Stream ${attempt} (${proxyNode.address}): ${error.message}`);
            if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, 500 * attempt));
        }
    }
    throw lastError || new Error("Stream failed after retries");
};

export const initProxies = async () => {
    console.log("🚀 Inicializando sistema de proxies inteligente...");
    await rotator.loadProxies();
};
