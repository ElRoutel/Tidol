import React, { useState, useEffect, useRef } from 'react';
// import ReactDOM from 'react-dom'; // Ya no se usa Portal aquí
import './FullScreenPlayer.css';
import './FullScreenPlayerLyrics.css';
import { usePlayer } from '../context/PlayerContext';
import { useSwipeable } from 'react-swipeable';
import api from '../api/axiosConfig';
import {
  IoPlaySharp,
  IoPauseSharp,
  IoPlaySkipBackSharp,
  IoPlaySkipForwardSharp,
  IoChevronDown,
  IoText,
  IoHeart,
  IoHeartOutline
} from 'react-icons/io5';

const FullScreenPlayer = ({ isEmbedded = false }) => {
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
    closeFullScreenPlayer,
    toggleLike,
    isSongLiked,
  } = usePlayer();

  const [showLyrics, setShowLyrics] = useState(false);
  const [lyrics, setLyrics] = useState([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [mounted, setMounted] = useState(false);
  const lyricsContainerRef = useRef(null);
  const [currentLineIndex, setCurrentLineIndex] = useState(-1);

  // 1. INICIALIZACIÓN: Usamos la portada que ya tenemos (la correcta)
  const [bestCover, setBestCover] = useState(currentSong?.portada || null);

  // Sync mounted state with visibility when embedded
  const { isFullScreenOpen } = usePlayer();

  useEffect(() => {
    if (isEmbedded) {
      // When embedded, sync mounted directly with isFullScreenOpen
      setMounted(isFullScreenOpen);
    } else {
      setMounted(true);
    }
  }, [isEmbedded, isFullScreenOpen]);

  // 2. EFECTO: Solo buscamos mejor calidad si la actual parece ser de baja resolución
  // o si queremos asegurar la mejor posible.
  useEffect(() => {
    if (currentSong?.titulo && currentSong?.artista) {
      // Resetear si cambia la canción
      setBestCover(currentSong.portada);
    }
  }, [currentSong?.id]); // Solo si cambia el ID

  useEffect(() => {
    if (showLyrics) {
      fetchLyrics();
    }
  }, [showLyrics, currentSong]);

  const fetchLyrics = async () => {
    try {
      const response = await api.get(`/lyrics?title=${encodeURIComponent(currentSong.titulo)}&artist=${encodeURIComponent(currentSong.artista)}`);
      if (response.data && response.data.lyrics) {
        setLyrics(parseLyrics(response.data.lyrics));
      } else {
        setLyrics([]);
      }
    } catch (error) {
      console.error('Error fetching lyrics:', error);
      setLyrics([]);
    }
  };

  const parseLyrics = (lyricsText) => {
    return lyricsText.split('\n').map((line, index) => ({
      time: 0, // Placeholder, real parsing would need synced lyrics format
      text: line
    }));
  };

  const handlers = useSwipeable({
    onSwipedDown: () => {
      if (!isEmbedded) closeFullScreenPlayer(); // Solo cerrar con swipe si no es embedded (o manejar lógica embedded)
      if (isEmbedded) closeFullScreenPlayer();
    },
    preventDefaultTouchmoveEvent: true,
    trackMouse: true
  });

  const handleClose = () => {
    console.log('Closing FullScreenPlayer via button');
    setMounted(false);
    // Pequeño delay para permitir animación de salida
    setTimeout(() => {
      closeFullScreenPlayer();
    }, 300);
  };

  // Efecto de seguridad: si isFullScreenOpen cambia a false externamente (ej. drag en sheet),
  // asegurar que mounted sea false inmediatamente para evitar estados inconsistentes.
  useEffect(() => {
    if (isEmbedded && !isFullScreenOpen && mounted) {
      setMounted(false);
    }
  }, [isFullScreenOpen, isEmbedded, mounted]);

  const formatTime = (time) => {
    if (!time) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const handleSeek = (e) => {
    const time = Number(e.target.value);
    seek(time);
  };

  const handleToggleLike = () => {
    toggleLike(currentSong.id, {
      id: currentSong.id,
      source: currentSong.source,
      titulo: currentSong.titulo,
      artista: currentSong.artista,
      url: currentSong.url,
      portada: currentSong.portada,
      duration: currentSong.duration
    });
  };

  const handleToggleLyrics = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setShowLyrics(!showLyrics);
      setIsAnimating(false);
    }, 300);
  };

  const liked = currentSong ? isSongLiked(currentSong.id) : false;

  // Usar la mejor portada disponible
  const displayCover = bestCover || currentSong.portada || '/default_cover.png';

  // Si es embedded, renderizamos DIRECTAMENTE en el contenedor padre (PlayerSheet)
  // para que siga la animación de expansión/colapso.
  // Quitamos 'fixed' y usamos 'w-full h-full' o 'absolute inset-0'.

  const containerClass = isEmbedded
    ? `fsp-container w-full h-full absolute inset-0 bg-black bg-opacity-90 backdrop-blur-xl flex flex-col text-white p-4 pb-20 md:pb-4 transition-all duration-300 ${mounted ? 'opacity-100' : 'opacity-0 pointer-events-none'}`
    : `fsp-container fixed inset-0 z-[99999] bg-black bg-opacity-90 backdrop-blur-xl flex flex-col text-white p-4 pb-20 md:pb-4 transition-all duration-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full'}`;

  const playerContent = (
    <div
      {...handlers}
      className={containerClass}
      style={{ pointerEvents: (isEmbedded && !mounted) ? 'none' : 'auto' }}
    >
      <div className={`absolute top-4 left-4 transition-all duration-500 delay-100 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        <button
          onClick={handleClose}
          className="text-white/70 hover:text-white transition-all duration-200 hover:scale-110 active:scale-95"
        >
          <IoChevronDown size={32} />
        </button>
      </div>

      <div className="flex-grow flex flex-col items-center justify-center text-center pt-10">
        <div className={`relative w-full max-w-md aspect-square shadow-2xl shadow-black/50 rounded-lg overflow-hidden transition-all duration-700 delay-200 ${mounted ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-90 rotate-3'}`}>
          <img
            src={displayCover}
            alt="cover"
            className="w-full h-full object-cover transition-all duration-[20s] ease-linear"
          />
        </div>

        <div className={`mt-8 transition-all duration-700 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <h2 className="text-2xl font-bold tracking-tight transition-all duration-300 hover:scale-105">
            {currentSong.titulo || 'Canción Desconocida'}
          </h2>
          {currentSong.artista && (
            <p className="text-lg text-white/70 mt-1 transition-colors duration-300 hover:text-white/90">
              {currentSong.artista}
            </p>
          )}
          {currentSong.album && (
            <p className="text-sm text-white/50 mt-1 transition-colors duration-300 hover:text-white/70">
              {currentSong.album}
            </p>
          )}
        </div>
      </div>

      <div className={`w-full max-w-md mx-auto pb-6 transition-all duration-700 delay-400 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="w-full group">
          <input
            type="range"
            min="0"
            max={duration || 100}
            value={Math.min(currentTime, duration || 100)}
            onChange={(e) => seek(Number(e.target.value))}
            className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer group-hover:h-2 transition-all duration-200"
            style={{
              background: `linear-gradient(to right, white ${isNaN(progress) ? 0 : progress}%, rgba(255,255,255,0.2) ${isNaN(progress) ? 0 : progress}%)`,
            }}
          />
          <div className="flex justify-between text-xs text-white/50 mt-1">
            <span className="transition-colors duration-200 hover:text-white/70">{formatTime(currentTime)}</span>
            <span className="transition-colors duration-200 hover:text-white/70">{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex items-center justify-center space-x-4 mt-4">
          <button
            onClick={handleToggleLike}
            className="text-white/80 hover:text-white transition-all duration-200 hover:scale-110 active:scale-95"
          >
            {liked ? <IoHeart size={30} color="red" /> : <IoHeartOutline size={30} />}
          </button>

          <button
            onClick={previousSong}
            className="text-white/80 hover:text-white transition-all duration-200 hover:scale-110 active:scale-95"
          >
            <IoPlaySkipBackSharp size={32} />
          </button>

          <button
            onClick={togglePlayPause}
            className="bg-white text-black rounded-full p-4 shadow-lg hover:shadow-white/50 hover:scale-110 active:scale-95 transition-all duration-200"
          >
            {isPlaying ? <IoPauseSharp size={40} /> : <IoPlaySharp size={40} />}
          </button>

          <button
            onClick={nextSong}
            className="text-white/80 hover:text-white transition-all duration-200 hover:scale-110 active:scale-95"
          >
            <IoPlaySkipForwardSharp size={32} />
          </button>

          <button
            onClick={handleToggleLyrics}
            className="text-white/80 hover:text-white transition-all duration-200 hover:scale-110 active:scale-95"
          >
            <IoText size={28} />
          </button>
        </div>
      </div>
    </div>
  );

  const lyricsContent = (
    <div
      {...handlers}
      className={`fsp-lyrics-container ${isEmbedded ? 'absolute w-full h-full' : 'fixed'} inset-0 z-[9999] bg-black bg-opacity-90 backdrop-blur-xl flex flex-col text-white p-4 pb-20 md:pb-4 transition-all duration-400 ${showLyrics && !isAnimating ? 'opacity-100' : 'opacity-0'}`}
    >
      <div className={`absolute top-4 left-4 transition-all duration-500 ${showLyrics && !isAnimating ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}>
        <button
          onClick={handleToggleLyrics}
          className="text-white/70 hover:text-white transition-all duration-200 hover:scale-110 active:scale-95"
        >
          <IoChevronDown size={32} />
        </button>
      </div>

      <div
        ref={lyricsContainerRef}
        className={`fsp-lyrics-content transition-all duration-500 delay-100 ${showLyrics && !isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      >
        {lyrics.length === 0 ? (
          <p className="text-center text-white/50 mt-10 animate-pulse">
            No hay letras disponibles
          </p>
        ) : (
          lyrics.map((line, i) => (
            <p
              key={i}
              className={`fsp-lyric-line transition-all duration-300 ${i === currentLineIndex ? 'fsp-active' : ''}`}
              style={{ transitionDelay: `${i * 20}ms` }}
            >
              {line.line}
            </p>
          ))
        )}
      </div>
    </div>
  );

  return (
    <>
      {!showLyrics ? playerContent : lyricsContent}
    </>
  );
};

export default FullScreenPlayer;