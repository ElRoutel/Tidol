import React, { useState, useEffect } from 'react';
import { usePlayer } from '../context/PlayerContext';
import Shelf from '../components/HomeShelf';
import AlbumCard from '../components/AlbumCard';
import SongShelfCard from '../components/cards/SongShelfCard';
import SongGridCard from '../components/cards/SongGridCard';
import api from '../api/axiosConfig';
import './HomePage.css';

// Función para barajar un array (algoritmo de Fisher-Yates)
const shuffleArray = (array) => {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
};

export default function HomePage() {
  const { playSongList } = usePlayer();
  const [quickPicks, setQuickPicks] = useState([]);

  // Cargar datos para la sección rápida
  useEffect(() => {
    const fetchQuickPicks = async () => {
      try {
        const [historyRes, recsRes] = await Promise.all([
          api.get('/history'),
          api.get('/music/home-recommendations')
        ]);
        const combined = [...(historyRes.data?.slice(0, 6) || []), ...(recsRes.data?.slice(0, 6) || [])];
        setQuickPicks(shuffleArray(combined));
      } catch (error) {
        console.error("Error cargando la sección rápida:", error);
      }
    };
    fetchQuickPicks();
  }, []);

  const handlePlaySong = (song, index, songList) => {
    const playlist = songList.slice(index);
    playSongList(playlist, 0);
  };

  return (
    <div className="tidol-home-container">
      {/* Header con glassmorphism */}
      <div className="tidol-home-header glass-card tidol-fade-in">
        <h1 className="tidol-home-title">Inicio</h1>
        <p className="tidol-home-subtitle">Tu música, siempre contigo</p>
      </div>

      {/* Shelves con animaciones escalonadas */}
      <div className="tidol-home-content">
        {/* Nueva Sección Rápida en formato Grid */}
        {quickPicks.length > 0 && (
          <div className="tidol-shelf-wrapper tidol-slide-up">
            <h2 className="text-3xl font-bold mb-4 text-white">Selección rápida</h2>
            <div className="quick-picks-grid">
              {quickPicks.slice(0, 6).map((song, index, songList) => (
                <SongGridCard
                  key={song.id || `${song.identifier}-${index}`}
                  song={song}
                  onPlay={() => handlePlaySong(song, index, songList)}
                />
              ))}
            </div>
          </div>
        )}

        <div className="tidol-shelf-wrapper tidol-slide-up">
          <Shelf
            title="Escuchado Recientemente"
            endpoint="/history"
            renderItem={(song, index, songList) => (
              <SongShelfCard 
                key={song.id}
                song={song}
                onPlay={() => handlePlaySong(song, index, songList)}
              />
            )}
          />
        </div>

        <div className="tidol-shelf-wrapper tidol-slide-up">
          <Shelf
            title="Para ti"
            endpoint="/music/home-recommendations"
            renderItem={(song, index, songList) => (
              <SongShelfCard
                key={song.id}
                song={song}
                onPlay={() => handlePlaySong(song, index, songList)}
              />
            )}
          />
        </div>

        <div className="tidol-shelf-wrapper tidol-slide-up">
          <Shelf
            title="Álbumes Populares"
            endpoint="/music/albums"
            renderItem={(album, index) => (
              <AlbumCard key={album.id} album={album} />
            )}
          />
        </div>
      </div>
    </div>
  );
}
