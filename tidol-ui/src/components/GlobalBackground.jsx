// src/components/GlobalBackground.jsx
import React from 'react';
import { usePlayer } from '../context/PlayerContext';

const GlobalBackground = () => {
  const { currentSong } = usePlayer();

  // Usamos una clave que cambia con la URL de la imagen para forzar a React a
  // renderizar un nuevo div y activar la transición de CSS.
  const imageKey = currentSong?.cover || 'no-song';

  return (
    <div
      key={imageKey}
      style={{
        position: 'fixed',
        width: '100vw',
        height: '100vh',
        top: 0,
        left: 0,
        zIndex: -1, // Detrás de todo el contenido
        backgroundColor: '#000', // Fondo negro si no hay canción
        backgroundImage: currentSong ? `url(${currentSong.cover})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        // Filtros para crear la atmósfera deseada
        filter: 'blur(90px) brightness(0.5) saturate(1.5)',
        // Transición suave para el cambio de imagen
        transition: 'background-image 1.5s ease-in-out',
        // Opacidad para la transición de entrada/salida
        opacity: currentSong ? 1 : 0,
      }}
      aria-hidden="true" // Es un elemento decorativo
    />
  );
};

export default GlobalBackground;
