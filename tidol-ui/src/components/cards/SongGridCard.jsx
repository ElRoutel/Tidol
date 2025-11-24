import React, { useState } from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { usePlaylist } from '../../context/PlaylistContext';
import { useNavigate } from 'react-router-dom';
import { FaPlay, FaPause } from 'react-icons/fa';
import '../../styles/cards.css';

/**
 * Tarjeta horizontal para mostrar una canción en una cuadrícula (Grid).
 * Muestra portada, info y un indicador de reproducción.
 */
export default function SongGridCard({ song, onPlay }) {
  const { currentSong, isPlaying: isPlayerActive, addToQueue, playNext, toggleLike, isSongLiked } = usePlayer();
  const { openAddToPlaylistModal } = usePlaylist();
  const navigate = useNavigate();
  const isThisSongCurrent = currentSong?.id === song.id || currentSong?.identifier === song.identifier;
  const isPlaying = isThisSongCurrent && isPlayerActive;
  const isLiked = isSongLiked(song.id || song.identifier);

  const [contextMenu, setContextMenu] = useState(null);

  const handleContextMenu = (e) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleAction = (action) => {
    switch (action) {
      case 'queue':
        addToQueue(song);
        break;
      case 'next':
        playNext(song);
        break;
      case 'like':
        toggleLike(song.id || song.identifier, song);
        break;
      case 'playlist':
        openAddToPlaylistModal(song);
        break;
      case 'artist':
        if (song.artistId || song.artista_id) {
          navigate(`/artist/${song.artistId || song.artista_id}`);
        }
        break;
      case 'album':
        if (song.albumId || song.album_id) {
          navigate(`/album/${song.albumId || song.album_id}`);
        }
        break;
    }
    setContextMenu(null);
  };

  React.useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu]);

  return (
    <>
      <div
        className={`song-grid-card glass-card ${isPlaying ? 'playing' : ''}`}
        onClick={onPlay}
        onContextMenu={handleContextMenu}
      >
        <img
          className="song-grid-cover"
          src={song.portada || '/default_cover.png'}
          alt={song.titulo}
        />

        <div className="song-grid-info">
          <h4 className="truncate">{song.titulo}</h4>
          <p className="truncate">{song.artista}</p>
        </div>

        <div className="song-grid-play-icon">
          {isPlaying ? (
            <FaPause size={14} className="text-primary" />
          ) : (
            <FaPlay size={14} />
          )}
        </div>
      </div>

      {contextMenu && (
        <div
          className="fixed bg-[#2a2a2a] rounded-lg shadow-2xl border border-white/10 py-2 min-w-[200px] z-[9999]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-4 py-2 text-left text-white hover:bg-white/10 transition-colors"
            onClick={() => handleAction('next')}
          >
            Reproducir siguiente
          </button>
          <button
            className="w-full px-4 py-2 text-left text-white hover:bg-white/10 transition-colors"
            onClick={() => handleAction('queue')}
          >
            Agregar a cola
          </button>
          <button
            className="w-full px-4 py-2 text-left text-white hover:bg-white/10 transition-colors"
            onClick={() => handleAction('like')}
          >
            {isLiked ? 'Quitar de favoritos' : 'Agregar a favoritos'}
          </button>
          <button
            className="w-full px-4 py-2 text-left text-white hover:bg-white/10 transition-colors"
            onClick={() => handleAction('playlist')}
          >
            Agregar a playlist
          </button>
          <div className="h-px bg-white/10 my-1"></div>
          {(song.artistId || song.artista_id) && (
            <button
              className="w-full px-4 py-2 text-left text-white hover:bg-white/10 transition-colors"
              onClick={() => handleAction('artist')}
            >
              Ir al artista
            </button>
          )}
          {(song.albumId || song.album_id) && (
            <button
              className="w-full px-4 py-2 text-left text-white hover:bg-white/10 transition-colors"
              onClick={() => handleAction('album')}
            >
              Ir al álbum
            </button>
          )}
        </div>
      )}
    </>
  );
}