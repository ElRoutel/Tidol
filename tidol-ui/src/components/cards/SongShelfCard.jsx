import React from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { useContextMenu } from '../../context/ContextMenuContext';
import { FaPlay, FaEllipsisH } from 'react-icons/fa';
import '../../styles/cards.css';

/**
 * Tarjeta vertical para mostrar una canción en un carrusel(Shelf).
 * Muestra portada, título, artista y un botón de play al hacer hover.
 * Integra con el ContextMenu global mediante la clase 'song-item' y data attributes.
 */
export default function SongShelfCard({ song, onPlay }) {
  const { openContextMenu } = useContextMenu();
  if (!song) return null;

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
      className="song-shelf-card glass-card song-item"
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
      <div className="card-cover-container">
        <img
          className="card-cover"
          src={song.portada || '/default_cover.png'}
          alt={song.titulo}
        />
        <div className="card-play-button">
          <FaPlay />
        </div>
        <button
          className="card-menu-button"
          onClick={handleMenuClick}
        >
          <FaEllipsisH />
        </button>
      </div>
      <div className="card-info">
        <h4 className="card-title truncate">
          {song.titulo}
        </h4>
        <p className="card-subtitle truncate">
          {song.artista}
        </p>
      </div>
    </div>
  );
}