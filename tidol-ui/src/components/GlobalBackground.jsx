import React, { useEffect, useState } from 'react';
import { usePlayer } from '../context/PlayerContext';

export default function GlobalBackground() {
  const { currentSong, isPlaying } = usePlayer();
  const [activeCover, setActiveCover] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (currentSong?.portada) {
      setActiveCover(currentSong.portada);
      setIsVisible(true);
    } else {
      // Opcional: Si se detiene la música o no hay canción, puedes ocultarlo
      // setIsVisible(false); 
    }
  }, [currentSong]);

  // Si no hay portada cargada aún, no renderizamos nada
  if (!activeCover) return null;

  return (
    <div className={`global-bg-wrapper ${isVisible ? 'visible' : ''}`}>
      
      {/* Capa de Imagen Difuminada */}
      <div 
        className="global-bg-image"
        style={{ 
          backgroundImage: `url(${activeCover})`,
          // Si está en pausa, oscurecemos un poco más el fondo para dar efecto "dim"
          opacity: isPlaying ? 1 : 0.8 
        }} 
      />

      {/* Capa de Oscurecimiento (Vignette + Overlay) */}
      {/* Esto asegura que el texto blanco de la app siempre se lea */}
      <div className="global-bg-overlay" />

      <style jsx>{`
        .global-bg-wrapper {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          z-index: -10; /* Detrás de todo (App, Sidebar, etc) */
          pointer-events: none; /* Click-through */
          background-color: #000; /* Fondo negro base para evitar parpadeos */
          opacity: 0;
          transition: opacity 1s ease;
        }

        .global-bg-wrapper.visible {
          opacity: 1;
        }

        .global-bg-image {
          position: absolute;
          inset: 0;
          background-size: cover;
          background-position: center;
          /* LA MAGIA: Blur alto + Saturación alta + Brillo bajo */
          filter: blur(80px) saturate(1.8) brightness(0.4);
          transform: scale(1.2); /* Escalar para evitar bordes blancos por el blur */
          transition: background-image 1s ease-in-out, opacity 0.5s ease;
        }

        .global-bg-overlay {
          position: absolute;
          inset: 0;
          /* Gradiente sutil: más oscuro abajo y a la izquierda (donde suele estar el texto) */
          background: radial-gradient(
            circle at 50% 30%, 
            rgba(0,0,0,0.2) 0%, 
            rgba(0,0,0,0.6) 50%, 
            rgba(0,0,0,0.9) 100%
          );
          z-index: 1;
        }
      `}</style>
    </div>
  );
}