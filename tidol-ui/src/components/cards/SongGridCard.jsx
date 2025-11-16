import React from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { FaPlay, FaPause } from 'react-icons/fa';
import '../../styles/cards.css'; // Usaremos el CSS de tarjetas existente

/**
 * Tarjeta horizontal para mostrar una canción en una cuadrícula (Grid).
 * Muestra portada, info y un indicador de reproducción.
 */
export default function SongGridCard({ song, onPlay }) {
  const { currentSong } = usePlayer();
  const isPlaying = currentSong?.id === song.id || currentSong?.identifier === song.identifier;

  return (
    <div 
      className={`song-grid-card glass-card ${isPlaying ? 'playing' : ''}`} 
      onClick={onPlay}
    >
      <img 
        className="song-grid-cover" 
        src={song.portada || '/default_cover.png'} 
        alt={song.titulo} 
      />
      
      <div className="song-grid-info">
        <h4 className="truncate">{song.titulo}</h4>
        <p className="truncate">{song.artista}</p>
      </div>

      <div className="song-grid-play-icon">
        {isPlaying ? (
          <FaPause size={14} className="text-primary" />
        ) : (
          <FaPlay size={14} />
        )}
      </div>
    </div>
  );
}