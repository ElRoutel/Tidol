// tidol-frontend/src/pages/AlbumPage.jsx
import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import api from '../api/axiosConfig'; // <-- 1. USAR LA INSTANCIA CENTRAL
import { usePlayer } from '../context/PlayerContext';

export default function AlbumPage() {
  const { id } = useParams(); // ID del álbum desde la URL
  const [searchParams] = useSearchParams();
  const songId = searchParams.get('song'); // ID de canción específica (opcional)

  const [album, setAlbum] = useState(null);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { playSongList, currentSong } = usePlayer();

  useEffect(() => {
    const fetchAlbum = async () => {
      try {
        setLoading(true);

        // Las llamadas ahora usan 'api' y rutas relativas.
        // El interceptor de Axios se encarga del token.
        // El proxy de Vite se encarga de la URL base.

        const albumRes = await api.get(`/api/music/albums/${id}`);
        setAlbum(albumRes.data);

        const songsRes = await api.get(`/api/music/albums/${id}/canciones`);
        setSongs(songsRes.data);

        // Si hay un songId en la URL, reproducir esa canción
        if (songId && songsRes.data.length > 0) {
          const songIndex = songsRes.data.findIndex(s => s.id == songId);
          if (songIndex !== -1) {
            playSongList(songsRes.data, songIndex);
          }
        }

        setLoading(false);
      } catch (err) {
        console.error('Error cargando álbum:', err);
        setError('No se pudo cargar el álbum');
        setLoading(false);
      }
    };

    if (id) {
      fetchAlbum();
    }
  }, [id, songId]);

  // Manejar click en una canción
  const handleSongClick = (index) => {
    playSongList(songs, index);
  };

  // Formatear calidad
  const formatQuality = (song) => {
    const parts = [];
    if (song.bit_depth) parts.push(`${song.bit_depth}-bit`);
    if (song.sample_rate) parts.push(`${(song.sample_rate / 1000).toFixed(1)} kHz`);
    return parts.join(' / ') || 'Standard';
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <h2>Cargando álbum...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '50px', color: '#ff5555' }}>
        <h2>{error}</h2>
      </div>
    );
  }

  return (
    <div className="album-page">
      {/* Banner del álbum */}
      <div
        className="album-header"
        style={{
          backgroundImage: `url(${album?.portada || '/default_cover.png'})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="album-overlay">
          <img
            src={album?.portada || '/default_cover.png'}
            alt={album?.titulo}
            className="album-cover-large"
          />
          <div className="album-info">
            <h1>{album?.titulo}</h1>
            <p className="album-artist">{album?.autor || 'Desconocido'}</p>
            <p className="album-meta">
              {songs.length} canciones
            </p>
          </div>
        </div>
      </div>

      {/* Lista de canciones */}
      <div className="songs-section">
        <h2>Canciones</h2>
        <div className="songs-grid">
          {songs.map((song, index) => (
            <div
              key={song.id}
              className={`song-card ${currentSong?.id === song.id ? 'playing' : ''}`}
              onClick={() => handleSongClick(index)}
            >
              <div className="song-number">{index + 1}</div>
              <img
                src={song.portada || '/default_cover.png'}
                alt={song.titulo}
                className="song-thumb"
              />
              <div className="song-info">
                <div className="song-title">{song.titulo}</div>
                <div className="song-artist">{song.artista}</div>
              </div>
              <div className="song-quality">{formatQuality(song)}</div>
              <div className="song-duration">
                {Math.floor(song.duracion / 60)}:{(song.duracion % 60).toString().padStart(2, '0')}
              </div>
              <button className="play-btn-small">
                {currentSong?.id === song.id ? '⏸' : '▶'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .album-page {
          padding-bottom: 100px;
        }

        .album-header {
          position: relative;
          height: 340px;
          border-radius: 12px;
          overflow: hidden;
          margin-bottom: 30px;
        }

        .album-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.8));
          display: flex;
          align-items: flex-end;
          padding: 30px;
          gap: 24px;
        }

        .album-cover-large {
          width: 200px;
          height: 200px;
          border-radius: 8px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.5);
        }

        .album-info h1 {
          font-size: 48px;
          margin: 0 0 8px 0;
          color: white;
        }

        .album-artist {
          font-size: 18px;
          color: #b3b3b3;
          margin: 0 0 8px 0;
        }

        .album-meta {
          font-size: 14px;
          color: #888;
          margin: 0;
        }

        .songs-section h2 {
          margin-bottom: 16px;
          color: white;
        }

        .songs-grid {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .song-card {
          display: grid;
          grid-template-columns: 40px 50px 1fr 150px 60px 40px;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .song-card:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .song-card.playing {
          background: rgba(29, 185, 84, 0.2);
        }

        .song-number {
          text-align: center;
          color: #b3b3b3;
          font-size: 14px;
        }

        .song-thumb {
          width: 50px;
          height: 50px;
          border-radius: 4px;
          object-fit: cover;
        }

        .song-info {
          overflow: hidden;
        }

        .song-title {
          font-size: 16px;
          font-weight: 500;
          color: white;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .song-artist {
          font-size: 14px;
          color: #b3b3b3;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .song-quality {
          font-size: 12px;
          color: #888;
        }

        .song-duration {
          text-align: right;
          color: #b3b3b3;
          font-size: 14px;
        }

        .play-btn-small {
          background: none;
          border: none;
          color: #1db954;
          font-size: 18px;
          cursor: pointer;
          padding: 8px;
          border-radius: 50%;
          opacity: 0;
          transition: all 0.2s;
        }

        .song-card:hover .play-btn-small,
        .song-card.playing .play-btn-small {
          opacity: 1;
        }

        .play-btn-small:hover {
          background: rgba(255, 255, 255, 0.1);
          transform: scale(1.1);
        }

        @media (max-width: 768px) {
          .album-header {
            height: 250px;
          }

          .album-cover-large {
            width: 150px;
            height: 150px;
          }

          .album-info h1 {
            font-size: 32px;
          }

          .song-card {
            grid-template-columns: 30px 40px 1fr 40px;
          }

          .song-quality,
          .song-duration {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
