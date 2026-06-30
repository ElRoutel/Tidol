import React from 'react';
import './Card.css';

export default function LocalArtistCard({ artist, onClick }) {
  return (
    <div className="card-container" onClick={onClick}>
      <img src={artist.imagen || '/default_cover.png'} alt={artist.nombre} />
      <h3>{artist.nombre}</h3>
      <p>Artista</p>
    </div>
  );
}