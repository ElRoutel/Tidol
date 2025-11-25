import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import MobileHeader from '../components/MobileHeader';
import MobileNav from '../components/MobileNav';
import PlayerSheet from '../components/PlayerSheet';
import ContextMenu from '../components/ContextMenu';
import AddToPlaylistModal from '../components/AddToPlaylistModal';
import GlobalBackground from '../components/GlobalBackground';
import { usePlayer } from '../context/PlayerContext';
import '../styles/glass.css';

export default function ImmersiveLayout() {
    const location = useLocation();
    const { currentSong } = usePlayer();

    // Detectar si estamos en una página que maneja su propio fondo (Album, Artista, Playlist)
    const isImmersivePage =
        location.pathname.startsWith('/ia-album/') ||
        location.pathname.startsWith('/album/') ||
        location.pathname.startsWith('/artist/') ||
        location.pathname.startsWith('/playlist/');

    return (
        <>
            {/* Fondo Global (solo si no es página inmersiva) */}
            {!isImmersivePage && <GlobalBackground />}

            <div className="tidol-app-container" style={{ maxWidth: '100%' }}>
                {/* Orbes de fondo (solo visibles si no hay canción reproduciendo) */}
                <div className={`tidol-app-background ${!currentSong ? 'visible' : ''}`}>
                    <div className="tidol-app-orb tidol-app-orb-1"></div>
                    <div className="tidol-app-orb tidol-app-orb-2"></div>
                    <div className="tidol-app-orb tidol-app-orb-3"></div>
                </div>

                <div className="tidol-app-grid">
                    {/* Sidebar (Desktop) */}
                    <aside className="tidol-sidebar-container">
                        <Sidebar />
                    </aside>

                    {/* Header (Mobile) */}
                    <div className="tidol-mobile-header">
                        <MobileHeader />
                    </div>

                    {/* Contenido Principal */}
                    <main className={`tidol-main-content ${isImmersivePage ? 'no-padding' : ''} ${currentSong ? 'has-player' : ''}`}>
                        <Outlet />
                    </main>

                    {/* Player Sheet (Reproductor) */}
                    <PlayerSheet />

                    {/* Navegación (Mobile) */}
                    <nav className="tidol-mobile-nav">
                        <MobileNav />
                    </nav>

                    {/* Componentes Globales */}
                    <ContextMenu />
                    <AddToPlaylistModal />
                </div>
            </div>
        </>
    );
}
