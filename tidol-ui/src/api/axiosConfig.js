import axios from "axios";

const LAN_URL = "http://192.168.1.70:3000/api";
const TAILSCALE_URL = "http://100.69.46.108:3000/api";

let selectedBaseURL = "/api"; // ✅ Valor por defecto

// Instancia ANTES de la detección async
const api = axios.create({
  baseURL: selectedBaseURL,
});

// Token automático
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Prueba y actualiza la URL (sin bloquear)
(async () => {
  const tryFetch = async (url) => {
    try {
      const res = await fetch(url + "/health", {
        method: "GET",
        signal: AbortSignal.timeout(1000),
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  if (window.location.protocol === 'https:') {
    selectedBaseURL = "/api";
  } else if (await tryFetch(LAN_URL)) {
    selectedBaseURL = LAN_URL;
  } else if (await tryFetch(TAILSCALE_URL)) {
    selectedBaseURL = TAILSCALE_URL;
  } else {
    selectedBaseURL = "/api";
  }
  
  console.log("🌐 Conectando con backend:", selectedBaseURL);
  api.defaults.baseURL = selectedBaseURL;
})();

export default api;
