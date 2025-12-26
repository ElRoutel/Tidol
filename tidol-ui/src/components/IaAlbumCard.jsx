import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const IaAlbumCard = ({ album }) => {
  const navigate = useNavigate();
  const [displayImage, setDisplayImage] = useState(null);

  if (!album) return null;

  const title = album.titulo || 'Título no disponible';
  const artist = album.artista || 'Artista desconocido';
  const identifier = album.identifier;

  const fallbackImg = identifier
    ? `https://archive.org/services/img/${identifier}`
    : '/default_cover.png';

  const handleClick = () => {
    if (identifier) navigate(`/ia-album/${identifier}`);
  };

  useEffect(() => {
    if (!identifier) {
      setDisplayImage('/default_cover.png');
      return;
    }

    // Intento de portada HD
    const hdUrl = `https://archive.org/download/${identifier}/__ia_thumb.jpg`;

    const img = new Image();
    img.src = hdUrl;
    img.onload = () => {
      // Si la imagen es demasiado pequeña → es espectrograma
      if (img.width < 200 || img.height < 200) {
        setDisplayImage(fallbackImg);
      } else {
        setDisplayImage(hdUrl);
      }
    };

    img.onerror = () => setDisplayImage(fallbackImg);
  }, [identifier]);

  return (
    <div onClick={handleClick} className="block album-card flex-shrink-0 cursor-pointer">
      <div className="glass-card rounded-lg p-3 transition-all duration-300 h-full shadow-lg">
        <img
          src={displayImage || fallbackImg}
          alt={title}
          className="album-cover mb-4 shadow-md"
          loading="lazy"
        />
        <h3 className="font-semibold text-text truncate">{title}</h3>
        <p className="text-sm text-text-subdued truncate">
          {artist}
        </p>
      </div>
    </div>
  );
};

export default IaAlbumCard;
