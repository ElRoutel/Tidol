// src/pages/SearchPage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import { usePlayer } from '../context/PlayerContext';

// 1. Importamos todos nuestros componentes de UI reutilizables
import SearchInput from '../components/SearchInput';
import Shelf from '../components/Shelf';
import ArtistCard from '../components/ArtistCard';
import AlbumCard from '../components/AlbumCard';
import IaAlbumCard from '../components/IaAlbumCard';
import Card from '../components/Card'; // Para las canciones

export function SearchPage() {
  // --- La lógica de estado se mantiene casi igual ---
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

  // --- La lógica de búsqueda se adapta para recibir el 'query' del componente ---
  const handleSearch = async (query) => {
    if (!query) return;

    setLoading(true);
    setInitialSearch(false);
    setResults({ canciones: [], albums: [], artists: [], archive: [] });

    try {
      const localRes = await api.get(`/music/search?q=${query}`);
      setResults(prev => ({ ...prev, ...localRes.data }));
    } catch (err) {
      console.error('Error en la búsqueda local:', err);
    } finally {
      setLoading(false); 
    }

    try {
      const archiveRes = await api.get(`/music/searchArchive?q=${query}`);
      setResults(prev => ({ ...prev, archive: archiveRes.data || [] }));
    } catch (err) {
      console.error('Error en la búsqueda de IA:', err);
    }
  };

  // --- El JSX es ahora mucho más limpio y declarativo ---
  return (
    <div className="p-6 bg-background min-h-full">
      <div className="mb-8">
        <SearchInput onSearch={handleSearch} loading={loading} />
      </div>

      {initialSearch && (
        <div className="text-center text-text-subdued">
          <p>Busca tus canciones, álbumes o artistas favoritos.</p>
        </div>
      )}

      {!loading && !initialSearch && Object.values(results).every(arr => arr.length === 0) && (
        <div className="text-center text-text-subdued">
          <p>No se encontraron resultados.</p>
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
        <Shelf title="De Internet Archive">
          {results.archive.map((item, index) => (
            <IaAlbumCard key={item.identifier || index} album={item} />
          ))}
        </Shelf>
      )}

      {results.canciones.length > 0 && (
        <div>
            <h2 className="text-2xl font-bold text-text mb-4">Canciones</h2>
            <div className="flex flex-col gap-2">
                {results.canciones.map((song, index) => (
                    <div key={song.id} onClick={() => playSongList(results.canciones, index)} className="w-full">
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
    </div>
  );
}
