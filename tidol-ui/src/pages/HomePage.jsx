// src/pages/HomePage.jsx
// src/pages/HomePage.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import api from '../api/axiosConfig'; // <--- 1. ¡Importa nuestra nueva instancia "api"!

export default function HomePage() {
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { playSongList } = usePlayer();

  useEffect(() => {
    const fetchAlbums = async () => {
      try {
        // 2. ADIÓS a las variables API_URL y token.
        //    El proxy maneja la URL y el interceptor maneja el token.
        const response = await api.get('/api/music/albums'); // <--- 3. ¡Listo! Así de simple.
        setAlbums(response.data);
      } catch (error) {
        console.error('Error cargando álbumes:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAlbums();
  }, []);

  if (loading) {
    return <div>Cargando...</div>;
  }

  return (
    <div>
      <h1>Álbumes Recientes</h1>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: '16px',
        marginTop: '24px'
      }}>
        {albums.map(album => (
          <div
            key={album.id}
            onClick={() => navigate(`/album/${album.id}`)}
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
              src={album.portada || '/default_cover.png'}
              alt={album.titulo}
              style={{
                width: '100%',
                aspectRatio: '1',
                borderRadius: '8px',
                marginBottom: '12px'
              }}
            />
            <h3 style={{ fontSize: '16px', marginBottom: '4px' }}>
              {album.titulo}
            </h3>
            <p style={{ fontSize: '14px', color: '#b3b3b3' }}>
              {album.autor}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}