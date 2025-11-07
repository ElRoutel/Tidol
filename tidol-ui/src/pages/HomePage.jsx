import React from 'react';
import { usePlayer } from '../context/PlayerContext';

import Shelf from '../components/Shelf';
import AlbumCard from '../components/AlbumCard';
import Card from '../components/Card';

export default function HomePage() {
  const { playSongList } = usePlayer();

  const handlePlaySong = (song, index, songList) => {
    const playlist = songList.slice(index);
    playSongList(playlist, 0);
  };

  return (
    <div className="p-6 bg-gradient-to-b from-emerald-800 to-background">
      <Shelf
        title="Escuchado Recientemente"
        endpoint="/api/history"
        renderItem={(song, index, songList) => (
          <div key={song.id} onClick={() => handlePlaySong(song, index, songList)} className="w-48 flex-shrink-0">
            <Card
              image={song.portada || '/default_cover.png'}
              title={song.titulo}
              subtitle={song.artista}
            />
          </div>
        )}
      />

      <Shelf
        title="Recomendaciones para ti"
        endpoint="/api/music/home-recommendations"
        renderItem={(song, index, songList) => (
          <div key={song.id} onClick={() => handlePlaySong(song, index, songList)} className="w-48 flex-shrink-0">
            <Card
              image={song.portada || '/default_cover.png'}
              title={song.titulo}
              subtitle={song.artista}
            />
          </div>
        )}
      />

      <Shelf
        title="Álbumes Populares"
        endpoint="/api/music/albums"
        renderItem={(album) => (
          <AlbumCard key={album.id} album={album} />
        )}
      />
    </div>
  );
}