// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './styles/design-system.css'
import './index.css'

import { AuthProvider } from './context/AuthContext'
import { PlayerProvider } from './context/PlayerContext'
import { PlaylistProvider } from './context/PlaylistContext'

import App from './App'

const params = new URLSearchParams(window.location.search);
const token = params.get('auth');
if (token) {
    localStorage.setItem('token', token);
    window.history.replaceState({}, document.title, window.location.pathname);
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <BrowserRouter>
            <AuthProvider>
                <PlayerProvider>
                    <PlaylistProvider>
                        <App />
                    </PlaylistProvider>
                </PlayerProvider>
            </AuthProvider>
        </BrowserRouter>
    </React.StrictMode>,
)
