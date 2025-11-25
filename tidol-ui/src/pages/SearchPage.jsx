import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import { useSearch } from '../hooks/useSearch';
import SearchInput from '../components/SearchInput';
import SearchResultCard from '../components/SearchResultCard';
import { IoTimeOutline, IoCloseOutline } from 'react-icons/io5';
import api from '../api/axiosConfig';
import '../styles/glass.css';
import './search.css';

export function SearchPage() {
  const {
    query,
    loading,
    results,
    searchHistory,
    handleSearch,
    removeFromHistory,
    hasResults
  } = useSearch();

  const navigate = useNavigate();
  const { playSongList } = usePlayer();

  const handlePlayArchive = async (item) => {
    try { await api.post("/music/ia/click", { identifier: item.identifier, title: item.titulo }); } catch (_) { }
    navigate(`/ia-album/${item.identifier}`);
  };

  const showHistory = !query && searchHistory.length > 0;

  return (
    <div className="search-page">
      {/* Barra de búsqueda */}
      <div className="search-header glass-card">
        <SearchInput onSearch={handleSearch} loading={loading} initialValue={query} />
      </div>

      {/* 1. HISTORIAL DE BÚSQUEDA */}
      {showHistory && (
        <div className="mt-5 px-2">
          <h3 className="text-sm text-gray-400 mb-3 font-semibold pl-1">Búsquedas recientes</h3>
          <div className="flex flex-col gap-2">
            {searchHistory.map((term, index) => (
              <div
                key={index}
                className="flex justify-between items-center p-3 cursor-pointer rounded-lg hover:bg-white/10 transition-colors glass-card"
                onClick={() => handleSearch(term)}
              >
                <div className="flex items-center gap-3">
                  <IoTimeOutline className="text-lg text-gray-400" />
                  <span className="text-white text-sm">{term}</span>
                </div>
                <button
                  className="text-gray-400 hover:text-red-400 p-1 rounded-full hover:bg-white/5 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFromHistory(term);
                  }}
                >
                  <IoCloseOutline size={20} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. ESTADO INICIAL */}
      {!query && searchHistory.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8 glass-card rounded-2xl mt-10">
          <div className="text-6xl mb-6 animate-bounce">🔍</div>
          <h2 className="text-2xl font-bold text-white mb-2">Descubre tu música</h2>
          <p className="text-gray-400 text-lg">Busca canciones, álbumes y artistas.</p>
        </div>
      )}

      {/* 3. SIN RESULTADOS */}
      {!loading && query && !hasResults && (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8 glass-card rounded-2xl mt-10">
          <div className="text-6xl mb-6">😕</div>
          <h2 className="text-2xl font-bold text-white mb-2">No encontramos "{query}"</h2>
          <p className="text-gray-400 text-lg">Intenta con otros términos.</p>
        </div>
      )}

      {/* 4. RESULTADOS */}
      <div className="flex flex-col gap-10 mt-8">
        {/* Artistas */}
        {results.artists.length > 0 && (
          <div className="animate-fade-in">
            <div className="mb-5 px-4 py-3 glass-card rounded-xl inline-block">
              <h2 className="text-xl font-bold text-white">Artistas</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
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
          <div className="animate-fade-in">
            <div className="mb-5 px-4 py-3 glass-card rounded-xl inline-block">
              <h2 className="text-xl font-bold text-white">Álbumes</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
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
          <div className="animate-fade-in">
            <div className="mb-5 px-4 py-3 glass-card rounded-xl inline-block">
              <h2 className="text-xl font-bold text-white">Canciones</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
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
          <div className="animate-fade-in">
            <div className="mb-5 px-4 py-3 glass-card rounded-xl inline-block">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Internet Archive 🌐
              </h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
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
    </div>
  );
}