import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { lazy, Suspense, ReactNode } from 'react';
import { ContextMenuProvider } from './context/ContextMenuContext';
import './AppBlur.css';
import './styles/glass.css';
import TvFullScreenPlayer from './components/TvFullScreenPlayer';
import TvLoginPage from './pages/TvLoginPage';

// Layout TV
const TvLayout = lazy(() => import('./layouts/TvLayout'));

// Pages TV
const TvHomePage = lazy(() => import('./pages/TvHomePage'));
const TvSearchPage = lazy(() => import('./pages/TvSearchPage'));
const TvLibraryPage = lazy(() => import('./pages/TvLibraryPage'));
const TvProfilePage = lazy(() => import('./pages/TvProfilePage'));
const TvAlbumPage = lazy(() => import('./pages/TvAlbumPage'));
const TvArtistPage = lazy(() => import('./pages/TvArtistPage'));
const TvPlaylistPage = lazy(() => import('./pages/TvPlaylistPage'));
const TvInternetArchivePage = lazy(() => import('./pages/TvInternetArchivePage'));

// Componente de carga
const LoadingScreen = () => (
    <div className="tidol-loading-screen bg-neutral-950">
        <div className="tidol-loading-content">
            <div className="tidol-loading-spinner border-blue-500"></div>
            <h2 className="tidol-loading-title text-white">Cargando TV...</h2>
        </div>
    </div>
);

// Protección de rutas
function ProtectedRoute({ children }: { children: ReactNode }) {
    const { isAuthenticated, loading } = useAuth();

    if (loading) return <LoadingScreen />;
    if (!isAuthenticated) return <Navigate to="/login" replace />;

    return <>{children}</>;
}

export default function App() {
    return (
        <ContextMenuProvider>
            <div className="overflow-x-hidden w-full min-h-screen bg-neutral-950">
                <TvFullScreenPlayer />
                <Suspense fallback={<LoadingScreen />}>
                    <Routes>
                        <Route path="/login" element={<TvLoginPage />} />
                        <Route element={<ProtectedRoute><TvLayout /></ProtectedRoute>}>
                            <Route path="/" element={<TvHomePage />} />
                            <Route path="/search" element={<TvSearchPage />} />
                            <Route path="/library" element={<TvLibraryPage />} />
                            <Route path="/profile" element={<TvProfilePage />} />
                            <Route path="/album/:id" element={<TvAlbumPage />} />
                            <Route path="/artist/:id" element={<TvArtistPage />} />
                            <Route path="/playlist/:id" element={<TvPlaylistPage />} />
                            <Route path="/ia-album/:identifier" element={<TvInternetArchivePage />} />
                        </Route>

                        {/* Fallback */}
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </Suspense>
            </div>
        </ContextMenuProvider>
    );
}
