// src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import PlayerBar from './components/PlayerBar';
import HomePage from './pages/HomePage';
import { SearchPage } from './pages/SearchPage';
import { UploadPage } from './pages/UploadPage';
import AlbumPage from './pages/AlbumPage';
import LoginPage from './pages/LoginPage';
import InternetArchivePage from './pages/InternetArchivePage'; // <-- ¡ESTA ES LA LÍNEA AÑADIDA!

// Componente para rutas protegidas
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <h2>Cargando...</h2>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
// Layout principal con Sidebar y PlayerBar
function AppLayout() {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/album/:id" element={<AlbumPage />} />
          {/* Esta ruta ahora funcionará porque el componente está importado */}
          <Route path="/ia-album/:identifier" element={<InternetArchivePage />} />
        </Routes>
      </main>
      <PlayerBar />
    </div>
  );
}

// App principal
export default function App() {
  return (
    <Routes>
      {/* Ruta pública: Login */}
      <Route path="/login" element={<LoginPage />} />

      {/* Rutas protegidas: Toda la app */}
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