import React from 'react';
import './Card.css';

export default function LocalAlbumCard({ album, onClick }) {
  return (
    <div className="card-container" onClick={onClick}>
      <img src={album.portada || '/default_cover.png'} alt={album.titulo} />
      <h3>{album.titulo}</h3>
      <p>{album.autor}</p>
    </div>
  );
}