// src/components/LocalSongCard.jsx
import React, { useState } from 'react'; 
import { usePlayer } from '../context/PlayerContext';

// Mini ContextMenu interno
function ContextMenu({ position, onClose }) {
  return (
    <div
      className="fixed bg-gray-800 text-white rounded shadow-lg z-50"
      style={{ top: position.y, left: position.x, minWidth: '150px' }}
      onClick={onClose} // cierra al hacer click en cualquier opción
    >
      <ul className="p-2">
        <li className="hover:bg-gray-700 cursor-pointer p-1">Reproducir</li>
        <li className="hover:bg-gray-700 cursor-pointer p-1">Agregar a la cola</li>
        <li className="hover:bg-gray-700 cursor-pointer p-1">Agregar a favoritos</li>
        <li className="hover:bg-gray-700 cursor-pointer p-1">Ir al artista</li>
        <li className="hover:bg-gray-700 cursor-pointer p-1">Ir al álbum</li>
      </ul>
    </div>
  );
}

export default function LocalSongCard({ song, onPlay }) {
  const { currentSong } = usePlayer();
  const isPlaying = currentSong?.id === song.id;

  const [contextPos, setContextPos] = useState(null);

  const handleContextMenu = (e) => {
    e.preventDefault();
    setContextPos({ x: e.pageX, y: e.pageY });
  };

  const handleCloseMenu = () => setContextPos(null);

  return (
    <>
      <div 
        className={`song-card-local ${isPlaying ? 'playing' : ''}`} 
        onClick={onPlay}
        onContextMenu={handleContextMenu} // click derecho
      >
        <img src={song.portada || '/default_cover.png'} alt={song.titulo} />
        <div style={{flex: 1}}>
          <h4>{song.titulo}</h4>
          <p>{song.artista} - {song.album}</p>
        </div>
        <span style={{fontSize: 18, color: 'var(--primary)'}}>{isPlaying ? '⏸' : '▶'}</span>
      </div>

      {contextPos && <ContextMenu position={contextPos} onClose={handleCloseMenu} />}
    </>
  );
}
