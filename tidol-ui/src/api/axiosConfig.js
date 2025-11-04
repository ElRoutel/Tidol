// src/api/axiosConfig.js
import axios from 'axios';

// Creamos nuestra instancia "api"
const api = axios.create(); 
// No necesita baseURL, el proxy de Vite se encarga

// El interceptor "inyecta" el token en cada petición
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['x-token'] = token;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;