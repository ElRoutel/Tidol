import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const LAN = 'http://192.168.1.70:3000';
const TAILSCALE = 'http://100.69.46.108:3000';
const TARGET = process.env.TIDOL_ENV === 'lan' ? LAN : TAILSCALE;

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      '/api': { target: TARGET, changeOrigin: true },
      '/uploads': { target: TARGET, changeOrigin: true }
    }
  }
});
