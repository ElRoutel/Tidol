import React from 'react';
import { FaPlay } from 'react-icons/fa';
import '../../styles/cards.css'; // Crearemos este archivo a continuación

/**
 * Tarjeta vertical para mostrar una canción en un carrusel (Shelf).
 * Muestra portada, título, artista y un botón de play al hacer hover.
 */
export default function SongShelfCard({ song, onPlay }) {
  if (!song) return null;

  return (
    <div 
      className="song-shelf-card glass-card"
      onClick={onPlay}
    >
      <div className="card-cover-container">
        <img 
          className="card-cover" 
          src={song.portada || '/default_cover.png'} 
          alt={song.titulo} 
        />
        <div className="card-play-button">
          <FaPlay />
        </div>
      </div>
      <div className="card-info">
        <h4 className="card-title truncate">
          {song.titulo}
        </h4>
        <p className="card-subtitle truncate">
          {song.artista}
        </p>
      </div>
    </div>
  );
}