// src/components/AlbumCard.jsx
import { Link } from 'react-router-dom';
import { IoPlay } from "react-icons/io5";

const AlbumCard = ({ album }) => {
  return (
    <Link to={`/album/${album.id}`} className="block w-48 flex-shrink-0 group">
      <div className="bg-surface hover:bg-interactive-bg transition-colors duration-300 rounded-lg p-4 h-full">
        
        <div className="relative w-full mb-4">
          <img
            src={album.portada}
            alt={album.titulo}
            className="w-full h-40 object-cover rounded-md mb-4"
          />
          
          {/* Overlay and Play Button */}
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 
                          flex items-center justify-center transition-all duration-300">
            <button className="w-14 h-14 bg-primary rounded-full text-black flex items-center justify-center
                             opacity-0 group-hover:opacity-100 transform scale-90 group-hover:scale-100
                             transition-all duration-300 hover:scale-110">
              <IoPlay size={28} className="ml-1"/>
            </button>
          </div>
        </div>

        <h3 className="font-semibold text-text truncate">{album.titulo}</h3>
        <p className="text-sm text-text-subdued truncate">{album.autor}</p>
      </div>
    </Link>
  );
};

export default AlbumCard;