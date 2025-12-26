javascript
import React, { useRef } from 'react';
import { useContextMenu } from '../../context/ContextMenuContext';

export default function SongShelfCard({ song, onClick, onPlay }) {
  const { openContextMenu } = useContextMenu(); // Changed from showContextMenu
  const cardRef = useRef(null);

  if (!song) return null;

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  showContextMenu(e, menuData, 'song');
};

return (
  <div
    ref={cardRef}
    className="group relative flex flex-col w-[160px] md:w-[180px] p-3 rounded-2xl bg-[#181818] hover:bg-[#282828] transition-all duration-300 ease-apple cursor-pointer hover:-translate-y-1 hover:shadow-lg"
    onClick={onClick}
    onContextMenu={handleContextMenu}
  >
    {/* Portada con sombra y squircle */}
    <div className="relative aspect-square w-full mb-3 shadow-lg rounded-xl overflow-hidden bg-white/5">
      <img
        src={song.coverThumb || song.portada || '/default_cover.png'}
        alt={song.titulo || song.title}
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        loading="lazy"
        decoding="async"
      />

      {/* Botón de Play Flotante (Glow Shadow) */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onPlay && onPlay(song);
        }}
        className="absolute bottom-2 right-2 w-10 h-10 bg-[#1db954] rounded-full flex items-center justify-center text-black shadow-xl translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 hover:scale-105 hover:bg-[#1ed760] z-10"
        style={{ boxShadow: '0 8px 16px rgba(0,0,0,0.3)' }}
      >
        <svg className="w-5 h-5 ml-1" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      </button>
    </div>

    {/* Info con Tipografía Premium */}
    <div className="flex flex-col gap-0.5 min-h-[50px]">
      <h3 className="font-bold text-[14px] text-white truncate leading-tight tracking-tight" title={song.titulo || song.title}>
        {song.titulo || song.title}
      </h3>
      <p className="text-[12px] text-white/60 truncate font-medium" title={song.artista || song.artist}>
        {song.artista || song.artist || 'Desconocido'}
      </p>
    </div>
  </div>
);
