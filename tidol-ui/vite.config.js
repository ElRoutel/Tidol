import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Si pides /api/albums...
      '/api': {
        target: 'http://localhost:3000', // ...Vite lo redirige a http://localhost:3000/api/albums
        changeOrigin: true,
      },
      // Lo mismo para tus archivos de música e imágenes
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      }
    }
  }
})