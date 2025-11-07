import React from 'react';

const IaAlbumCard = ({ result }) => {
  // Extraemos los datos que necesitamos. Usamos un operador de encadenamiento opcional (?.) 
  // por si alguna propiedad no existiera, y valores por defecto para evitar errores.
  const imageUrl = result.coverUrl || '/default_cover.png'; // Una imagen por defecto
  const title = result.title || 'Título no disponible';
  const artist = result.creator || 'Artista desconocido';

  // Podríamos querer hacer algo cuando se hace clic, como reproducir o ver detalles.
  // Por ahora, solo será visual.
  const handleClick = () => {
    console.log('Clicked on Internet Archive result:', result);
    // Aquí se podría navegar a una página de detalles o iniciar la reproducción.
  };

  return (
    <div onClick={handleClick} className="block w-48 flex-shrink-0 cursor-pointer">
      <div className="bg-neutral-800 rounded-lg p-4 transition-colors hover:bg-neutral-700 h-full">
        <img
          src={imageUrl}
          alt={title}
          className="w-full h-40 object-cover rounded-md mb-4"
        />
        <h3 className="font-semibold text-white truncate">{title}</h3>
        <p className="text-sm text-neutral-400 truncate">{artist}</p>
      </div>
    </div>
  );
};

export default IaAlbumCard;
