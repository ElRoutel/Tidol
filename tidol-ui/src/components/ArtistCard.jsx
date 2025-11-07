// src/components/ArtistCard.jsx
import { Link } from 'react-router-dom';

export default function ArtistCard({ artist }) {
  return (
    <Link to={`/artist/${artist.id}`} className="block w-48 flex-shrink-0 group">
      <div className="bg-surface hover:bg-interactive-bg transition-colors duration-300 rounded-lg p-4 text-center">
        <img 
          src={artist.foto || '/default_artist.png'} 
          alt={`Photo of ${artist.nombre}`}
          className="w-32 h-32 object-cover rounded-full mx-auto mb-4 shadow-lg"
        />
        <h3 className="font-semibold text-text truncate">{artist.nombre}</h3>
        <p className="text-sm text-text-subdued">Artista</p>
      </div>
    </Link>
  );
}
