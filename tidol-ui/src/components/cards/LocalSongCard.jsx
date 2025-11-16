import React, { useState }  from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { FaPlay, FaPause } from 'react-icons/fa';
import '../../styles/glass.css';

// --- Mini ContextMenu interno ---
function ContextMenu({ position, onClose }) {
  return (
    <div
      className="context-menu glass-card fixed text-white rounded shadow-lg z-50"
      style={{ top: position.y, left: position.x }}
      onClick={onClose} // Cierra al hacer click en cualquier opción
    >
      <ul>
        <li className="context-menu-item">Reproducir</li>
        <li className="context-menu-item">Agregar a la cola</li>
        <li className="context-menu-item">Agregar a playlist...</li>
        <li className="context-menu-item">Agregar a favoritos</li>
        <li className="context-menu-item-divider"></li>
        <li className="context-menu-item">Ir al artista</li>
        <li className="context-menu-item">Ir al álbum</li>
      </ul>
    </div>
  );
}
// ------------------------------

/**
 * Tarjeta para mostrar una Canción en una lista.
 * Muestra portada, info y un indicador de reproducción.
 * Soporta clic derecho para un menú contextual.
 */
export default function LocalSongCard({ song, onPlay }) {
  const { currentSong } = usePlayer();
  const isPlaying = currentSong?.id === song.id;

  const [contextPos, setContextPos] = useState(null);

  // Abrir menú contextual
  const handleContextMenu = (e) => {
    e.preventDefault();
    setContextPos({ x: e.pageX, y: e.pageY });
  };

  // Cerrar menú contextual
  const handleCloseMenu = () => setContextPos(null);

  // Cerrar menú si se hace clic en cualquier parte de la ventana
  React.useEffect(() => {
    if (contextPos) {
      window.addEventListener('click', handleCloseMenu);
    }
    return () => {
      window.removeEventListener('click', handleCloseMenu);
    };
  }, [contextPos]);

  return (
    <>
      <div 
        className={`song-card-local glass-card ${isPlaying ? 'playing' : ''}`} 
        onClick={onPlay}
        onContextMenu={handleContextMenu} // Clic derecho
      >
        <img className="song-cover" src={song.portada || '/default_cover.png'} alt={song.titulo} />
        
        <div className="song-card-info">
          <h4 className="truncate">{song.titulo}</h4>
          <p className="truncate">{song.artista} {song.album ? `• ${song.album}` : ''}</p>
        </div>

        <span className="song-play-icon">
          {isPlaying ? (
            <FaPause size={14} className="text-primary" />
          ) : (
            <FaPlay size={14} />
          )}
        </span>
      </div>

      {contextPos && <ContextMenu position={contextPos} onClose={handleCloseMenu} />}
    </>
  );
}