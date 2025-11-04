// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

// 1. Importa AMBOS cerebros
import { AuthProvider } from './context/AuthContext'
import { PlayerProvider } from './context/PlayerContext' // <--- ASEGÚRATE DE IMPORTARLO

import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PlayerProvider> {/* <--- 2. ENVUELVE LA APP CON EL PLAYER */}
          <App />
        </PlayerProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)