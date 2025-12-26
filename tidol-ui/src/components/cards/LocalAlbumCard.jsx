import React, { useState } from 'react';
import { IoEllipsisVertical } from 'react-icons/io5';
import '../../styles/glass.css';

/**
 * Tarjeta para mostrar un Álbum o Playlist en una rejilla.
 * Muestra una portada grande con título y autor debajo.
 */
export default function LocalAlbumCard({ album, onClick, onMenuAction }) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });

  const handleMenuClick = (e) => {
    e.stopPropagation(); // Evitar que se dispare el onClick del card
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPosition({
      x: rect.left,
      y: rect.bottom + 5
    });
    setShowMenu(!showMenu);
  };

  const handleMenuItemClick = (action) => {
    setShowMenu(false);
    if (onMenuAction) {
      onMenuAction(action, album);
    }
  };

  const handleClickOutside = () => {
    setShowMenu(false);
  };

  React.useEffect(() => {
    if (showMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showMenu]);

  const menuOptions = [
    { label: 'Reproducir todo', action: 'playAlbum' },
    { label: 'Agregar a cola', action: 'addToQueue' },
    { label: 'Agregar a favoritos', action: 'addFavorite' },
    { label: 'Agregar a playlist', action: 'addToPlaylist' },
    { label: 'Ir al artista', action: 'goArtist' },
    { label: 'Ver información', action: 'showInfo' }
  ];

  return (
    <>
      <div
        className="glass-card album-card cursor-pointer album-item"
        onClick={onClick}
        title={`${album.titulo} - ${album.autor}`}
        data-id={album.id}
        data-titulo={album.titulo}
        data-autor={album.autor}
        data-portada={album.portada}
      >
        {/* Botón de menú flotante en la esquina superior derecha */}
        <button
          className="album-card-menu-btn"
          onClick={handleMenuClick}
          aria-label="Más opciones"
        >
          <IoEllipsisVertical size={20} />
        </button>

        <img
          className="album-cover"
          src={album.portada || '/default_cover.png'}
          alt={album.titulo}
        />
        <div className="album-card-info">
          <h3 className="truncate font-semibold">{album.titulo}</h3>
          <p className="truncate text-sm text-text-subdued">{album.autor}</p>
        </div>
      </div>

      {/* Menú contextual */}
      {showMenu && (
        <div
          className="album-card-context-menu glass-card"
          style={{
            position: 'fixed',
            top: `${menuPosition.y}px`,
            left: `${menuPosition.x}px`,
            zIndex: 10000
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <ul className="album-card-menu-list">
            {menuOptions.map((option) => (
              <li
                key={option.action}
                className="album-card-menu-item"
                onClick={() => handleMenuItemClick(option.action)}
              >
                {option.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}