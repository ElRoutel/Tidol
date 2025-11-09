
import React, { useContext } from 'react';
import './FullScreenPlayer.css';
import { usePlayer } from '../context/PlayerContext';
import { useSwipeable } from 'react-swipeable';
import {
  IoPlaySharp,
  IoPauseSharp,
  IoPlaySkipBackSharp,
  IoPlaySkipForwardSharp,
  IoChevronDown,
} from 'react-icons/io5';

const FullScreenPlayer = () => {
  const {
    currentSong,
    isPlaying,
    progress,
    duration,
    currentTime,
    togglePlayPause,
    nextSong,
    previousSong,
    seek,
    closeFullScreenPlayer, // Asumo que esta función existirá en el contexto
  } = usePlayer();

  const handlers = useSwipeable({
    onSwipedLeft: () => nextSong(),
    onSwipedRight: () => previousSong(),
    preventScrollOnSwipe: true,
    trackMouse: true,
  });

  if (!currentSong) return null;

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="fixed top-0 left-0 right-0 bottom-[60px] bg-black bg-opacity-90 backdrop-blur-xl z-50 flex flex-col text-white p-4">
      {/* Botón para cerrar */}
      <div className="absolute top-4 left-4">
        <button onClick={closeFullScreenPlayer} className="text-white/70 hover:text-white">
          <IoChevronDown size={32} />
        </button>
      </div>

      {/* Contenido del reproductor */}
      <div {...handlers} className="flex-grow flex flex-col items-center justify-center text-center pt-10">
        {/* Portada */}
        <div className="relative w-full max-w-md aspect-square shadow-2xl shadow-black/50 rounded-lg overflow-hidden">
          <img
            src={currentSong.portada || 'https://via.placeholder.com/500'}
            alt="Portada del álbum"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Información de la canción */}
        <div className="mt-8">
          <h2 className="text-2xl font-bold tracking-tight">{currentSong.titulo || 'Canción Desconocida'}</h2>
          {currentSong.artista && <p className="text-lg text-white/70 mt-1">{currentSong.artista}</p>}
          {currentSong.album && <p className="text-sm text-white/50 mt-1">{currentSong.album}</p>}
        </div>
      </div>

      {/* Controles y barra de progreso */}
      <div className="w-full max-w-md mx-auto pb-6">
        {/* Barra de progreso */}
        <div className="w-full group">
          <input
            type="range"
            min="0"
            max={duration || 100}
            value={currentTime}
            onChange={(e) => seek(Number(e.target.value))}
            className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer group-hover:h-2 transition-all"
            style={{ backgroundSize: `${progress}% 100%` }}
          />
          <div className="flex justify-between text-xs text-white/50 mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Botones de control */}
        <div className="flex items-center justify-center space-x-8 mt-4">
          <button onClick={previousSong} className="text-white/80 hover:text-white transition-colors">
            <IoPlaySkipBackSharp size={32} />
          </button>
          <button
            onClick={togglePlayPause}
            className="bg-white text-black rounded-full p-4 shadow-lg hover:scale-105 transition-transform"
          >
            {isPlaying ? <IoPauseSharp size={40} /> : <IoPlaySharp size={40} />}
          </button>
          <button onClick={nextSong} className="text-white/80 hover:text-white transition-colors">
            <IoPlaySkipForwardSharp size={32} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default FullScreenPlayer;
