// searchCache.js - Sistema de caché para búsquedas de Tidol
// Módulo independiente para gestión de caché con localStorage

// Trazas solo en desarrollo: en producción ensuciaban la consola del usuario en
// cada búsqueda. Los console.error/warn se mantienen: señalan fallos reales.
const trace = import.meta.env.DEV ? console.log.bind(console) : () => {};

const CACHE_CONFIG = {
  PREFIX: 'tidol_search_',
  EXPIRATION_HOURS: 24,
  MAX_ENTRIES: 500, // Límite de búsquedas cacheadas
  VERSION: '1.0' // Para invalidar caché en actualizaciones
};

/**
 * Genera una clave única para la búsqueda
 * @param {string} query - Término de búsqueda
 * @returns {string} Clave hash
 */
function generateCacheKey(query) {
  const normalized = query.trim().toLowerCase();
  return `${CACHE_CONFIG.PREFIX}${btoa(normalized)}_v${CACHE_CONFIG.VERSION}`;
}

/**
 * Verifica si una entrada de caché ha expirado
 * @param {number} timestamp - Timestamp de creación
 * @returns {boolean}
 */
function isExpired(timestamp) {
  const now = Date.now();
  const expirationMs = CACHE_CONFIG.EXPIRATION_HOURS * 60 * 60 * 1000;
  return (now - timestamp) > expirationMs;
}

/**
 * Obtiene resultados del caché
 * @param {string} query - Término de búsqueda
 * @returns {Array|null} Resultados cacheados o null
 */
export function getCachedResults(query) {
  try {
    const key = generateCacheKey(query);
    const cached = localStorage.getItem(key);
    
    if (!cached) {
      trace(`📦 Caché MISS: "${query}" - No encontrado`);
      return null;
    }
    
    const data = JSON.parse(cached);
    
    // Verificar expiración
    if (isExpired(data.timestamp)) {
      trace(`⏰ Caché EXPIRADO: "${query}" - Eliminando...`);
      localStorage.removeItem(key);
      return null;
    }
    
    trace(`✅ Caché HIT: "${query}" - ${data.results.length} resultados (${formatAge(data.timestamp)})`);
    return data.results;
    
  } catch (error) {
    console.error('❌ Error leyendo caché:', error);
    return null;
  }
}

/**
 * Guarda resultados en el caché
 * @param {string} query - Término de búsqueda
 * @param {Array} results - Resultados a cachear
 * @returns {boolean} Éxito de la operación
 */
export function setCachedResults(query, results) {
  try {
    const key = generateCacheKey(query);
    const data = {
      query: query,
      results: results,
      timestamp: Date.now(),
      count: results.length
    };
    
    // Gestionar límite de entradas
    manageCacheSize();
    
    localStorage.setItem(key, JSON.stringify(data));
    trace(`💾 Caché GUARDADO: "${query}" - ${results.length} resultados`);
    
    return true;
    
  } catch (error) {
    // Si localStorage está lleno, limpiar caché antiguo
    if (error.name === 'QuotaExceededError') {
      console.warn('⚠️ Caché lleno, limpiando entradas antiguas...');
      clearOldestCache();
      
      try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
      } catch (retryError) {
        console.error('❌ Error guardando caché después de limpieza:', retryError);
        return false;
      }
    }
    
    console.error('❌ Error guardando caché:', error);
    return false;
  }
}

/**
 * Limpia las entradas más antiguas del caché
 */
function clearOldestCache() {
  try {
    const entries = [];
    
    // Recolectar todas las entradas de caché
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_CONFIG.PREFIX)) {
        const data = JSON.parse(localStorage.getItem(key));
        entries.push({ key, timestamp: data.timestamp });
      }
    }
    
    // Ordenar por antigüedad y eliminar las más viejas
    entries.sort((a, b) => a.timestamp - b.timestamp);
    const toRemove = Math.ceil(entries.length * 0.3); // Eliminar 30%
    
    for (let i = 0; i < toRemove; i++) {
      localStorage.removeItem(entries[i].key);
    }
    
    trace(`🗑️ Limpiados ${toRemove} elementos del caché`);
    
  } catch (error) {
    console.error('❌ Error limpiando caché:', error);
  }
}

/**
 * Gestiona el tamaño del caché
 */
function manageCacheSize() {
  try {
    const entries = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_CONFIG.PREFIX)) {
        entries.push(key);
      }
    }
    
    // Si excedemos el límite, eliminar los más antiguos
    if (entries.length >= CACHE_CONFIG.MAX_ENTRIES) {
      clearOldestCache();
    }
    
  } catch (error) {
    console.error('❌ Error gestionando tamaño de caché:', error);
  }
}

/**
 * Limpia todo el caché de búsquedas
 * @returns {number} Número de entradas eliminadas
 */
export function clearAllCache() {
  try {
    let count = 0;
    const keysToRemove = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_CONFIG.PREFIX)) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      count++;
    });
    
    trace(`🗑️ Caché limpiado: ${count} entradas eliminadas`);
    return count;
    
  } catch (error) {
    console.error('❌ Error limpiando caché:', error);
    return 0;
  }
}

/**
 * Obtiene estadísticas del caché
 * @returns {Object} Estadísticas
 */
export function getCacheStats() {
  try {
    const stats = {
      totalEntries: 0,
      totalSize: 0,
      oldestEntry: null,
      newestEntry: null,
      entries: []
    };
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_CONFIG.PREFIX)) {
        const data = JSON.parse(localStorage.getItem(key));
        const size = new Blob([localStorage.getItem(key)]).size;
        
        stats.totalEntries++;
        stats.totalSize += size;
        stats.entries.push({
          query: data.query,
          count: data.count,
          age: formatAge(data.timestamp),
          timestamp: data.timestamp
        });
        
        if (!stats.oldestEntry || data.timestamp < stats.oldestEntry) {
          stats.oldestEntry = data.timestamp;
        }
        if (!stats.newestEntry || data.timestamp > stats.newestEntry) {
          stats.newestEntry = data.timestamp;
        }
      }
    }
    
    stats.totalSizeKB = (stats.totalSize / 1024).toFixed(2);
    stats.averageSizeKB = stats.totalEntries > 0 
      ? (stats.totalSize / 1024 / stats.totalEntries).toFixed(2) 
      : 0;
    
    return stats;
    
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    return null;
  }
}

/**
 * Formatea la antigüedad de una entrada
 * @param {number} timestamp
 * @returns {string}
 */
function formatAge(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `hace ${days} día${days > 1 ? 's' : ''}`;
  if (hours > 0) return `hace ${hours} hora${hours > 1 ? 's' : ''}`;
  if (minutes > 0) return `hace ${minutes} minuto${minutes > 1 ? 's' : ''}`;
  return 'recién creado';
}

/**
 * Invalida caché por término específico
 * @param {string} query - Término a invalidar
 * @returns {boolean}
 */
export function invalidateCache(query) {
  try {
    const key = generateCacheKey(query);
    const existed = localStorage.getItem(key) !== null;
    localStorage.removeItem(key);
    
    if (existed) {
      trace(`🔄 Caché invalidado: "${query}"`);
    }
    
    return existed;
    
  } catch (error) {
    console.error('❌ Error invalidando caché:', error);
    return false;
  }
}

// Exponer funciones de utilidad en window para debug en consola
if (typeof window !== 'undefined') {
  window.TidolCache = {
    stats: getCacheStats,
    clear: clearAllCache,
    invalidate: invalidateCache
  };
  
  trace('🔧 Debug disponible: window.TidolCache.stats() / .clear() / .invalidate(query)');
}