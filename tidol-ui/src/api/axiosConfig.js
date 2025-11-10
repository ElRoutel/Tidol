import axios from "axios";

const api = axios.create({
  baseURL: "http://100.69.46.108:3000/api", // ✅ Ahora sí correcto para Tailscale
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
