import axios from "axios";

const LAN_URL = "http://192.168.1.70:3000/api";
const TAILSCALE_URL = "http://100.69.46.108:3000/api";

let selectedBaseURL = null;

// Prueba si un backend responde en menos de 1 segundo
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

// Detecta automáticamente y guarda el resultado
(async () => {
  if (await tryFetch(LAN_URL)) {
    selectedBaseURL = LAN_URL;
  } else if (await tryFetch(TAILSCALE_URL)) {
    selectedBaseURL = TAILSCALE_URL;
  } else {
    selectedBaseURL = window.location.origin + "/api";
  }
  console.log("🌐 Conectando con backend:", selectedBaseURL);
  api.defaults.baseURL = selectedBaseURL;
})();

// Instancia global de axios (ya exportable)
const api = axios.create({
  baseURL: selectedBaseURL || "http://100.69.46.108:3000/api", // valor inicial por si tarda
});

// Token automático
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
