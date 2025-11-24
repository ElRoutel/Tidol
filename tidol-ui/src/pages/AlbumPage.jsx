import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import api from '../api/axiosConfig';
import { usePlayer } from '../context/PlayerContext';
import { IoPlaySharp, IoPauseSharp, IoShuffle, IoEllipsisHorizontal, IoEllipsisVertical } from 'react-icons/io5';
import LikeButton from '../components/LikeButton';
import './ImmersiveLayout.css';

export default function AlbumPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const songId = searchParams.get('song');

  const [album, setAlbum] = useState(null);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [likedSongs, setLikedSongs] = useState(new Set());

  // Estado para el menú contextual
  const [activeMenu, setActiveMenu] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });

  const { playSongList, currentSong } = usePlayer();
  const [totalDuration, setTotalDuration] = useState(0);

  useEffect(() => {
    const fetchAlbum = async () => {
      try {
        setLoading(true);

        // 1. Cargar Likes
        try {
          const likedRes = await api.get('/music/songs/likes');
          if (likedRes.data) setLikedSongs(new Set(likedRes.data.map(s => s.id)));
        } catch (e) { console.log("No logueado o error likes"); }

        // 2. Datos del Álbum
        const albumRes = await api.get(`/music/albums/${id}`);
        setAlbum(albumRes.data);

        // 3. Canciones
        const songsRes = await api.get(`/music/albums/${id}/songs`);
        setSongs(songsRes.data);

        const total = songsRes.data.reduce((acc, curr) => acc + (curr.duracion || 0), 0);
        setTotalDuration(total);

        if (songId && songsRes.data.length > 0) {
          const songIndex = songsRes.data.findIndex(s => s.id == songId);
          if (songIndex !== -1) playSongList(songsRes.data, songIndex);
        }

        setLoading(false);
      } catch (err) {
        console.error('Error cargando álbum:', err);
        setError('No se pudo cargar el álbum');
        setLoading(false);
      }
    };

    if (id) fetchAlbum();
  }, [id, songId]);

  // Cerrar menú al hacer click fuera
  useEffect(() => {
    const handleClickOutside = () => setActiveMenu(null);
    if (activeMenu !== null) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [activeMenu]);

  const handleSongClick = (index) => {
    playSongList(songs, index);
  };

  const handleLikeToggle = (songId, isLiked) => {
    setLikedSongs(prev => {
      const newSet = new Set(prev);
      isLiked ? newSet.add(songId) : newSet.delete(songId);
      return newSet;
    });
  };

  const handleMenuClick = (e, songIndex) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPosition({
      x: rect.left - 150, // Posicionar menú a la izquierda del botón
      y: rect.bottom + 5
    });
    setActiveMenu(activeMenu === songIndex ? null : songIndex);
  };

  const handleMenuAction = (action, song, e) => {
    e.stopPropagation();
    setActiveMenu(null);

    switch (action) {
      case 'addToQueue':
        console.log('Agregar a cola:', song);
        // Implementar lógica de cola
        break;
      case 'queueNext':
        console.log('Reproducir siguiente:', song);
        // Implementar lógica
        break;
      case 'addToPlaylist':
        console.log('Agregar a playlist:', song);
        // Abrir modal de playlists
        break;
      case 'goArtist':
        console.log('Ir al artista:', song.artista);
        // Navegar al artista
        break;
      case 'share':
        console.log('Compartir:', song);
        // Implementar compartir
        break;
      default:
        break;
    }
  };

  const formatQuality = (song) => {
    if (song.bit_depth === 24 || song.bit_depth === 32) return 'Hi-Res';
    if (song.format && song.format.toLowerCase().includes('flac')) return 'FLAC';
    return null;
  };

  const formatTotalDuration = (seconds) => {
    if (!seconds) return "";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h} h ${m} min` : `${m} min`;
  };

  const menuOptions = [
    { label: 'Agregar a la cola', action: 'addToQueue' },
    { label: 'Reproducir siguiente', action: 'queueNext' },
    { label: 'Agregar a playlist', action: 'addToPlaylist' },
    { label: 'Ir al artista', action: 'goArtist' },
    { label: 'Compartir', action: 'share' }
  ];

  if (loading) return <div className="ia-loading"><div className="loading-spinner" /></div>;
  if (error) return <div className="ia-error"><h2>{error}</h2></div>;

  return (
    <div className="yt-album-page">

      <div
        className="ambient-background"
        style={{ backgroundImage: `url(${album?.portada || '/default_cover.png'})` }}
      />
      <div className="ambient-overlay" />

      <div className="content-wrapper">

        <div className="album-hero">
          <div className="cover-container">
            <img
              src={album?.portada || '/default_cover.png'}
              alt={album?.titulo}
              className="hero-cover"
            />
          </div>

          <div className="hero-details">
            <h1 className="album-title">{album?.titulo}</h1>

            <div className="album-meta-row">
              {album?.artista_id ? (
                <Link
                  to={`/artist/${album.artista_id}`}
                  className="artist-name hover-link"
                >
                  {album?.autor || 'Desconocido'}
                </Link>
              ) : (
                <span className="artist-name">{album?.autor || 'Desconocido'}</span>
              )}

              <span className="meta-dot">•</span>
              <span className="meta-text">Álbum</span>
              <span className="meta-dot">•</span>
              <span className="meta-text">{album?.year || '2024'}</span>
            </div>

            <div className="album-stats">
              {songs.length} canciones • {formatTotalDuration(totalDuration)}
            </div>

            <div className="action-bar">
              <button onClick={() => playSongList(songs, 0)} className="btn-primary-white">
                <IoPlaySharp /> <span>Reproducir</span>
              </button>
              <button className="btn-circle-glass">
                <IoShuffle />
              </button>
              <button className="btn-circle-glass">
                <IoEllipsisHorizontal />
              </button>
            </div>
          </div>
        </div>

        <div className="tracks-container">
          {songs.map((song, index) => {
            const isPlaying = currentSong?.id === song.id;
            const qualityBadge = formatQuality(song);
            const isMenuOpen = activeMenu === index;

            return (
              <div
                key={song.id}
                className={`track-row song-item ${isPlaying ? 'playing' : ''}`}
                onClick={() => handleSongClick(index)}
                data-id={song.id}
                data-titulo={song.titulo}
                data-artista={song.artista}
              >
                <div className="track-col-index">
                  <span className="number">{index + 1}</span>
                  <span className="icon"><IoPlaySharp /></span>
                </div>

                <div className="track-col-info">
                  <div className="track-title">{song.titulo}</div>
                  <div className="track-artist">{song.artista}</div>
                </div>

                <div className="track-col-meta mobile-hide">
                  {qualityBadge && <span className="format-badge">{qualityBadge}</span>}
                </div>

                <div className="track-col-duration mobile-hide">
                  {Math.floor(song.duracion / 60)}:{(song.duracion % 60).toString().padStart(2, '0')}
                </div>

                <div className="track-col-actions" onClick={(e) => e.stopPropagation()}>
                  <LikeButton
                    song={song}
                    isLiked={likedSongs.has(song.id)}
                    onLikeToggle={handleLikeToggle}
                  />

                  <button
                    className="track-menu-btn"
                    onClick={(e) => handleMenuClick(e, index)}
                    aria-label="Más opciones"
                  >
                    <IoEllipsisVertical size={18} />
                  </button>
                </div>

                {/* Menú contextual individual */}
                {isMenuOpen && (
                  <div
                    className="track-context-menu"
                    style={{
                      position: 'fixed',
                      top: `${menuPosition.y}px`,
                      left: `${menuPosition.x}px`,
                      zIndex: 100000
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ul className="track-menu-list">
                      {menuOptions.map((option) => (
                        <li
                          key={option.action}
                          className="track-menu-item"
                          onClick={(e) => handleMenuAction(option.action, song, e)}
                        >
                          {option.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}