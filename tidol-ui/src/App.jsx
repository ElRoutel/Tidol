import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { lazy, Suspense } from 'react';
import { ContextMenuProvider } from './context/ContextMenuContext';
import './AppBlur.css';
import './styles/glass.css';

// Layouts
import ImmersiveLayout from './layouts/ImmersiveLayout';
import AuthLayout from './layouts/AuthLayout';

// Pages (Lazy Loading)
const HomePage = lazy(() => import('./pages/HomePage'));
const SearchPage = lazy(() => import('./pages/SearchPage').then(module => ({ default: module.SearchPage })));
const UploadPage = lazy(() => import('./pages/UploadPage').then(module => ({ default: module.UploadPage })));
const AlbumPage = lazy(() => import('./pages/AlbumPage'));
const ArtistPage = lazy(() => import('./pages/ArtistPage'));
const InternetArchivePage = lazy(() => import('./pages/InternetArchivePage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const LibraryPage = lazy(() => import('./pages/LibraryPage'));
const PlaylistPage = lazy(() => import('./pages/PlaylistPage'));

// Auth Pages
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));

// Componente de carga
const LoadingScreen = () => (
  <div className="tidol-loading-screen">
    <div className="tidol-loading-content">
      <div className="tidol-loading-spinner"></div>
      <h2 className="tidol-loading-title">Cargando...</h2>
    </div>
  </div>
);

// Protección de rutas
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App() {
  return (
    <ContextMenuProvider>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          {/* Rutas Públicas (Auth) */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
          </Route>

          {/* Rutas Protegidas (App Principal) */}
          <Route element={
            <ProtectedRoute>
              <ImmersiveLayout />
            </ProtectedRoute>
          }>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/profile" element={<ProfilePage />} />

            {/* Rutas de Detalle */}
            <Route path="/album/:id" element={<AlbumPage />} />
            <Route path="/artist/:id" element={<ArtistPage />} />
            <Route path="/ia-album/:identifier" element={<InternetArchivePage />} />
            <Route path="/playlist/:id" element={<PlaylistPage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ContextMenuProvider>
  );
}