import React, { useState, useEffect } from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { usePlaylist } from '../../context/PlaylistContext';
import { useNavigate } from 'react-router-dom';
import { FaPlay, FaPause } from 'react-icons/fa';
import SongContextMenu from './SongContextMenu';
import '../../styles/glass.css';

/**
 * Tarjeta de canción local
 * - Clic izquierdo => reproduce
 * - Clic derecho => menú contextual (OOF, como TIDAL)
 */
export default function LocalSongCard({ song, onPlay }) {
  const { currentSong, isSongLiked } = usePlayer();
  const navigate = useNavigate();
  const isPlaying = currentSong?.id === song.id;

  const [menu, setMenu] = useState(null);

  const handleContextMenu = (e) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, song });
  };

  // cerrar si haces click afuera
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menu]);

  return (
    <>
      <div
        className={`song-card-local glass-card ${isPlaying ? 'playing' : ''}`}
        onClick={onPlay}
        onContextMenu={handleContextMenu}
      >
        <img
          className="song-cover"
          src={song.portada || '/default_cover.png'}
          alt={song.titulo}
        />

        <div className="song-card-info">
          <h4 className="truncate">{song.titulo}</h4>
          <p className="truncate">
            {song.artista} {song.album ? `• ${song.album}` : ''}
          </p>
        </div>

        <span className="song-play-icon">
          {isPlaying ? (
            <FaPause size={14} className="text-primary" />
          ) : (
            <FaPlay size={14} />
          )}
        </span>
      </div>

      {menu && (
        <SongContextMenu
          x={menu.x}
          y={menu.y}
          song={menu.song}
          onClose={() => setMenu(null)}
        />
      )}
    </>
  );
}
