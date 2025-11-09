import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// BORRA ESTA LÍNEA: import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // DEJA SOLO 'react()'
  plugins: [react()], 
  
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000', 
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      }
    }
  }
})