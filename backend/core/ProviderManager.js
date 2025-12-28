import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ProviderManager {
    constructor() {
        this.providers = new Map();
    }

    async loadProviders() {
        const providersDir = path.join(__dirname, '../providers');

        if (!fs.existsSync(providersDir)) {
            console.warn(`⚠️ Providers directory not found: ${providersDir}`);
            return;
        }

        const providerFolders = fs.readdirSync(providersDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

        for (const folder of providerFolders) {
            try {
                const providerPath = path.join(providersDir, folder, 'index.js');
                if (fs.existsSync(providerPath)) {
                    // Import dinámico usando pathToFileURL para compatibilidad en Windows
                    const module = await import(pathToFileURL(providerPath).href);
                    const ProviderClass = module.default;

                    if (ProviderClass) {
                        const providerInstance = new ProviderClass();
                        if (providerInstance.id) {
                            this.providers.set(providerInstance.id, providerInstance);
                            console.log(`✅ Provider cargado: ${providerInstance.id}`);
                        } else {
                            console.warn(`⚠️ Provider en '${folder}' no tiene ID.`);
                        }
                    }
                }
            } catch (err) {
                console.error(`❌ Error cargando provider '${folder}':`, err);
            }
        }
    }

    getProvider(id) {
        return this.providers.get(id);
    }

    /**
     * Busca en todos los providers registrados.
     * @param {string} query 
     * @returns {Promise<Array>} Resultados unificados
     */
    async searchAll(query) {
        const promises = Array.from(this.providers.values()).map(async (provider) => {
            try {
                const results = await provider.search(query);
                // Aseguramos que cada resultado tenga el provider ID
                return results.map(r => ({ ...r, provider: provider.id }));
            } catch (err) {
                console.error(`❌ Error en búsqueda de provider '${provider.id}':`, err.message);
                return [];
            }
        });

        const resultsArrays = await Promise.all(promises);
        return resultsArrays.flat();
    }
}

const providerManager = new ProviderManager();
export default providerManager;
