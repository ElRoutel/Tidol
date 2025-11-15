import React from 'react';
import { usePlayer } from '../context/PlayerContext';
import Shelf from '../components/HomeShelf';
import AlbumCard from '../components/AlbumCard';
import Card from '../components/Card';
import './HomePage.css';
export default function HomePage() {
  const { playSongList } = usePlayer();

  const handlePlaySong = (song, index, songList) => {
    const playlist = songList.slice(index);
    playSongList(playlist, 0);
  };

  return (
    <div className="tidol-home-container">
      {/* Header con glassmorphism */}
      <div className="tidol-home-header tidol-fade-in">
        <h1 className="tidol-home-title">Inicio</h1>
        <p className="tidol-home-subtitle">Tu música, siempre contigo</p>
      </div>

      {/* Shelves con animaciones escalonadas */}
      <div className="tidol-home-content">
        <div className="tidol-shelf-wrapper tidol-slide-up" style={{ animationDelay: '0.1s' }}>
          <Shelf
            title="Escuchado Recientemente"
            endpoint="/history"
            renderItem={(song, index, songList) => (
              <div 
                key={song.id} 
                onClick={() => handlePlaySong(song, index, songList)} 
                className="tidol-card-item"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <Card
                  image={song.portada || '/default_cover.png'}
                  title={song.titulo}
                  subtitle={song.artista}
                />
              </div>
            )}
          />
        </div>

        <div className="tidol-shelf-wrapper tidol-slide-up" style={{ animationDelay: '0.2s' }}>
          <Shelf
            title="Para ti"
            endpoint="/music/home-recommendations"
            renderItem={(song, index, songList) => (
              <div 
                key={song.id} 
                onClick={() => handlePlaySong(song, index, songList)} 
                className="tidol-card-item"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <Card
                  image={song.portada || '/default_cover.png'}
                  title={song.titulo}
                  subtitle={song.artista}
                />
              </div>
            )}
          />
        </div>

        <div className="tidol-shelf-wrapper tidol-slide-up" style={{ animationDelay: '0.3s' }}>
          <Shelf
            title="Álbumes Populares"
            endpoint="/music/albums"
            renderItem={(album, index) => (
              <div 
                key={album.id} 
                className="tidol-card-item"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <AlbumCard album={album} />
              </div>
            )}
          />
        </div>
      </div>
    </div>
  );
}
