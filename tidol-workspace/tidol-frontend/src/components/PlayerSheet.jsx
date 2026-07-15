import React, { useEffect, useState, useCallback } from 'react';
import { motion, useAnimation, useDragControls } from 'framer-motion';
import { usePlayer } from '../context/PlayerContext';
import PlayerBar from './PlayerBar';
import FullScreenPlayer from './FullScreenPlayer';
import ReactDOM from 'react-dom';

const PlayerSheet = () => {
    const { isFullScreenOpen, setIsFullScreenOpen, currentTrack: currentSong } = usePlayer();
    const controls = useAnimation();
    const dragControls = useDragControls();
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    // Función para calcular posiciones según el viewport actual
    const getPositions = useCallback((mobile = isMobile) => {
        // `y` NUMÉRICO (px), no calc()/dvh. Motivo del bug de la pantalla negra:
        // framer-motion no puede interpolar entre el número que el gesto de arrastre
        // deja en `y` y una cadena `calc(100dvh - …)`. Al deslizar para cerrar, la
        // animación hacia "collapsed" fallaba y la sábana se quedaba en y:0 → fondo
        // negro (bg-background) con la mini-barra pegada arriba. Con números, el
        // arrastre y `controls` operan sobre el mismo tipo y la reposición es fiable.
        // El alto sigue siendo 100dvh (solo animamos `y`); el listener de resize
        // reajusta la posición colapsada cuando la barra de URL móvil aparece/desaparece.
        const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
        // Inset inferior (barra de gestos, PWA edge-to-edge). Se lee la var CSS
        // de index.css porque `y` se calcula en px, no en CSS.
        const safeBottom = typeof window !== 'undefined'
            ? parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-bottom')) || 0
            : 0;
        if (mobile) {
            // Mobile: solo asoma el mini-player (64px) + el inset inferior, que
            // queda relleno por el bg-background de la sábana bajo la barra de
            // gestos; el nav móvil se eliminó.
            return {
                collapsed: {
                    y: vh - 64 - safeBottom,
                    height: '100dvh',
                    width: '100%',
                    left: '0%',
                    x: '0%',
                    borderRadius: '0px'
                },
                expanded: {
                    y: 0, // Full screen
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
                    y: vh - 114,
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
                // Cruce de breakpoint: el effect de sincronización reposiciona.
                setIsMobile(newIsMobile);
                return;
            }
            // Ahora que `y` es un número fijo en px, hay que reajustar la posición
            // colapsada cuando cambia el alto del viewport (la barra de URL móvil que
            // aparece/desaparece), o la mini-barra se despegaría del fondo. Se usa
            // `set` (instantáneo, sin animación) para que siga al viewport sin tirones.
            if (!isFullScreenOpen) {
                controls.set(getPositions(newIsMobile).collapsed);
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isMobile, isFullScreenOpen, controls, getPositions]);

    // Sincronizar animación con el estado
    useEffect(() => {
        const positions = getPositions(isMobile);
        const targetPosition = isFullScreenOpen ? positions.expanded : positions.collapsed;

        controls.start(targetPosition);
    }, [isFullScreenOpen, isMobile, controls, getPositions]);

    // Handler de drag
    const handleDragEnd = useCallback((event, info) => {
        const threshold = 150;
        const velocityThreshold = 500;
        const positions = getPositions(isMobile);

        // Tras el gesto disparamos SIEMPRE `controls.start(...)` explícitamente (no solo
        // el setState → effect): el arrastre deja `y` en un número arbitrario y hay que
        // reconducirlo a la posición destino en el propio handler. Antes se confiaba en
        // el effect y el reposicionado no era fiable → la sábana se quedaba en negro.
        if (info.offset.y < -threshold || info.velocity.y < -velocityThreshold) {
            // Arrastre hacia arriba → abrir
            setIsFullScreenOpen(true);
            controls.start(positions.expanded);
        } else if (info.offset.y > threshold || info.velocity.y > velocityThreshold) {
            // Arrastre hacia abajo → cerrar
            setIsFullScreenOpen(false);
            controls.start(positions.collapsed);
        } else {
            // No supera umbral → vuelve al estado actual
            controls.start(isFullScreenOpen ? positions.expanded : positions.collapsed);
        }
    }, [isMobile, isFullScreenOpen, setIsFullScreenOpen, controls, getPositions]);

    if (!currentSong) return null;

    const initialPositions = getPositions(isMobile);

    return ReactDOM.createPortal(
        <motion.div
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            // Sin dragConstraints: su snap-back al origen (y:0) competía con
            // `controls.start(collapsed)` y ganaba, dejando la sábana expandida
            // (pantalla negra) al soltar. Ahora la posición la fija SIEMPRE `controls`
            // en onDragEnd. `dragMomentum={false}` evita que el impulso siga tras soltar.
            dragMomentum={false}
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
                // El gesto de arrastre es solo móvil: en desktop, arrastrar con el
                // ratón sobre la letra/cola movía la sábana entera (ahí se abre/cierra
                // con click en la barra o el chevron).
                if (!isMobile) return;
                const target = e.target;
                const isInteractive = target.closest('button, input, a, [role="button"], .progress-bar, .volume-slider');

                if (!isInteractive) {
                    dragControls.start(e);
                }
            }}
        >
            {/* CONTENIDO */}
            <div className="w-full h-full relative flex flex-col bg-background">

                {/* MINI PLAYER (Visible cuando colapsado) */}
                {/* En móvil la sábana mide siempre 100dvh (solo se traslada), así que
                    la mini barra necesita altura fija de 64px, no h-full. */}
                <motion.div
                    className="absolute top-0 left-0 right-0 z-20"
                    style={{ height: isMobile ? '64px' : '100%' }}
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