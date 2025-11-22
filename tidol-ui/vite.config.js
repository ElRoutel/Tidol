import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa' // <--- IMPORTANTE: Importar el plugin

// El túnel de Cloudflare corre en tu misma máquina, 
// por lo que el proxy DEBE apuntar a 'localhost'.
const TARGET = 'http://localhost:3000';

export default defineConfig({
  plugins: [
    react(),
    // <--- CONFIGURACIÓN PWA INICIO --->
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Tidol Music',
        short_name: 'Tidol',
        description: 'Tu plataforma de música en streaming',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone', // Esto elimina la barra de URL del navegador
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: 'pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png'
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
    // <--- CONFIGURACIÓN PWA FIN --->
  ],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      '/api': { target: TARGET, changeOrigin: true },
      '/uploads': { target: TARGET, changeOrigin: true }
    },
    allowedHosts: ['.trycloudflare.com']
  }
});