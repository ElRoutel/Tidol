import React from 'react';
import '../../styles/glass.css';

/**
 * Tarjeta para mostrar un Álbum o Playlist en una rejilla.
 * Muestra una portada grande con título y autor debajo.
 */
export default function LocalAlbumCard({ album, onClick }) {
  return (
    <div 
      className="glass-card album-card cursor-pointer" 
      onClick={onClick}
      title={`${album.titulo} - ${album.autor}`}
    >
      <img 
        className="album-cover" 
        src={album.portada || '/default_cover.png'} 
        alt={album.titulo} 
      />
      <div className="album-card-info">
        <h3 className="truncate font-semibold">{album.titulo}</h3>
        <p className="truncate text-sm text-text-subdued">{album.autor}</p>
      </div>
    </div>
  );
}