// src/pages/SearchPage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import { usePlayer } from '../context/PlayerContext';

import SearchInput from '../components/SearchInput';
import SearchResultCard from '../components/SearchResultCard';

export function SearchPage() {
  const [loading, setLoading] = useState(false);
  const [initialSearch, setInitialSearch] = useState(true);
  const [results, setResults] = useState({ 
    canciones: [], 
    albums: [], 
    artists: [], 
    archive: [] 
  });

  const navigate = useNavigate();
  const { playSongList } = usePlayer();

  /**
   * Normaliza los resultados de Internet Archive
   */
  const normalizeArchiveResults = (archiveItems) => {
    if (!archiveItems || archiveItems.length === 0) return [];

    return archiveItems.map((item) => {
      const identifier = item.identifier || 
                        (item.id && item.id.startsWith('ia_') 
                          ? item.id.replace('ia_', '') 
                          : item.id);

      const coverUrl = `https://archive.org/services/img/${identifier}`;

      return {
        id: item.id || `ia_${identifier}`,
        identifier: identifier,
        titulo: item.titulo || item.title || 'Sin título',
        artista: item.artista || item.artist || item.creator || 'Autor desconocido',
        url: item.url || `https://archive.org/details/${identifier}`,
        portada: coverUrl,
        duracion: item.duracion || item.duration || null,
        album: item.album || null,
        year: item.year || null,
      };
    });
  };

  const handleSearch = async (query) => {
    if (!query || query.trim() === '') return;

    setLoading(true);
    setInitialSearch(false);
    setResults({ canciones: [], albums: [], artists: [], archive: [] });

    try {
      const localRes = await api.get(`/music/search?q=${encodeURIComponent(query)}`);
      setResults(prev => ({ 
        ...prev, 
        canciones: localRes.data.canciones || [],
        albums: localRes.data.albums || [],
        artists: localRes.data.artists || []
      }));
    } catch (err) {
      console.error('Error en la búsqueda local:', err);
    }

    try {
      const archiveRes = await api.get(`/music/searchArchive?q=${encodeURIComponent(query)}`);
      const rawArchive = archiveRes.data || [];
      const normalizedArchive = normalizeArchiveResults(rawArchive);

      setResults(prev => ({ 
        ...prev, 
        archive: normalizedArchive 
      }));
    } catch (err) {
      console.error('Error en la búsqueda de Internet Archive:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handler para abrir álbum/colección de Internet Archive
  const handlePlayArchive = (item) => {
    // Navegar a la página del álbum sin autoplay (iOS lo bloquea)
    navigate(`/ia-album/${item.identifier}`);
  };

  const hasResults = 
    results.canciones.length > 0 || 
    results.albums.length > 0 || 
    results.artists.length > 0 || 
    results.archive.length > 0;

  return (
    <div className="search-page">
      {/* Barra de búsqueda */}
      <div className="search-header">
        <SearchInput onSearch={handleSearch} loading={loading} />
      </div>

      {/* Estado inicial */}
      {initialSearch && (
        <div className="search-empty-state">
          <div className="empty-icon">🔍</div>
          <h2 className="empty-title">Descubre tu música</h2>
          <p className="empty-description">
            Busca canciones, álbumes y artistas en tu biblioteca
          </p>
          <p className="empty-subtitle">
            También explora millones de grabaciones en Internet Archive
          </p>
        </div>
      )}

      {/* Sin resultados */}
      {!loading && !initialSearch && !hasResults && (
        <div className="search-empty-state">
          <div className="empty-icon">🎵</div>
          <h2 className="empty-title">No se encontraron resultados</h2>
          <p className="empty-description">
            Intenta con otros términos de búsqueda
          </p>
        </div>
      )}

      {/* Resultados */}
      <div className="search-results">
        {/* Artistas */}
        {results.artists.length > 0 && (
          <div className="results-section">
            <div className="section-header">
              <h2 className="section-title">
                Artistas
                <span className="results-count">{results.artists.length}</span>
              </h2>
            </div>
            <div className="results-grid">
              {results.artists.map(artist => (
                <SearchResultCard
                  key={artist.id}
                  image={artist.imagen}
                  title={artist.nombre}
                  subtitle="Artista"
                  onClick={() => navigate(`/artist/${artist.id}`)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Álbumes locales */}
        {results.albums.length > 0 && (
          <div className="results-section">
            <div className="section-header">
              <h2 className="section-title">
                Álbumes
                <span className="results-count">{results.albums.length}</span>
              </h2>
            </div>
            <div className="results-grid">
              {results.albums.map(album => (
                <SearchResultCard
                  key={album.id}
                  image={album.portada}
                  title={album.titulo}
                  subtitle={album.autor || 'Álbum'}
                  onClick={() => navigate(`/album/${album.id}`)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Canciones locales */}
        {results.canciones.length > 0 && (
          <div className="results-section">
            <div className="section-header">
              <h2 className="section-title">
                Canciones
                <span className="results-count">{results.canciones.length}</span>
              </h2>
            </div>
            <div className="results-grid">
              {results.canciones.map((song, index) => (
                <SearchResultCard
                  key={song.id}
                  image={song.portada}
                  title={song.titulo}
                  subtitle={song.artista}
                  onClick={() => playSongList(results.canciones, index)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Internet Archive */}
        {results.archive.length > 0 && (
          <div className="results-section">
            <div className="section-header">
              <h2 className="section-title">
                Internet Archive 🌐
                <span className="results-count">{results.archive.length}</span>
              </h2>
            </div>
            <div className="results-grid">
              {results.archive.map((item, index) => (
                <SearchResultCard
                  key={item.id || item.identifier || index}
                  image={item.portada}
                  title={item.titulo}
                  subtitle={item.artista}
                  onClick={() => handlePlayArchive(item)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Indicador de carga */}
      {loading && (
        <div className="search-loading">
          <div className="loading-spinner" />
          <p className="loading-text">Buscando en todas partes...</p>
        </div>
      )}

      <style jsx>{`
        .search-page {
          min-height: 100vh;
          padding: 24px;
          padding-bottom: 120px;
          background: linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 100%);
        }

        /* Header de búsqueda */
        .search-header {
          max-width: 800px;
          margin: 0 auto 40px;
        }

        /* Estado vacío */
        .search-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
          text-align: center;
          padding: 60px 24px;
        }

        .empty-icon {
          font-size: 80px;
          margin-bottom: 24px;
          animation: float 3s ease-in-out infinite;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }

        .empty-title {
          font-size: 32px;
          font-weight: 800;
          color: #ffffff;
          margin: 0 0 12px 0;
          letter-spacing: -0.5px;
        }

        .empty-description {
          font-size: 18px;
          color: rgba(255, 255, 255, 0.7);
          margin: 0 0 8px 0;
          max-width: 500px;
        }

        .empty-subtitle {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
          margin: 0;
          max-width: 500px;
        }

        /* Contenedor de resultados */
        .search-results {
          max-width: 1400px;
          margin: 0 auto;
        }

        /* Secciones de resultados */
        .results-section {
          margin-bottom: 48px;
        }

        .results-section:last-child {
          margin-bottom: 0;
        }

        .section-header {
          margin-bottom: 20px;
          padding: 0 4px;
        }

        .section-title {
          font-size: 28px;
          font-weight: 700;
          color: #ffffff;
          margin: 0;
          display: flex;
          align-items: center;
          gap: 12px;
          letter-spacing: -0.5px;
        }

        .results-count {
          font-size: 14px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          background: rgba(255, 255, 255, 0.05);
          padding: 4px 12px;
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        /* Grid de resultados */
        .results-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 12px;
        }

        /* Loading spinner */
        .search-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
          padding: 60px 24px;
        }

        .loading-spinner {
          width: 60px;
          height: 60px;
          border: 4px solid rgba(29, 185, 84, 0.1);
          border-top: 4px solid #1db954;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin-bottom: 24px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .loading-text {
          font-size: 16px;
          color: rgba(255, 255, 255, 0.7);
          font-weight: 500;
          margin: 0;
        }

        /* Responsive */
        @media (max-width: 1024px) {
          .results-grid {
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          }
        }

        @media (max-width: 768px) {
          .search-page {
            padding: 16px;
            padding-bottom: 100px;
          }

          .search-header {
            margin-bottom: 32px;
          }

          .empty-icon {
            font-size: 60px;
          }

          .empty-title {
            font-size: 24px;
          }

          .empty-description {
            font-size: 16px;
          }

          .empty-subtitle {
            font-size: 13px;
          }

          .section-title {
            font-size: 22px;
          }

          .results-section {
            margin-bottom: 36px;
          }

          .results-grid {
            grid-template-columns: 1fr;
            gap: 8px;
          }
        }

        /* Animaciones de entrada */
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .results-section {
          animation: fadeInUp 0.5s ease-out;
        }

        .results-section:nth-child(1) {
          animation-delay: 0.05s;
        }
        .results-section:nth-child(2) {
          animation-delay: 0.1s;
        }
        .results-section:nth-child(3) {
          animation-delay: 0.15s;
        }
        .results-section:nth-child(4) {
          animation-delay: 0.2s;
        }

        /* Scroll suave */
        .search-page {
          scroll-behavior: smooth;
        }

        /* Mejoras de accesibilidad */
        @media (prefers-reduced-motion: reduce) {
          .empty-icon,
          .loading-spinner,
          .results-section {
            animation: none;
          }
        }

        /* Dark mode enhancements */
        @media (prefers-color-scheme: dark) {
          .search-page {
            background: linear-gradient(180deg, #0a0a0a 0%, #000000 100%);
          }
        }
      `}</style>
    </div>
  );
}
