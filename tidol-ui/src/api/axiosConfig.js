import axios from "axios";

// 1. Determinar URL base
const getBaseURL = () => {
  if (window.location.protocol === 'https:') {
    return "/api"; // Producción / Cloudflare
  }
  return import.meta.env.VITE_API_URL || "http://localhost:3000/api";
};

const api = axios.create({
  baseURL: getBaseURL(),
  // IMPORTANTE: Quitamos 'withCredentials: true' global.
  // JWT en localStorage no necesita esto, y esto es lo que rompía Archive.org
  withCredentials: false 
});

// 2. Interceptor INTELIGENTE
api.interceptors.request.use((config) => {
  // Detectar si es una petición externa (ej: archive.org)
  const isExternal = config.url.startsWith('http') && !config.url.includes(window.location.host);

  // Solo agregamos el token si la petición va a NUESTRO backend
  if (!isExternal) {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } else {
    // Si es externa, aseguramos que no lleve Auth ni credenciales
    delete config.headers.Authorization;
    config.withCredentials = false;
  }
  
  return config;
}, (error) => {
  return Promise.reject(error);
});

// 3. Interceptor de Respuesta (Manejo de 401)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn("Sesión expirada o inválida. Cerrando sesión...");
      localStorage.removeItem("token");
      
      // Evitar bucle infinito de redirección
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;