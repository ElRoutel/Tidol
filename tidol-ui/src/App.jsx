// src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useState } from 'react';

// COMPONENTES DE LAYOUT
import Sidebar from './components/Sidebar';
import PlayerBar from './components/PlayerBar';
import MobileNav from './components/MobileNav';
import ContextMenu from './components/ContextMenu';

// PÁGINAS
import HomePage from './pages/HomePage';
import { SearchPage } from './pages/SearchPage';
import { UploadPage } from './pages/UploadPage';
import AlbumPage from './pages/AlbumPage';
import LoginPage from './pages/LoginPage';
import InternetArchivePage from './pages/InternetArchivePage';
import ProfilePage from './pages/ProfilePage';
import LibraryPage from './pages/LibraryPage';

// RUTA PROTEGIDA
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen bg-background flex justify-center items-center">
        <h2 className="text-text text-2xl">Cargando...</h2>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

// LAYOUT PRINCIPAL
function AppLayout() {
  const [contextItem, setContextItem] = useState(null);

  const handleContextAction = (action, data) => {
    if (action === "setItem") return setContextItem(data);

    // Aquí puedes integrar funciones de PlayerContext o navegación
    console.log("ContextMenu Action:", action, data);

    setContextItem(null);
  };

  return (
    <div className="h-screen bg-background text-text grid
                    grid-rows-[1fr_auto_auto]
                    md:grid-rows-[1fr_auto]
                    md:grid-cols-[250px_1fr] relative">

      {/* Sidebar */}
      <Sidebar />

      {/* Contenido principal */}
      <main className="overflow-y-auto md:col-start-2 md:row-start-1 bg-background">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/album/:id" element={<AlbumPage />} />
          <Route path="/ia-album/:identifier" element={<InternetArchivePage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/library" element={<LibraryPage />} />
        </Routes>
      </main>

      {/* Player fijo abajo */}
      <footer className="h-10 from-zinc-900 text-text
                         border-t border-interactive-bg
                         md:col-span-2">
        <PlayerBar />
      </footer>

      {/* Nav móvil */}
      <MobileNav />

      {/* ContextMenu global */}
      <ContextMenu item={contextItem} onAction={handleContextAction} />
    </div>
  );
}

// APP PRINCIPAL
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
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
