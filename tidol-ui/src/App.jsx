import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useState, useEffect } from 'react';
import './AppBlur.css';
import './styles/glass.css';

// COMPONENTES DE LAYOUT
import Sidebar from './components/Sidebar';
import PlayerBar from './components/PlayerBar';
import MobileNav from './components/MobileNav';
import MobileHeader from './components/MobileHeader';
import ContextMenu from './components/ContextMenu';
// import FullScreenPlayerPortal from './components/FullScreenPlayerPortal'; // Ya no se usa
import PlayerSheet from './components/PlayerSheet'; // <--- NUEVO
import GlobalBackground from './components/GlobalBackground'; // Aseguramos la importación
import { usePlayer } from './context/PlayerContext';

// PÁGINAS
import HomePage from './pages/HomePage';
import { SearchPage } from './pages/SearchPage';
import { UploadPage } from './pages/UploadPage';
import AlbumPage from './pages/AlbumPage';
import ArtistPage from './pages/ArtistPage';
import LoginPage from './pages/LoginPage';
import InternetArchivePage from './pages/InternetArchivePage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import LibraryPage from './pages/LibraryPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="tidol-loading-screen">
        <div className="tidol-loading-content">
          <div className="tidol-loading-spinner"></div>
          <h2 className="tidol-loading-title">Cargando...</h2>
          <p className="tidol-loading-subtitle">Preparando tu música</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AppLayout() {
  const [contextItem, setContextItem] = useState(null);
  const location = useLocation();
  const { currentSong } = usePlayer(); // 1. Obtenemos la canción actual del reproductor

  const handleContextAction = (action, data) => {
    if (action === "setItem") return setContextItem(data);
    setContextItem(null);
  };

  // 1. DETECTAR PÁGINAS INMERSIVAS
  // Estas páginas tienen su propio fondo "Spotlight", así que ocultaremos el global.
  const isImmersivePage =
    location.pathname.startsWith('/ia-album/') ||
    location.pathname.startsWith('/album/') ||
    location.pathname.startsWith('/artist/');

  return (
    <>
      {/* RENDERIZADO CONDICIONAL DEL FONDO */}
      {/* Si NO estamos en una página inmersiva, mostramos el fondo de la canción actual. */}
      {!isImmersivePage && <GlobalBackground />}

      <div
        className="tidol-app-container"
        style={{ maxWidth: '100%' }}
      >
        {/* Orbes: Solo se ven si NO hay una canción cargada. */}
        {/* La clase 'visible' controla la transición de opacidad. */}
        <div className={`tidol-app-background ${!currentSong ? 'visible' : ''}`}>
          <div className="tidol-app-orb tidol-app-orb-1"></div>
          <div className="tidol-app-orb tidol-app-orb-2"></div>
          <div className="tidol-app-orb tidol-app-orb-3"></div>
        </div>

        <div className="tidol-app-grid">
          <aside className="tidol-sidebar-container">
            <Sidebar />
          </aside>

          <div className="tidol-mobile-header">
            <MobileHeader />
          </div>

          {/* 3. CLASE DINÁMICA: 'no-padding' para que el banner del álbum toque el borde */}
          <main className={`tidol-main-content ${isImmersivePage ? 'no-padding' : ''} ${currentSong ? 'has-player' : ''}`}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/upload" element={<UploadPage />} />

              {/* Rutas Inmersivas */}
              <Route path="/album/:id" element={<AlbumPage />} />
              <Route path="/artist/:id" element={<ArtistPage />} />
              <Route path="/ia-album/:identifier" element={<InternetArchivePage />} />

              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/library" element={<LibraryPage />} />
            </Routes>
          </main>

          {/* PLAYER SHEET (Reemplaza al PlayerBar y FullScreenPlayerPortal) */}
          <PlayerSheet />

          <nav className="tidol-mobile-nav">
            <MobileNav />
          </nav>

          <ContextMenu item={contextItem} onAction={handleContextAction} />
        </div>
      </div>
      {/* <FullScreenPlayerPortal /> YA NO ES NECESARIO */}
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />

      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}