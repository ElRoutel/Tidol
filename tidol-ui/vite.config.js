import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// El túnel de Cloudflare corre en tu misma máquina, 
// por lo que el proxy DEBE apuntar a 'localhost'.
const TARGET = 'http://localhost:3000';

// const LAN = 'http://192.168.1.70:3000'; // <- Esto no funcionará con el túnel
// const TAILSCALE = 'http://100.69.46.108:3000'; // <- Esto tampoco

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      '/api': { target: TARGET, changeOrigin: true },
      '/uploads': { target: TARGET, changeOrigin: true }
    },

    // --- 👇 TU SOLUCIÓN ESTÁ AQUÍ ---
    // El '.' al inicio significa "permite CUALQUIER COSA
    // que termine en .trycloudflare.com"
    allowedHosts: ['.trycloudflare.com']
    // ---------------------------------
  }
});