// src/pages/HomePage.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import api from '../api/axiosConfig';

// Componente reutilizable para mostrar una sección de canciones o álbumes
const ItemSection = ({ title, items, on_click, is_song = true }) => {
  if (!items || items.length === 0) {
    return null; // No renderizar la sección si no hay items
  }

  return (
    <div style={{ marginBottom: '40px' }}>
      <h2>{title}</h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: '16px',
        marginTop: '16px'
      }}>
        {items.map((item, index) => (
          <div
            key={item.id}
            onClick={() => on_click(item, index)}
            style={{
              cursor: 'pointer',
              padding: '16px',
              background: '#181818',
              borderRadius: '8px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#282828'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#181818'}
          >
            <img
              src={item.portada || '/default_cover.png'}
              alt={item.titulo}
              style={{
                width: '100%',
                aspectRatio: '1',
                borderRadius: is_song ? '50%' : '8px', // Círculos para canciones, cuadrados para álbumes
                marginBottom: '12px',
                objectFit: 'cover'
              }}
            />
            <h3 style={{ fontSize: '16px', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {item.titulo}
            </h3>
            <p style={{ fontSize: '14px', color: '#b3b3b3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {is_song ? item.artista : item.autor}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function HomePage() {
  const [albums, setAlbums] = useState([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { playSongList } = usePlayer();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [albumsRes, historyRes, recommendationsRes] = await Promise.all([
          api.get('/api/music/albums'),
          api.get('/api/history'),
          api.get('/api/music/home-recommendations')
        ]);
        
        setAlbums(albumsRes.data);
        setRecentlyPlayed(historyRes.data);
        setRecommendations(recommendationsRes.data);

      } catch (error) {
        console.error('Error cargando los datos del home:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handlePlaySong = (song, index, song_list) => {
    const playlist = song_list.slice(index);
    playSongList(playlist, 0);
  };

  const handleAlbumClick = (album) => {
    navigate(`/album/${album.id}`);
  };

  if (loading) {
    return <div style={{ textAlign: 'center', marginTop: '50px' }}>Cargando...</div>;
  }

  return (
    <div>
      <h1 style={{ marginBottom: '30px' }}>Inicio</h1>
      
      <ItemSection 
        title="Escuchado Recientemente"
        items={recentlyPlayed}
        on_click={(song, index) => handlePlaySong(song, index, recentlyPlayed)}
        is_song={true}
      />

      <ItemSection 
        title="Recomendaciones para ti"
        items={recommendations}
        on_click={(song, index) => handlePlaySong(song, index, recommendations)}
        is_song={true}
      />

      <ItemSection 
        title="Álbumes Populares"
        items={albums}
        on_click={handleAlbumClick}
        is_song={false}
      />
    </div>
  );
}
