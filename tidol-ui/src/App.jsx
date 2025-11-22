import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useState } from 'react';
import './AppBlur.css'; 
import './styles/glass.css'; 

// COMPONENTES DE LAYOUT
import Sidebar from './components/Sidebar';
import PlayerBar from './components/PlayerBar';
import MobileNav from './components/MobileNav';
import MobileHeader from './components/MobileHeader';
import ContextMenu from './components/ContextMenu';
import FullScreenPlayerPortal from './components/FullScreenPlayerPortal';
import GlobalBackground from './components/GlobalBackground'; // <-- PASO 3: IMPORTAR

// PÁGINAS
import HomePage from './pages/HomePage';
import { SearchPage } from './pages/SearchPage';
import { UploadPage } from './pages/UploadPage';
import AlbumPage from './pages/AlbumPage';
import ArtistPage from './pages/ArtistPage'; // <-- AÑADIR IMPORT
import LoginPage from './pages/LoginPage';
import InternetArchivePage from './pages/InternetArchivePage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import LibraryPage from './pages/LibraryPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';

// RUTA PROTEGIDA (Sin cambios)
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

// ==========================================================
// --- CAMBIO 1: Eliminar rutas de AppLayout ---
// ==========================================================
function AppLayout() {
  const [contextItem, setContextItem] = useState(null);
  const location = useLocation();

  const handleContextAction = (action, data) => {
    if (action === "setItem") return setContextItem(data);
    console.log("ContextMenu Action:", action, data);
    setContextItem(null);
  };

  const isAlbumPage = location.pathname.startsWith('/ia-album/') || location.pathname.startsWith('/album/');

  return (
    <>
      {/* PASO 3: INTEGRAR EL COMPONENTE DE FONDO */}
      <GlobalBackground />
      <div 
        className="tidol-app-container"
        style={{ maxWidth: '100%' }} // <-- CORRECCIÓN: Evita el desbordamiento horizontal en PC/TV
      >
        {/* ... (Orbes de fondo, etc.) ... */}
        <div className="tidol-app-background">
          <div className="tidol-app-orb tidol-app-orb-1"></div>
          <div className="tidol-app-orb tidol-app-orb-2"></div>
          <div className="tidol-app-orb tidol-app-orb-3"></div>
        </div>

        <div className="tidol-app-grid">
          {/* ... (Sidebar, Header, etc.) ... */}
          <aside className="tidol-sidebar-container">
            <Sidebar />
          </aside>
          <div className="tidol-mobile-header">
            <MobileHeader />
          </div>

          <main className={`tidol-main-content ${isAlbumPage ? 'no-padding' : ''}`}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/upload" element={<UploadPage />} />
              <Route path="/album/:id" element={<AlbumPage />} />
              <Route path="/artist/:id" element={<ArtistPage />} /> {/* <-- AÑADIR RUTA */}
              <Route path="/ia-album/:identifier" element={<InternetArchivePage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/library" element={<LibraryPage />} />
              {/* --- RUTAS MOVIDAS --- */}
              {/* <Route path="/terms" element={<TermsPage />} /> */}
              {/* <Route path="/privacy" element={<PrivacyPage />} /> */}
            </Routes>
          </main>

          {/* ... (PlayerBar, MobileNav, etc.) ... */}
          <footer className="tidol-player-container">
            <PlayerBar />
          </footer>
          <nav className="tidol-mobile-nav">
            <MobileNav />
          </nav>
          <ContextMenu item={contextItem} onAction={handleContextAction} />
        </div>
      </div>
      <FullScreenPlayerPortal />
    </>
  );
}

// ==========================================================
// --- CAMBIO 2: Añadir rutas públicas a App() ---
// ==========================================================
export default function App() {
  return (
    <Routes>
      {/* --- RUTAS PÚBLICAS --- */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      {/* Estas páginas no tendrán la barra lateral ni el reproductor, 
          lo cual es correcto para páginas legales. */}
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />

      {/* --- RUTAS PRIVADAS --- */}
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