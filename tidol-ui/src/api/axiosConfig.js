import axios from "axios";

// 1. Definir URL base síncronamente para evitar condiciones de carrera
// Si estamos en HTTPS (Cloudflare/Prod), usamos ruta relativa "/api".
// Si estamos en HTTP (Local), intentamos adivinar o usar localhost.
const getBaseURL = () => {
  if (window.location.protocol === 'https:') {
    return "/api"; // Producción / Cloudflare
  }
  // Aquí podrías poner lógica para detectar si es localhost
  // Pero para desarrollo, es mejor tener una variable de entorno o fallback
  return import.meta.env.VITE_API_URL || "http://localhost:3000/api";
};

const api = axios.create({
  baseURL: getBaseURL(),
  withCredentials: true // Importante si usas cookies en el futuro
});

// 2. Interceptor de Solicitud (Tu lógica actual)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// 3. NUEVO: Interceptor de Respuesta (Manejo de errores 401)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Si el error es 401 (No autorizado), significa que el token venció o no existe
    if (error.response && error.response.status === 401) {
      console.warn("Sesión expirada o inválida. Cerrando sesión...");
      
      // Borramos el token local
      localStorage.removeItem("token");
      localStorage.removeItem("user"); // Si guardas datos de usuario

      // Opcional: Redirigir al login forzosamente
      // Nota: Usar window.location recarga la página, lo cual limpia estados corruptos
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.href = '/login'; 
      }
    }
    return Promise.reject(error);
  }
);

// 4. (Opcional) Lógica de detección de LAN/Tailscale diferida
// Solo útil si estás desarrollando en local y quieres cambiar la IP al vuelo.
// Nota: Esto no afecta la carga inicial de React que ya disparó peticiones.
(async () => {
  if (window.location.protocol === 'https:') return; // No hacer nada en Cloudflare

  const LAN_URL = "http://192.168.1.70:3000/api";
  const TAILSCALE_URL = "http://100.69.46.108:3000/api";

  const tryFetch = async (url) => {
    try {
      const res = await fetch(url + "/health", { 
        method: "GET", 
        signal: AbortSignal.timeout(500) 
      });
      return res.ok;
    } catch { return false; }
  };

  let newUrl = null;
  if (await tryFetch(LAN_URL)) newUrl = LAN_URL;
  else if (await tryFetch(TAILSCALE_URL)) newUrl = TAILSCALE_URL;

  if (newUrl && api.defaults.baseURL !== newUrl) {
    console.log("🔄 Cambiando API a red local:", newUrl);
    api.defaults.baseURL = newUrl;
  }
})();

export default api;