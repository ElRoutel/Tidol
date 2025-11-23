import React, { useEffect, useState, useCallback } from 'react';
import { motion, useAnimation, useDragControls } from 'framer-motion';
import { usePlayer } from '../context/PlayerContext';
import PlayerBar from './PlayerBar';
import FullScreenPlayer from './FullScreenPlayer';

const PlayerSheet = () => {
    const { isFullScreenOpen, openFullScreenPlayer, closeFullScreenPlayer, currentSong } = usePlayer();
    const controls = useAnimation();
    const dragControls = useDragControls();
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    // Función para calcular posiciones según el viewport actual
    const getPositions = useCallback((mobile = isMobile) => {
        if (mobile) {
            // Mobile: BottomNav (64px) + Player (64px) = 128px
            return {
                collapsed: {
                    y: 'calc(100vh - 128px - env(safe-area-inset-bottom))',
                    height: '64px'
                },
                expanded: {
                    y: '64px', // Después del MobileHeader
                    height: 'calc(100vh - 128px - env(safe-area-inset-bottom))'
                }
            };
        } else {
            // Desktop: Solo Player (90px)
            return {
                collapsed: {
                    y: 'calc(100vh - 90px)',
                    height: '90px'
                },
                expanded: {
                    y: 0,
                    height: '100vh'
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

    // Handler de drag con lógica corregida
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

    // Posiciones iniciales correctas según viewport
    const initialPositions = getPositions(isMobile);

    return (
        <motion.div
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            animate={controls}
            initial={initialPositions.collapsed}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                zIndex: 9000,
                willChange: "transform",
            }}
            className="player-sheet-container shadow-2xl"
            onPointerDown={(e) => {
                // Solo permitir drag si no es un elemento interactivo
                const target = e.target;
                const isInteractive = target.closest('button, input, a, [role="button"]');

                if (!isInteractive) {
                    dragControls.start(e);
                }
            }}
        >
            {/* CONTENIDO */}
            <div className="w-full h-full relative overflow-hidden flex flex-col bg-black">

                {/* MINI PLAYER (Visible cuando colapsado) */}
                <motion.div
                    className="absolute top-0 left-0 right-0 z-20"
                    animate={{
                        opacity: isFullScreenOpen ? 0 : 1,
                        pointerEvents: isFullScreenOpen ? 'none' : 'auto'
                    }}
                    transition={{ duration: 0.2 }}
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
        </motion.div>
    );
};

export default PlayerSheet;