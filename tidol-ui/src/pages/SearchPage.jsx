// src/pages/SearchPage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import { usePlayer } from '../context/PlayerContext';

import SearchInput from '../components/SearchInput';
import Shelf from '../components/Shelf';
import ArtistCard from '../components/ArtistCard';
import AlbumCard from '../components/AlbumCard';
import ArchiveAlbumCard from '../components/cards/ArchiveAlbumCard'; // 1. Usar el componente bueno
import Card from '../components/Card';

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

  const normalizeArchiveResults = (archiveItems) => {
    if (!archiveItems || archiveItems.length === 0) return [];

    return archiveItems.map((item) => {
      const identifier =
        item.identifier ||
        (item.id?.startsWith('ia_') ? item.id.replace('ia_', '') : item.id);

      return {
        id: item.id || `ia_${identifier}`,
        identifier,
        titulo:
          item.titulo ||
          item.title ||
          item.metadata?.title ||
          'Título no disponible',
        artista:
          item.artista ||
          item.artist ||
          item.metadata?.creator ||
          item.creator ||
          'Artista desconocido',
        url: item.url || (identifier
          ? `https://archive.org/details/${identifier}`
          : null),
        portada: identifier
          ? `https://archive.org/services/img/${identifier}`
          : '/default_cover.png',
        duracion: item.duracion || item.duration || null,
        album: item.album || item.metadata?.album || null,
        year: item.year || item.metadata?.year || null,
        hdPortada: true // ✅ Marca para intentar máxima calidad
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

  const handlePlayArchiveSong = (song, index) => {
    // Al reproducir, nos aseguramos de que TODAS las canciones de la lista
    // tengan el 'identifier' para que el FullScreenPlayer pueda buscar la portada HD.
    const iaSongs = results.archive.map(item => {
      return {
        id: item.id,
        titulo: item.titulo,
        artista: item.artista,
        url: item.url,
        portada: item.portada, // La portada de baja calidad inicial
        duracion: item.duracion,
        album: item.album,
        identifier: item.identifier, // <-- LA LÍNEA CLAVE
      };
    });
    playSongList(iaSongs, index);
  };

  const hasResults = 
    results.canciones.length > 0 || 
    results.albums.length > 0 || 
    results.artists.length > 0 || 
    results.archive.length > 0;

  return (
    <div className="p-6 bg-background min-h-full">
      <div className="mb-8">
        <SearchInput onSearch={handleSearch} loading={loading} />
      </div>

      {initialSearch && (
        <div className="text-center text-text-subdued py-12">
          <div className="text-6xl mb-4">🔍</div>
          <p className="text-lg">Busca tus canciones, álbumes o artistas favoritos</p>
          <p className="text-sm mt-2 opacity-70">
            Explora tu biblioteca local y millones de grabaciones en Internet Archive
          </p>
        </div>
      )}

      {!loading && !initialSearch && !hasResults && (
        <div className="text-center text-text-subdued py-12">
          <div className="text-6xl mb-4">🎵</div>
          <p className="text-lg">No se encontraron resultados</p>
          <p className="text-sm mt-2 opacity-70">
            Intenta con otros términos de búsqueda
          </p>
        </div>
      )}

      {results.artists.length > 0 && (
        <Shelf title="Artistas">
          {results.artists.map(artist => (
            <ArtistCard key={artist.id} artist={artist} />
          ))}
        </Shelf>
      )}

      {results.albums.length > 0 && (
        <Shelf title="Álbumes">
          {results.albums.map(album => (
            <AlbumCard key={album.id} album={album} />
          ))}
        </Shelf>
      )}

      {results.archive.length > 0 && (
        <Shelf title="Internet Archive 🌐">
          {results.archive.map((item, index) => (
            <ArchiveAlbumCard // 2. Reemplazar el componente
              key={item.id || item.identifier || index} 
              item={item}
              // 3. Al hacer clic, navegamos a la página del álbum
              onView={() => navigate(`/ia-album/${item.identifier}`)}
            />
          ))}
        </Shelf>
      )}

      {results.canciones.length > 0 && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold text-text mb-4">
            Canciones
            <span className="text-sm font-normal text-text-subdued ml-2">
              ({results.canciones.length})
            </span>
          </h2>
          <div className="flex flex-col gap-2">
            {results.canciones.map((song, index) => (
              <div 
                key={song.id} 
                onClick={() => playSongList(results.canciones, index)} 
                className="w-full cursor-pointer hover:bg-surface-elevated transition-colors rounded-lg"
              >
                <Card 
                  image={song.portada || '/default_cover.png'}
                  title={song.titulo}
                  subtitle={song.artista}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="text-center text-text-subdued py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4">Buscando...</p>
        </div>
      )}
    </div>
  );
}
