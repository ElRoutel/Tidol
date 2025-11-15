// src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useState } from 'react';
import './AppBlur.css'; // Importar estilos de blur
import './styles/glass.css'; // Importar estilos glass de forma global

// COMPONENTES DE LAYOUT
import Sidebar from './components/Sidebar';
import PlayerBar from './components/PlayerBar';
import MobileNav from './components/MobileNav';
import MobileHeader from './components/MobileHeader';
import ContextMenu from './components/ContextMenu';
import FullScreenPlayerPortal from './components/FullScreenPlayerPortal';

// PÁGINAS
import HomePage from './pages/HomePage';
import { SearchPage } from './pages/SearchPage';
import { UploadPage } from './pages/UploadPage';
import AlbumPage from './pages/AlbumPage';
import LoginPage from './pages/LoginPage';
import InternetArchivePage from './pages/InternetArchivePage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import LibraryPage from './pages/LibraryPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';

// RUTA PROTEGIDA
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

// LAYOUT PRINCIPAL CON BLUR
function AppLayout() {
  const [contextItem, setContextItem] = useState(null);

  const handleContextAction = (action, data) => {
    if (action === "setItem") return setContextItem(data);
    console.log("ContextMenu Action:", action, data);
    setContextItem(null);
  };

  return (
    <>
      <div className="tidol-app-container">
        {/* Background con orbes animados */}
        <div className="tidol-app-background">
          <div className="tidol-app-orb tidol-app-orb-1"></div>
          <div className="tidol-app-orb tidol-app-orb-2"></div>
          <div className="tidol-app-orb tidol-app-orb-3"></div>
        </div>

        {/* Grid principal */}
        <div className="tidol-app-grid">
          {/* Sidebar con glassmorphism */}
          <aside className="tidol-sidebar-container">
            <Sidebar />
          </aside>

          {/* Header móvil */}
          <div className="tidol-mobile-header">
            <MobileHeader />
          </div>

          {/* Contenido principal */}
          <main className="tidol-main-content">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/upload" element={<UploadPage />} />
              <Route path="/album/:id" element={<AlbumPage />} />
              <Route path="/ia-album/:identifier" element={<InternetArchivePage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/library" element={<LibraryPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
            </Routes>
          </main>

          {/* Player bar con blur intenso */}
          <footer className="tidol-player-container">
            <PlayerBar />
          </footer>

          {/* Nav móvil */}
          <nav className="tidol-mobile-nav">
            <MobileNav />
          </nav>

          {/* ContextMenu global */}
          <ContextMenu item={contextItem} onAction={handleContextAction} />
        </div>
      </div>
      <FullScreenPlayerPortal />
    </>
  );
}

// APP PRINCIPAL
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
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