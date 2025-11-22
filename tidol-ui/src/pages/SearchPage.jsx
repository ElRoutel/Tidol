import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/axiosConfig';
import { usePlayer } from '../context/PlayerContext';
import SearchInput from '../components/SearchInput';
import SearchResultCard from '../components/SearchResultCard';
import { IoTimeOutline, IoCloseOutline } from 'react-icons/io5'; // Iconos para el historial

import './search.css';
import '../styles/glass.css';

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryParam = searchParams.get('q') || ''; // 1. Leemos la URL al iniciar

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({
    canciones: [], albums: [], artists: [], archive: []
  });
  
  // Estado para el historial local
  const [searchHistory, setSearchHistory] = useState([]);

  const navigate = useNavigate();
  const { playSongList } = usePlayer();

  // --- A. CARGAR HISTORIAL AL MONTAR ---
  useEffect(() => {
    const savedHistory = localStorage.getItem('tidol_search_history');
    if (savedHistory) {
      setSearchHistory(JSON.parse(savedHistory));
    }
  }, []);

  // --- B. EFECTO QUE REACCIONA A LA URL ---
  // Esto es lo que evita que se "pierda" la búsqueda al volver atrás
  useEffect(() => {
    if (queryParam.trim() !== '') {
      performSearch(queryParam);
    } else {
      // Si la URL está vacía, limpiamos resultados
      setResults({ canciones: [], albums: [], artists: [], archive: [] });
    }
  }, [queryParam]);

  // --- C. FUNCIÓN DE BÚSQUEDA REAL ---
  const performSearch = async (query) => {
    setLoading(true);
    try {
      const res = await api.get(`/music/searchAll?q=${encodeURIComponent(query)}`);
      const data = res.data || {};
      
      setResults({
        canciones: data.canciones || [],
        albums: data.albums || [],
        artists: data.artists || [],
        archive: normalizeArchiveResults(data.archive || [])
      });
    } catch (err) {
      console.error('Error buscando:', err);
    } finally {
      setLoading(false);
    }
  };

  // --- D. MANEJO DEL INPUT ---
  // Cuando el usuario busca, NO buscamos directamente, solo actualizamos la URL.
  // El useEffect de arriba detectará el cambio y ejecutará la búsqueda.
  const handleSearch = (query) => {
    if (!query || query.trim() === '') {
      setSearchParams({});
      return;
    }
    
    // 1. Actualizar URL
    setSearchParams({ q: query });

    // 2. Guardar en Historial (LocalStorage)
    updateHistory(query);
  };

  // --- E. GESTIÓN DEL HISTORIAL ---
  const updateHistory = (term) => {
    let newHistory = [term, ...searchHistory.filter(item => item !== term)];
    newHistory = newHistory.slice(0, 10); // Guardar solo los últimos 10
    setSearchHistory(newHistory);
    localStorage.setItem('tidol_search_history', JSON.stringify(newHistory));
  };

  const removeFromHistory = (e, term) => {
    e.stopPropagation(); // Evitar que se dispare el click del item
    const newHistory = searchHistory.filter(item => item !== term);
    setSearchHistory(newHistory);
    localStorage.setItem('tidol_search_history', JSON.stringify(newHistory));
  };

  // Normalización (Tu código original)
  const normalizeArchiveResults = (archiveItems) => {
    if (!archiveItems || archiveItems.length === 0) return [];
    return archiveItems.map((item) => {
      const identifier = item.identifier || (item.id && item.id.startsWith('ia_') ? item.id.replace('ia_', '') : item.id);
      return {
        id: item.id || `ia_${identifier}`,
        identifier,
        titulo: item.titulo || item.title || 'Sin título',
        artista: item.artista || item.artist || item.creator || 'Autor desconocido',
        url: item.url || `https://archive.org/details/${identifier}`,
        portada: `https://archive.org/services/img/${identifier}`,
        duracion: item.duracion || item.duration || null,
        album: item.album || null,
        year: item.year || null,
      };
    });
  };

  const handlePlayArchive = async (item) => {
    // Tu lógica de analytics
    try { await api.post("/music/ia/click", { identifier: item.identifier, title: item.titulo }); } catch (_) {}
    navigate(`/ia-album/${item.identifier}`);
  };

  const hasResults = results.canciones.length > 0 || results.albums.length > 0 || results.artists.length > 0 || results.archive.length > 0;
  const showHistory = !queryParam && searchHistory.length > 0;

  return (
    <div className="search-page">
      {/* Barra de búsqueda */}
      <div className="search-header glass-card">
        {/* Pasamos el valor inicial desde la URL para que el input no se quede vacío */}
        <SearchInput onSearch={handleSearch} loading={loading} initialValue={queryParam} />
      </div>

      {/* 1. HISTORIAL DE BÚSQUEDA (Solo si no hay búsqueda activa) */}
      {showHistory && (
        <div className="search-history-section">
          <h3 className="history-title">Búsquedas recientes</h3>
          <div className="history-list">
            {searchHistory.map((term, index) => (
              <div 
                key={index} 
                className="history-item glass-card" 
                onClick={() => handleSearch(term)}
              >
                <div className="history-content">
                  <IoTimeOutline className="history-icon" />
                  <span className="history-text">{term}</span>
                </div>
                <button 
                  className="history-delete-btn"
                  onClick={(e) => removeFromHistory(e, term)}
                >
                  <IoCloseOutline />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. ESTADO INICIAL (Sin historial ni búsqueda) */}
      {!queryParam && searchHistory.length === 0 && (
        <div className="search-empty-state glass-card">
          <div className="empty-icon">🔍</div>
          <h2 className="empty-title">Descubre tu música</h2>
          <p className="empty-description">Busca canciones, álbumes y artistas.</p>
        </div>
      )}

      {/* 3. SIN RESULTADOS */}
      {!loading && queryParam && !hasResults && (
        <div className="search-empty-state glass-card">
          <div className="empty-icon">😕</div>
          <h2 className="empty-title">No encontramos "{queryParam}"</h2>
          <p className="empty-description">Intenta con otros términos.</p>
        </div>
      )}

      {/* 4. RESULTADOS */}
      <div className="search-results">
        {/* Artistas */}
        {results.artists.length > 0 && (
          <div className="results-section">
            <div className="section-header glass-card">
              <h2 className="section-title">Artistas</h2>
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

        {/* Álbumes */}
        {results.albums.length > 0 && (
          <div className="results-section">
            <div className="section-header glass-card">
              <h2 className="section-title">Álbumes</h2>
            </div>
            <div className="results-grid">
              {results.albums.map(album => (
                <SearchResultCard
                  key={album.id}
                  image={album.portada}
                  title={album.titulo}
                  subtitle={album.autor}
                  onClick={() => navigate(`/album/${album.id}`)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Canciones */}
        {results.canciones.length > 0 && (
          <div className="results-section">
            <div className="section-header glass-card">
              <h2 className="section-title">Canciones</h2>
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
            <div className="section-header glass-card">
              <h2 className="section-title">Internet Archive 🌐</h2>
            </div>
            <div className="results-grid">
              {results.archive.map((item, index) => (
                <SearchResultCard
                  key={item.id || index}
                  image={item.portada}
                  title={item.titulo}
                  subtitle={item.artista}
                  onClick={() => handlePlayArchive(item)}
                  isArchive={true}
                  songData={item}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ESTILOS DEL HISTORIAL */}
      <style jsx>{`
        .search-history-section {
          margin-top: 20px;
          padding: 0 8px;
        }
        .history-title {
          font-size: 14px;
          color: #aaa;
          margin-bottom: 12px;
          font-weight: 600;
          padding-left: 4px;
        }
        .history-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .history-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .history-item:hover {
          background: rgba(255,255,255,0.1);
        }
        .history-content {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .history-icon {
          font-size: 18px;
          color: #888;
        }
        .history-text {
          font-size: 15px;
          color: white;
        }
        .history-delete-btn {
          background: none;
          border: none;
          color: #666;
          font-size: 20px;
          padding: 4px;
          display: flex;
          align-items: center;
          cursor: pointer;
          border-radius: 50%;
        }
        .history-delete-btn:hover {
          color: #ff5555;
          background: rgba(255,255,255,0.05);
        }
        .loading-text {
            text-align: center;
            color: #aaa;
            font-size: 14px;
            margin-top: 10px;
        }
      `}</style>
    </div>
  );
}