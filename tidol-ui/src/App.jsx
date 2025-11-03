// tidol-frontend/src/App.jsx
import React from 'react';
import { Routes, Route, Outlet } from 'react-router-dom';
import { useAuth } from './context/AuthContext'; // Importa el hook

import Sidebar from './components/Sidebar';
import PlayerBar from './components/PlayerBar';
import ProtectedRoute from './components/ProtectedRoute'; // Importa el protector

import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import LoginPage from './pages/LoginPage'; // Importa la página de login

import './App.css'; 

// 1. El "Cascarón" (Layout) no cambia
function AppLayout() {
  const { logout } = useAuth(); // Sacamos logout para el botón
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <button onClick={logout} style={{float: 'right'}}>Cerrar Sesión</button>
        <Outlet />
      </main>
      <PlayerBar />
    </div>
  );
}

// 2. El Router principal ahora distingue rutas públicas/privadas
export default function App() {
  return (
    <Routes>
      {/* Ruta Pública: El Login */}
      <Route path="/login" element={<LoginPage />} />

      {/* Rutas Privadas: (Toda la app) */}
      <Route 
        path="/*" // Cualquier otra ruta (/, /search, /album/1...)
        element={
          <ProtectedRoute>
            {/* Si el usuario está autenticado, muestra el cascarón */}
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/search" element={<SearchPage />} />
                {/* <Route path="/album/:id" element={<AlbumPage />} /> */}
                {/* <Route path="/artist/:id" element={<ArtistPage />} /> */}
              </Route>
            </Routes>
          </ProtectedRoute>
        } 
      />
    </Routes>
  );
}