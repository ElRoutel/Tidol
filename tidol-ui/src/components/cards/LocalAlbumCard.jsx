import React from 'react';
import '../../styles/glass.css';

export default function LocalAlbumCard({ album, onClick }) {
  return (
    <div className="glass-card album-card cursor-pointer" onClick={onClick}>
      <img className="album-cover" src={album.portada || '/default_cover.png'} alt={album.titulo} />
      <h3 className="truncate font-semibold">{album.titulo}</h3>
      <p className="truncate text-sm text-text-subdued">{album.autor}</p>
    </div>
  );
}