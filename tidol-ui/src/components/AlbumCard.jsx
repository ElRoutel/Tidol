import React from 'react';
import { Link } from 'react-router-dom';

const AlbumCard = ({ album }) => {
  return (
    <Link to={`/album/${album.id}`} className="block w-48 flex-shrink-0">
      <div className="bg-neutral-800 rounded-lg p-4 transition-colors hover:bg-neutral-700 h-full">
        <img
          src={album.imageUrl}
          alt={album.title}
          className="w-full h-40 object-cover rounded-md mb-4"
        />
        <h3 className="font-semibold text-white truncate">{album.title}</h3>
        <p className="text-sm text-neutral-400 truncate">{album.artist}</p>
      </div>
    </Link>
  );
};

export default AlbumCard;