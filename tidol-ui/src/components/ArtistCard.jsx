// src/components/ArtistCard.jsx
import { Link } from 'react-router-dom';
import { IoPlay } from "react-icons/io5";
import { getOptimizedImageUrl } from '../utils/imageUtils';

export default function ArtistCard({ artist }) {
  return (
    <Link to={`/artist/${artist.id}`} className="block w-48 flex-shrink-0 group">
      <div className="glass-card rounded-lg p-3 text-center transition-colors duration-200">

        <div className="relative w-32 h-32 mx-auto mb-4">
          <img
            src={getOptimizedImageUrl(artist.foto || '/default_artist.png', 300)}
            alt={`Photo of ${artist.nombre}`}
            className="w-full h-full object-cover rounded-full shadow-lg"
          />

          {/* Overlay and Play Button */}
          <div className="absolute inset-0 bg-black bg-opacity-0 rounded-full group-hover:bg-opacity-40 
                          flex items-center justify-center transition-all duration-300">
            <button className="w-12 h-12 bg-primary rounded-full text-black flex items-center justify-center
                             opacity-0 group-hover:opacity-100 transform scale-90 group-hover:scale-100
                             transition-all duration-300 hover:scale-110">
              <IoPlay size={24} className="ml-1" />
            </button>
          </div>
        </div>

        <h3 className="font-semibold text-text truncate">{artist.nombre}</h3>
        <p className="text-sm text-text-subdued">Artista</p>
      </div>
    </Link>
  );
}
