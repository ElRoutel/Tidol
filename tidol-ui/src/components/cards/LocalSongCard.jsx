// src/components/cards/LocalSongCard.jsx
import React, { useState } from 'react';
import { usePlayer } from '../../context/PlayerContext';
import '../../styles/glass.css';

// Mini ContextMenu interno
function ContextMenu({ position, onClose }) {
  return (
    <div
      className="context-menu glass-card fixed text-white rounded shadow-lg z-50"
      style={{ top: position.y, left: position.x, minWidth: '150px' }}
      onClick={onClose} // cierra al hacer click en cualquier opción
    >
      <ul>
        <li className="cursor-pointer">Reproducir</li>
        <li className="cursor-pointer">Agregar a la cola</li>
        <li className="cursor-pointer">Agregar a favoritos</li>
        <li className="cursor-pointer">Ir al artista</li>
        <li className="cursor-pointer">Ir al álbum</li>
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
        className={`song-card-local glass-card ${isPlaying ? 'playing' : ''}`} 
        onClick={onPlay}
        onContextMenu={handleContextMenu} // click derecho
      >
        <img className="song-cover" src={song.portada || '/default_cover.png'} alt={song.titulo} />
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
