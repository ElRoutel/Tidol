// backend/services/iaProxy.service.js
import axios from "axios";
import { SocksProxyAgent } from "socks-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import db from "../models/db.js";

// --- CONFIGURACIÓN ---
const DEFAULT_PROXY = 'socks5://127.0.0.1:9050';
const CONCURRENCY_PER_PROXY = 2; // Cuántas peticiones simultáneas permite CADA proxy
const REQUEST_TIMEOUT = 45000;   // 45 segundos máximo (aumentado para Tor)

/**
 * Gestor de Proxies con Rotación (Round-Robin) y Reutilización de Agentes
 */
class ProxyRotator {
    constructor() {
        this.proxies = []; // Lista de { address, agent, activeRequests }
        this.currentIndex = 0;
        this.lastRefresh = 0;
        this.refreshInterval = 60000 * 5; // Refrescar lista de DB cada 5 min
        this.queue = []; // Cola de espera para cuando todos los proxies están llenos
    }

    /**
     * Carga proxies desde DB y crea Agentes HTTP persistentes
     */
    async loadProxies() {
        try {
            // Solo refrescar si pasó el tiempo
            if (Date.now() - this.lastRefresh < this.refreshInterval && this.proxies.length > 0) {
                return;
            }

            const rows = await db.all("SELECT address FROM proxies WHERE active = 1");

            // Si no hay en DB, usamos el Default (Tor Local)
            const addresses = rows && rows.length > 0
                ? rows.map(r => r.address)
                : [process.env.TOR_PROXY_ADDRESS || DEFAULT_PROXY];

            // Crear pool de agentes
            // Mantenemos los agentes existentes si la dirección no ha cambiado para no romper conexiones vivas
            const newProxies = addresses.map(addr => {
                const existing = this.proxies.find(p => p.address === addr);
                if (existing) return existing;

                const isHttp = addr.startsWith('http');

                return {
                    address: addr,
                    // CREAR AGENTE UNA SOLA VEZ (Ahorra handshake SSL/SOCKS)
                    agent: isHttp
                        ? new HttpsProxyAgent(addr)
                        : new SocksProxyAgent(addr, { keepAlive: true, timeout: REQUEST_TIMEOUT }),
                    pendingRequests: 0,
                    lastUsed: 0
                };
            });

            this.proxies = newProxies;
            this.lastRefresh = Date.now();
            console.log(`🔄 Proxy Pool actualizado: ${this.proxies.length} proxies activos.`);

            // Intentar procesar la cola si llegaron nuevos proxies
            this.processQueue();

        } catch (err) {
            console.warn("⚠️ Error cargando proxies, usando fallback:", err.message);
            // Fallback de emergencia
            if (this.proxies.length === 0) {
                this.proxies = [{
                    address: DEFAULT_PROXY,
                    agent: new SocksProxyAgent(DEFAULT_PROXY),
                    pendingRequests: 0
                }];
            }
        }
    }

    /**
     * Obtiene un proxy disponible o espera en cola
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

        // Buscar un proxy con cupo
        let attempts = 0;
        let selectedProxy = null;

        // Intentamos encontrar uno libre
        while (attempts < this.proxies.length) {
            const proxy = this.proxies[this.currentIndex];
            this.currentIndex = (this.currentIndex + 1) % this.proxies.length;

            if (proxy.pendingRequests < CONCURRENCY_PER_PROXY) {
                selectedProxy = proxy;
                break;
            }
            attempts++;
        }

        // Si encontramos uno libre, despachamos al primero de la cola
        if (selectedProxy) {
            const nextResolve = this.queue.shift();
            if (nextResolve) {
                selectedProxy.pendingRequests++;
                nextResolve(selectedProxy);
                // Intentar procesar el siguiente por si hay más cupo en otros proxies
                this.processQueue();
            }
        }
        // Si no hay libres, se quedan en la cola hasta que alguien libere (llamando a releaseProxy)
    }

    releaseProxy(proxy) {
        if (proxy) {
            proxy.pendingRequests--;
            // Al liberar un slot, intentamos procesar la cola
            this.processQueue();
        }
    }
}

// Instancia global del rotador
const rotator = new ProxyRotator();

/**
 * Función Principal de Fetch
 */
export const fetchWithProxy = async (url) => {
    // 1. Obtener proxy asignado (esperando si es necesario)
    const proxyNode = await rotator.waitForProxy();

    try {
        // console.log(`🌐 Proxy [${proxyNode.pendingRequests}/${CONCURRENCY_PER_PROXY}]: ${proxyNode.address} -> ${url.substring(0, 40)}...`);

        const response = await axios.get(url, {
            httpAgent: proxyNode.agent,
            httpsAgent: proxyNode.agent,
            headers: {
                // User-Agent rotativo o genérico ayuda a evitar bloqueos
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) TidolMusic/2.0',
                'Connection': 'keep-alive'
            },
            timeout: REQUEST_TIMEOUT
        });

        return response.data;

    } catch (error) {
        // Manejo específico de errores
        if (error.response && error.response.status === 429) {
            console.error(`⛔ Bloqueo 429 en proxy ${proxyNode.address}.`);
            // Aquí podrías marcar el proxy como inactivo en DB temporalmente
        } else {
            console.error(`❌ Error Fetch (${proxyNode.address}): ${error.message}`);
        }
        throw error;

    } finally {
        // Liberar el slot del proxy
        rotator.releaseProxy(proxyNode);
    }
};

/**
 * Inicializa el sistema de proxies (Carga desde DB)
 */
export const initProxies = async () => {
    console.log("🚀 Inicializando sistema de proxies...");
    await rotator.loadProxies();
};
