// src/pages/SearchPage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import { usePlayer } from '../context/PlayerContext';
import './search.css';
import '../styles/glass.css';
import SearchInput from '../components/SearchInput';
import SearchResultCard from '../components/SearchResultCard';

export function SearchPage() {
  const [loading, setLoading] = useState(false);
  const [initialSearch, setInitialSearch] = useState(true);
  const [lastQuery, setLastQuery] = useState("");
  const [results, setResults] = useState({
    canciones: [],
    albums: [],
    artists: [],
    archive: []
  });

  const navigate = useNavigate();
  const { playSongList } = usePlayer();

  // Normaliza resultados de Internet Archive
  const normalizeArchiveResults = (archiveItems) => {
    if (!archiveItems || archiveItems.length === 0) return [];

    return archiveItems.map((item) => {
      const identifier =
        item.identifier ||
        (item.id && item.id.startsWith('ia_') ? item.id.replace('ia_', '') : item.id);

      const coverUrl = `https://archive.org/services/img/${identifier}`;

      return {
        id: item.id || `ia_${identifier}`,
        identifier,
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
    setLastQuery(query);
    setResults({ canciones: [], albums: [], artists: [], archive: [] });

    try {
      // Unificada: local + IA
      const res = await api.get(`/music/searchAll?q=${encodeURIComponent(query)}`);
      const data = res.data || {};
      const normalizedArchive = normalizeArchiveResults(data.archive || []);

      setResults({
        canciones: data.canciones || [],
        albums: data.albums || [],
        artists: data.artists || [],
        archive: normalizedArchive
      });
    } catch (err) {
      console.error('Error en búsqueda unificada:', err);
    } finally {
      setLoading(false);
    }
  };

  // Registrar clic IA y navegar a la vista del item
  const handlePlayArchive = async (item) => {
    try {
      await api.post("/music/ia/click", {
        query: lastQuery || item.titulo || item.artista || item.identifier || "",
        identifier: item.identifier,
        title: item.titulo,
        creator: item.artista
      });
    } catch (_e) {
      // No bloquear navegación
    }
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
      <div className="search-header glass-card">
        <SearchInput onSearch={handleSearch} loading={loading} />
      </div>

      {/* Estado inicial */}
      {initialSearch && (
        <div className="search-empty-state glass-card">
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
        <div className="search-empty-state glass-card">
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
            <div className="section-header glass-card">
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
            <div className="section-header glass-card">
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
            <div className="section-header glass-card">
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
            <div className="section-header glass-card">
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
                  isArchive={true}
                  songData={item}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Indicador de carga */}
      {loading && (
        <div className="search-loading glass-card">
          <div className="loading-spinner" />
          <p className="loading-text">Buscando en todas partes (si la busqueda es nueva puede tardar unos 172s)...</p>
        </div>
      )}
    </div>
  );
}
