import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import MobileHeader from '../components/MobileHeader';
import DesktopHeader from '../components/DesktopHeader';

import PlayerSheet from '../components/PlayerSheet';
import ContextMenu from '../components/ContextMenu';
import AddToPlaylistModal from '../components/AddToPlaylistModal';
import AmbientBackground from '../components/AmbientBackground';
import { usePlayer } from '../context/PlayerContext';
import '../styles/glass.css';
import './ImmersiveLayout.css';

export default function ImmersiveLayout() {
    const location = useLocation();
    const { currentSong, isFullScreenOpen } = usePlayer();

    // Detectar si estamos en una página que maneja su propio fondo (Album, Artista, Playlist)
    const isImmersivePage =
        location.pathname.startsWith('/ia-album/') ||
        location.pathname.startsWith('/album/') ||
        location.pathname.startsWith('/artist/') ||
        location.pathname.startsWith('/playlist/');

    return (
        <>
            {/* Aurora Ambient Background - Global premium mesh gradient */}
            {currentSong && (
                <div className="fixed inset-0" style={{ zIndex: 0 }}>
                    <AmbientBackground
                        songId={currentSong.id}
                        colors={currentSong.extractedColors}
                        intensity={0.4}
                    />
                </div>
            )}

            <div className="tidol-app-container relative z-10">
                {/* Orbes de fondo (solo visibles si no hay canción reproduciendo) */}
                <div className={`tidol-app-background ${!currentSong ? 'visible' : ''}`}>
                    <div className="tidol-app-orb tidol-app-orb-1"></div>
                    <div className="tidol-app-orb tidol-app-orb-2"></div>
                    <div className="tidol-app-orb tidol-app-orb-3"></div>
                </div>

                <div className={`tidol-app-grid ${isFullScreenOpen ? 'app-hidden-background' : ''}`}>
                    {/* Sidebar (Desktop) - Width handled by CSS */}
                    <aside className="tidol-sidebar-container hidden md:flex">
                        <Sidebar />
                    </aside>

                    {/* Content Wrapper */}
                    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                        {/* Header (Desktop) */}
                        <DesktopHeader />

                        {/* Header (Mobile) - Hide on immersive pages to allow custom overlay */}
                        {!isImmersivePage && (
                            <div className="tidol-mobile-header md:hidden">
                                <MobileHeader />
                            </div>
                        )}

                        {/* Contenido Principal */}
                        <main className={`tidol-main-content ${isImmersivePage ? 'no-padding' : ''}`}>
                            <Outlet />
                        </main>
                    </div>

                    {/* Player Sheet (Reproductor) */}
                    <PlayerSheet />

                    {/* Componentes Globales */}
                    <ContextMenu />
                    <AddToPlaylistModal />
                </div>
            </div>
        </>
    );
}
