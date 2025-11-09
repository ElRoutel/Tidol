// src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// 1. IMPORTAMOS LOS COMPONENTES DE LAYOUT
import Sidebar from './components/Sidebar';
import PlayerBar from './components/PlayerBar';
import MobileNav from './components/MobileNav'; // <-- Importamos el nav móvil que hicimos

// 2. IMPORTAMOS TUS PÁGINAS
import HomePage from './pages/HomePage';
import { SearchPage } from './pages/SearchPage';
import { UploadPage } from './pages/UploadPage';
import AlbumPage from './pages/AlbumPage';
import LoginPage from './pages/LoginPage';
import InternetArchivePage from './pages/InternetArchivePage';
import ProfilePage from './pages/ProfilePage'; // Importa la nueva página

// --- TU LÓGICA DE AUTENTICACIÓN (Sin cambios) ---
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

// --- LAYOUT PRINCIPAL (¡Aquí está la fusión!) ---
function AppLayout() {
  return (
    // Usamos el layout de CSS Grid que definimos
    <div className="h-screen bg-background text-text grid
                    grid-rows-[1fr_auto_auto]
                    md:grid-rows-[1fr_auto]
                    md:grid-cols-[250px_1fr]">

      {/* 1. BARRA LATERAL (Solo PC) */}
      <Sidebar />
      
      {/* 2. CONTENIDO PRINCIPAL (Con tus rutas) */}
      <main className="overflow-y-auto md:col-start-2 md:row-start-1 bg-background">
        
        {/* Aquí es donde tus páginas se renderizarán */}
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/album/:id" element={<AlbumPage />} />
          <Route path="/ia-album/:identifier" element={<InternetArchivePage />} />
          <Route path="/profile" element={<ProfilePage />} /> 
          {/* Puedes añadir más rutas aquí, como /playlist/:id, etc. */}
        </Routes>
        
      </main>

      {/* 3. REPRODUCTOR (Fijo abajo) */}
      {/* Usamos un <footer> como "contenedor" para posicionar tu PlayerBar */}
      <footer className="h-24 bg-surface text-text
                         border-t border-interactive-bg
                         md:col-span-2">
        {/* Tu componente PlayerBar va adentro, asegúrate que use "w-full" (ancho completo) */}
        <PlayerBar />
      </footer>

      {/* 4. BARRA DE NAVEGACIÓN (Solo Móvil) */}
      <MobileNav />

    </div>
  );
}

// --- APP PRINCIPAL (Sin cambios) ---
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