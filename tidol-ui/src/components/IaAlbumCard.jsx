import React from 'react';
import { useNavigate } from 'react-router-dom';

const IaAlbumCard = ({ album }) => {
  const navigate = useNavigate();

  // 1. Si la prop 'album' no ha llegado, no renderizamos nada.
  if (!album) {
    return null; 
  }

  // 2. --- ¡ESTA ES LA CORRECCIÓN CLAVE! ---
  //    La API de IA casi siempre anida los datos en 'metadata'.
  //    Usamos '?' (optional chaining) por si 'metadata' no existe.
  const title = album.metadata?.title || album.title || 'Título no disponible';
  const artist = album.metadata?.creator || album.creator || 'Artista desconocido';
  
  // 3. El 'identifier' SÍ parece estar en el nivel superior
  //    (lo sabemos por cómo lo usaste en la 'key' en SearchPage).
  const identifier = album.identifier;

  // 4. Construimos la URL de la portada usando el 'identifier'.
  const imageUrl = identifier 
    ? `https://archive.org/services/get-item-image.php?identifier=${identifier}`
    : '/default_cover.png'; // Usamos un fallback si no hay identifier

  
  const handleClick = () => {
    if (identifier) {
      // Te he añadido la navegación a una futura página de detalles
      navigate(`/ia-album/${identifier}`);
    }
  };

  return (
    // 'w-48' (ancho fijo) y 'flex-shrink-0' son claves para que 
    // funcione bien dentro del scroll horizontal del Shelf.
    <div onClick={handleClick} className="block w-48 flex-shrink-0 cursor-pointer">
      <div className="bg-surface rounded-lg p-4 transition-all duration-300 hover:bg-interactive-bg h-full shadow-lg">
        
        <img
          src={imageUrl} // <-- 5. Usamos la URL que construimos
          alt={title}
          className="w-full h-40 object-cover rounded-md mb-4 shadow-md"
        />
        
        {/* 6. Mostramos los datos que encontramos */}
        <h3 className="font-semibold text-text truncate">{title}</h3>
        <p className="text-sm text-text-subdued truncate">{artist}</p>
      
      </div>
    </div>
  );
};

export default IaAlbumCard;