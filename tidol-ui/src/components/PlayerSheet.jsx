import React, { useEffect, useState, useCallback } from 'react';
import { motion, useAnimation, useDragControls } from 'framer-motion';
import { usePlayer } from '../context/PlayerContext';
import PlayerBar from './PlayerBar';
import FullScreenPlayer from './FullScreenPlayer';
import ReactDOM from 'react-dom';

const PlayerSheet = () => {
    const { isFullScreenOpen, openFullScreenPlayer, closeFullScreenPlayer, currentSong } = usePlayer();
    const controls = useAnimation();
    const dragControls = useDragControls();
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    // Función para calcular posiciones según el viewport actual
    const getPositions = useCallback((mobile = isMobile) => {
        if (mobile) {
            // Mobile: BottomNav (56px/h-14) + Player (64px) = 120px total approx
            // Usamos dvh (dynamic viewport height) para evitar problemas con la barra de URL
            return {
                collapsed: {
                    // Position just above the MobileNav (56px + safe area)
                    y: 'calc(100dvh - 64px - 56px - env(safe-area-inset-bottom))',
                    height: '64px',
                    width: '100%',
                    left: '0%',
                    x: '0%',
                    borderRadius: '0px'
                },
                expanded: {
                    y: '0px', // Full screen
                    height: '100dvh',
                    width: '100%',
                    left: '0%',
                    x: '0%',
                    borderRadius: '0px'
                }
            };
        } else {
            // Desktop: Lógica de cápsula flotante
            return {
                collapsed: {
                    // Flotante: 90px altura + 24px margen bottom
                    y: 'calc(100vh - 114px)',
                    height: '90px',
                    // Centrado tipo cápsula
                    width: '95%',
                    maxWidth: '1200px',
                    left: '50%',
                    x: '-50%',
                    borderRadius: '16px'
                },
                expanded: {
                    // Pantalla completa
                    y: 0,
                    height: '100vh',
                    width: '100vw',
                    maxWidth: '100vw',
                    left: '50%',
                    x: '-50%',
                    borderRadius: '0px'
                }
            };
        }
    }, [isMobile]);

    // Detectar cambios de viewport
    useEffect(() => {
        const handleResize = () => {
            const newIsMobile = window.innerWidth < 768;
            if (newIsMobile !== isMobile) {
                setIsMobile(newIsMobile);
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isMobile]);

    // Sincronizar animación con el estado
    useEffect(() => {
        const positions = getPositions(isMobile);
        const targetPosition = isFullScreenOpen ? positions.expanded : positions.collapsed;

        controls.start(targetPosition);
    }, [isFullScreenOpen, isMobile, controls, getPositions]);

    // Handler de drag
    const handleDragEnd = useCallback((event, info) => {
        const threshold = 150;
        const velocityThreshold = -500;
        const positions = getPositions(isMobile);

        // Si arrastra hacia arriba (abrir)
        if (info.offset.y < -threshold || info.velocity.y < velocityThreshold) {
            openFullScreenPlayer();
        }
        // Si arrastra hacia abajo (cerrar)
        else if (info.offset.y > threshold || info.velocity.y > -velocityThreshold) {
            closeFullScreenPlayer();
        }
        // Si no supera umbral, vuelve al estado actual
        else {
            const targetPosition = isFullScreenOpen ? positions.expanded : positions.collapsed;
            controls.start(targetPosition);
        }
    }, [isMobile, isFullScreenOpen, openFullScreenPlayer, closeFullScreenPlayer, controls, getPositions]);

    if (!currentSong) return null;

    const initialPositions = getPositions(isMobile);

    return ReactDOM.createPortal(
        <motion.div
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            animate={controls}
            initial={initialPositions.collapsed}
            transition={{ type: "spring", damping: 40, stiffness: 300, mass: 0.8 }}
            style={{
                position: "fixed",
                top: 0,
                zIndex: 9000,
                willChange: "transform, width, left, border-radius",
                overflow: "hidden"
            }}
            className="player-sheet-container shadow-2xl"
            onPointerDown={(e) => {
                const target = e.target;
                const isInteractive = target.closest('button, input, a, [role="button"], .progress-bar, .volume-slider');

                if (!isInteractive) {
                    dragControls.start(e);
                }
            }}
        >
            {/* CONTENIDO */}
            <div className="w-full h-full relative flex flex-col bg-black">

                {/* MINI PLAYER (Visible cuando colapsado) */}
                <motion.div
                    className="absolute top-0 left-0 right-0 z-20 h-full"
                    initial={{ opacity: 1, visibility: 'visible' }}
                    animate={{
                        opacity: isFullScreenOpen ? 0 : 1,
                        visibility: isFullScreenOpen ? 'hidden' : 'visible',
                        pointerEvents: isFullScreenOpen ? 'none' : 'auto'
                    }}
                    transition={{ duration: 0.3, delay: isFullScreenOpen ? 0 : 0.1 }}
                >
                    <PlayerBar isSheetMode={true} />
                </motion.div>

                {/* FULL PLAYER (Visible cuando expandido) */}
                <motion.div
                    className="w-full h-full"
                    animate={{
                        opacity: isFullScreenOpen ? 1 : 0,
                        pointerEvents: isFullScreenOpen ? 'auto' : 'none'
                    }}
                    transition={{ duration: 0.2 }}
                >
                    <FullScreenPlayer isEmbedded={true} />
                </motion.div>

            </div>
        </motion.div>,
        document.body
    );
};

export default PlayerSheet;