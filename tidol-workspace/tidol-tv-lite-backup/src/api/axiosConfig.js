import axios from "axios";

const api = axios.create({
  baseURL: "/api/v1",
  withCredentials: false
});

// 2. Interceptor INTELIGENTE
api.interceptors.request.use((config) => {
  // Detectar si es una petición externa (ej: archive.org)
  const isExternal = config.url.startsWith('http') && !config.url.includes(window.location.host);

  // Solo agregamos el token si la petición va a NUESTRO backend
  if (!isExternal) {
    const token = localStorage.getItem("token") || "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjMsImRldmljZV9pZCI6IjE2MjRkYjY1LTMzMjctNDQ1Zi05NWJkLTViYThhMjNmYzdkYSIsImV4cCI6MTc4MjAwNjIwOSwiaWF0IjoxNzgxNDAxNDA5fQ.FokKAXVZK0xq4n2wbCxCyF1URyvfPCQbC6SHfpUTzWs";
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

      // Evitar bucle infinito de redirección y no redirigir si falla el login mismo
      if (!window.location.pathname.includes('/login') && !error.config.url.includes('/auth/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;