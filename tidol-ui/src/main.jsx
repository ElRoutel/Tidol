// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './styles/design-system.css'
import './index.css'

// 1. Importa AMBOS cerebros
import { AuthProvider } from './context/AuthContext'
import { PlayerProvider } from './context/PlayerContext' // <--- ASEGÚRATE DE IMPORTARLO
import { PlaylistProvider } from './context/PlaylistContext'

import App from './App'


ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PlayerProvider> {/* <--- 2. ENVUELVE LA APP CON EL PLAYER */}
          <PlaylistProvider>
            <App />
          </PlaylistProvider>
        </PlayerProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)