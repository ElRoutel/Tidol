// src/pages/SearchPage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig'; // ¡Usa nuestra API centralizada!
import { usePlayer } from '../context/PlayerContext';

// Importa los componentes de tarjeta que ya creamos
import LocalSongCard from '../components/cards/LocalSongCard';
import LocalAlbumCard from '../components/cards/LocalAlbumCard';
import LocalArtistCard from '../components/cards/LocalArtistCard';
import ArchiveAlbumCard from '../components/cards/ArchiveAlbumCard';

export function SearchPage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({ 
    canciones: [], 
    albums: [], 
    artists: [], 
    archive: [] 
  });

  const navigate = useNavigate();
  const { playSongList } = usePlayer();

  // --- ¡LÓGICA DE BÚSQUEDA SIMPLIFICADA! ---
const handleSearch = async (e) => {
    e.preventDefault();
    if (!query) return;

    setLoading(true);
    // Resetea los resultados
    setResults({ canciones: [], albums: [], artists: [], archive: [] });

    // --- PASO 1: BÚSQUEDA LOCAL (RÁPIDA) ---
    try {
      // Pide solo los resultados locales primero
      const localRes = await api.get(`/api/music/search?q=${query}`);
      
      // Muestra los resultados locales INMEDIATAMENTE
      setResults(prev => ({ ...prev, ...localRes.data }));

    } catch (err) {
      console.error('Error en la búsqueda local:', err);
    } finally {
      // Termina el "loading" principal para que el usuario vea los resultados locales
      setLoading(false); 
    }

    // --- PASO 2: BÚSQUEDA IA (LENTA) ---
    // Esto se ejecuta en segundo plano, *después* de que los resultados locales ya se muestran
    try {
      const archiveRes = await api.get(`/api/music/searchArchive?q=${query}`);
      
      // Añade los resultados de IA al estado cuando lleguen
      setResults(prev => ({
        ...prev,
        archive: archiveRes.data || []
      }));

    } catch (err) {
      console.error('Error en la búsqueda de IA:', err);
    }
  };
  // ---------------------------------------------
  // ¡Toda la función 'buscarInternetArchive' de 50 líneas desaparece!
  // Ahora la hace el servidor.
  // ---------------------------------------------

  const handleArchivePlay = (item) => {
    navigate(`/ia-album/${item.identifier}?autoplay=true`);
  };
  
  const handleArchiveView = (item) => {
    navigate(`/ia-album/${item.identifier}`);
  };

  return (
    <div className="search-page-container">
      <form className="search-bar" onSubmit={handleSearch}>
        <input 
          type="text" 
          id="search-input" 
          placeholder="Buscar canción, álbum o artista..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button id="search-btn" type="submit" disabled={loading}>
          {loading ? 'Buscando...' : 'Buscar'}
        </button>
      </form>

      {/* El resto de tu JSX para renderizar los resultados es perfecto */}
      <div id="search-results">
        {loading ? <p>Cargando...</p> : (
          <>
            {/* Resultados de Artistas Locales */}
            {results.artists.length > 0 && (
              <section className="results-group">
                <h3>🎤 Artistas (Locales)</h3>
                <div className="result-grid">
                  {results.artists.map(artist => (
                    <LocalArtistCard 
                      key={artist.id} 
                      artist={artist} 
                      onClick={() => navigate(`/artist/${artist.id}`)} 
                    />
                  ))}
                </div>
              </section>
            )}
            
            {/* Resultados de Álbumes Locales */}
            {results.albums.length > 0 && (
              <section className="results-group">
                <h3>💿 Álbumes (Locales)</h3>
                <div className="result-grid">
                  {results.albums.map(album => (
                    <LocalAlbumCard 
                      key={album.id} 
                      album={album} 
                      onClick={() => navigate(`/album/${album.id}`)} 
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Resultados de Canciones Locales */}
            {results.canciones.length > 0 && (
              <section className="results-group">
                <h3>🎵 Canciones (Locales)</h3>
                <div className="result-list">
                  {results.canciones.map((song, index) => (
                    <LocalSongCard 
                      key={song.id} 
                      song={song} 
                      onPlay={() => playSongList(results.canciones, index)} 
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Resultados de Internet Archive */}
            {results.archive.length > 0 && (
              <section className="results-group">
                <h3>🌍 Internet Archive</h3>
                <div className="result-grid">
                  {results.archive.map((item, index) => (
                    <ArchiveAlbumCard 
                      key={item.identifier || index} 
                      item={item}
                      onView={() => handleArchiveView(item)}
                      onPlay={() => handleArchivePlay(item)}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* Tus estilos CSS están bien en index.css o aquí */}
      <style>{`
        .search-bar { display: flex; gap: 10px; margin-bottom: 20px; }
        .search-bar input { flex: 1; padding: 12px; border-radius: 6px; border: none; background: #282828; color: white; }
        .search-bar button { padding: 12px 20px; background: var(--primary); color: white; border: none; border-radius: 6px; cursor: pointer; }
        .results-group { margin-top: 30px; }
        .results-group h3 { margin-bottom: 16px; font-size: 20px; }
        .result-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; }
        .result-list { display: flex; flex-direction: column; gap: 8px; }
      `}</style>
    </div>
  );
}