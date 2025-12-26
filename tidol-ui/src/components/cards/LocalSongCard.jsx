import React from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { useContextMenu } from '../../context/ContextMenuContext';
import { FaPlay, FaPause, FaEllipsisH } from 'react-icons/fa';
import '../../styles/glass.css';
import '../../styles/cards.css';

/**
 * Tarjeta de canción local
 * - Clic izquierdo => reproduce
 * - Clic derecho => menú contextual global
 */
export default function LocalSongCard({ song, onPlay }) {
  const { currentSong } = usePlayer();
  const { openContextMenu } = useContextMenu();
  const isPlaying = currentSong?.id === song.id;

  const handleMenuClick = (e) => {
    e.stopPropagation();
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
      className={`song-card-local glass-card song-item ${isPlaying ? 'playing' : ''}`}
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

      <div className="flex items-center gap-2">
        <button
          className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          onClick={handleMenuClick}
        >
          <FaEllipsisH size={14} />
        </button>

        <span className="song-play-icon">
          {isPlaying ? (
            <FaPause size={14} className="text-primary" />
          ) : (
            <FaPlay size={14} />
          )}
        </span>
      </div>
    </div>
  );
}
