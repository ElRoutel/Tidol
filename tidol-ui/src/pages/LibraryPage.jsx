import React, { useState } from 'react';
import { usePlayer } from '../context/PlayerContext';

const dummySongs = [
  { id: '1', titulo: 'Canción 1', artista: 'Artista A', album: 'Álbum X', portada: '/default_cover.png' },
  { id: '2', titulo: 'Canción 2', artista: 'Artista B', album: 'Álbum Y', portada: '/default_cover.png' },
  { id: '3', titulo: 'Canción 3', artista: 'Artista C', album: 'Álbum Z', portada: '/default_cover.png' },
];

export default function LibraryPage() {
  const { playSongList } = usePlayer();
  const [search, setSearch] = useState('');

  const filteredSongs = dummySongs.filter(
    s => s.titulo.toLowerCase().includes(search.toLowerCase()) ||
         s.artista.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Mi Librería (Esto es prueba )</h1>

      <input
        type="text"
        placeholder="Buscar canciones o artistas..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full mb-6 p-2 border rounded bg-background border-interactive-bg text-text"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {filteredSongs.map((song) => (
          <div
            key={song.id}
            className="bg-zinc-900 p-4 rounded-lg cursor-pointer hover:scale-105 transform transition"
            onClick={() => playSongList([song], 0)}
          >
            <img src={song.portada} alt={song.titulo} className="w-full h-40 object-cover rounded mb-2" />
            <div>
              <h2 className="text-lg font-semibold">{song.titulo}</h2>
              <p className="text-sm text-gray-400">{song.artista}</p>
              <p className="text-xs text-gray-500">{song.album}</p>
            </div>
          </div>
        ))}

        {filteredSongs.length === 0 && (
          <p className="text-gray-400 col-span-full text-center mt-10">No se encontraron canciones.</p>
        )}
      </div>
    </div>
  );
}
