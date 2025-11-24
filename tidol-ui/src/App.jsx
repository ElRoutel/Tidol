import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { lazy, Suspense, useState, useEffect } from 'react';
import './AppBlur.css';
import './styles/glass.css';

// COMPONENTES DE LAYOUT
import Sidebar from './components/Sidebar';
// import PlayerBar from './components/PlayerBar'; // Reemplazado por PlayerSheet
import MobileNav from './components/MobileNav';
import MobileHeader from './components/MobileHeader';
import ContextMenu from './components/ContextMenu';
import PlayerSheet from './components/PlayerSheet';
import GlobalBackground from './components/GlobalBackground';
import { usePlayer } from './context/PlayerContext';

// PÁGINAS (Lazy Loading)
const HomePage = lazy(() => import('./pages/HomePage'));
const SearchPage = lazy(() => import('./pages/SearchPage').then(module => ({ default: module.SearchPage })));
const UploadPage = lazy(() => import('./pages/UploadPage').then(module => ({ default: module.UploadPage })));
const AlbumPage = lazy(() => import('./pages/AlbumPage'));
const ArtistPage = lazy(() => import('./pages/ArtistPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const InternetArchivePage = lazy(() => import('./pages/InternetArchivePage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const LibraryPage = lazy(() => import('./pages/LibraryPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));

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
            <Suspense fallback={
              <div className="tidol-loading-screen">
                <div className="tidol-loading-content">
                  <div className="tidol-loading-spinner"></div>
                </div>
              </div>
            }>
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
            </Suspense>
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
      <Route path="/login" element={
        <Suspense fallback={<div className="tidol-loading-screen"><div className="tidol-loading-spinner"></div></div>}>
          <LoginPage />
        </Suspense>
      } />
      <Route path="/register" element={
        <Suspense fallback={<div className="tidol-loading-screen"><div className="tidol-loading-spinner"></div></div>}>
          <RegisterPage />
        </Suspense>
      } />
      <Route path="/terms" element={
        <Suspense fallback={<div className="tidol-loading-screen"><div className="tidol-loading-spinner"></div></div>}>
          <TermsPage />
        </Suspense>
      } />
      <Route path="/privacy" element={
        <Suspense fallback={<div className="tidol-loading-screen"><div className="tidol-loading-spinner"></div></div>}>
          <PrivacyPage />
        </Suspense>
      } />

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