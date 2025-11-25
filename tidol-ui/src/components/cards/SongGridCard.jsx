import React from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { useContextMenu } from '../../context/ContextMenuContext';
import { FaPlay, FaPause, FaEllipsisH } from 'react-icons/fa';
import '../../styles/cards.css';

/**
 * Tarjeta horizontal para mostrar una canción en una cuadrícula (Grid).
 * Muestra portada, info y un indicador de reproducción.
 * Integra con el ContextMenu global mediante la clase 'song-item' y data attributes.
 */
export default React.memo(function SongGridCard({ song, onPlay }) {
  const { currentSong, isPlaying: isPlayerActive } = usePlayer();
  const { openContextMenu } = useContextMenu();
  const isThisSongCurrent = currentSong?.id === song.id || currentSong?.identifier === song.identifier;
  const isPlaying = isThisSongCurrent && isPlayerActive;

  const handleMenuClick = (e) => {
    e.stopPropagation();
    // Prepare data object similar to dataset
    const data = {
      id: song.id || song.identifier,
      titulo: song.titulo || song.title,
      artista: song.artista || song.artist,
      album: song.album || song.album_name,
      portada: song.portada || song.cover_url,
      url: song.url,
      duracion: song.duracion || song.duration,
      artistId: song.artistId || song.artista_id,
      albumId: song.albumId || song.album_id,
      format: song.format,
      quality: song.quality
    };
    openContextMenu(e, 'song', data);
  };

  return (
    <div
      className={`song-grid-card glass-card song-item ${isPlaying ? 'playing' : ''}`}
      onClick={onPlay}
      data-id={song.id || song.identifier}
      data-title={song.titulo || song.title}
      data-artist={song.artista || song.artist}
      data-album={song.album || song.album_name}
      data-cover={song.portada || song.cover_url}
      data-url={song.url}
      data-duration={song.duracion || song.duration}
      data-artist-id={song.artistId || song.artista_id}
      data-album-id={song.albumId || song.album_id}
      data-format={song.format}
      data-quality={song.quality}
    >
      <img
        className="song-grid-cover"
        src={song.portada || '/default_cover.png'}
        alt={song.titulo}
        loading="lazy"
      />

      <div className="song-grid-info">
        <h4 className="truncate">{song.titulo}</h4>
        <p className="truncate">{song.artista}</p>
      </div>

      <div className="song-grid-actions">
        <button
          className="song-grid-menu-btn"
          onClick={handleMenuClick}
        >
          <FaEllipsisH />
        </button>

        <div className="song-grid-play-icon">
          {isPlaying ? (
            <FaPause size={14} className="text-primary" />
          ) : (
            <FaPlay size={14} />
          )}
        </div>
      </div>
    </div >
  );
});