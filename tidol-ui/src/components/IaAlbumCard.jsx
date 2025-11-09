import React from 'react';
import { useNavigate } from 'react-router-dom';

const IaAlbumCard = ({ album }) => {
  const navigate = useNavigate();

  if (!album) return null;

  // Datos principales del álbum
  const title = album.metadata?.title || album.title || 'Título no disponible';
  const artist = album.metadata?.creator || album.creator || 'Artista desconocido';
  const identifier = album.identifier;

  // --- URL de portada de alta calidad ---
  // Intentamos usar portada de alta calidad si existe, si no usamos fallback
  const imageUrl = album.portada 
    || (identifier 
        ? `https://ia800608.us.archive.org/0/items/${identifier}/download.jpeg?cnt=0`
        : '/default_cover.png');

  const handleClick = () => {
    if (identifier) navigate(`/ia-album/${identifier}`);
  };

  return (
    <div onClick={handleClick} className="block w-48 flex-shrink-0 cursor-pointer">
      <div className="bg-surface rounded-lg p-4 transition-all duration-300 hover:bg-interactive-bg h-full shadow-lg">
        <img
          src={imageUrl}
          alt={title}
          className="w-full h-40 object-cover rounded-md mb-4 shadow-md"
        />
        <h3 className="font-semibold text-text truncate">{title}</h3>
        <p className="text-sm text-text-subdued truncate">{artist}</p>
      </div>
    </div>
  );
};

export default IaAlbumCard;
