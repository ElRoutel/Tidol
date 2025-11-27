import React, { useState, useEffect, useRef } from 'react';
// import ReactDOM from 'react-dom'; // Ya no se usa Portal aquí
import './FullScreenPlayer.css';
import './FullScreenPlayerLyrics.css';
import { motion, Reorder } from 'framer-motion';
import { usePlayer } from '../context/PlayerContext';
import useSpectraSync from '../hooks/useSpectraSync';
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
  IoHeartOutline,
  IoList,
  IoReorderTwo
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
    originalQueue,
    currentIndex,
    playSongList,
    reorderQueue,
    spectraData
  } = usePlayer();

  const { fetchLyrics: fetchSpectraLyrics } = useSpectraSync();

  const [showLyrics, setShowLyrics] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
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
      // Reset views when closed
      if (!isFullScreenOpen) {
        setShowLyrics(false);
        setShowQueue(false);
      }
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
      const lyricsData = await fetchSpectraLyrics();
      setLyrics(lyricsData);
    } catch (error) {
      console.error('Error fetching lyrics:', error);
      setLyrics([]);
    }
  };



  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 768);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth > 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const swipeHandlers = useSwipeable({
    onSwipedDown: () => {
      if (!isEmbedded) closeFullScreenPlayer(); // Solo cerrar con swipe si no es embedded (o manejar lógica embedded)
      if (isEmbedded) closeFullScreenPlayer();
    },
    preventDefaultTouchmoveEvent: true,
    trackMouse: true
  });

  const handlers = isDesktop ? {} : swipeHandlers;

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
      if (!showLyrics) setShowQueue(false); // Close queue if opening lyrics
      setIsAnimating(false);
    }, 300);
  };

  const handleToggleQueue = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setShowQueue(!showQueue);
      if (!showQueue) setShowLyrics(false); // Close lyrics if opening queue
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

          {/* Spectra Metadata */}
          <div className="flex justify-center gap-4 text-sm text-white/60 mt-3 font-mono">
            {spectraData?.bpm && (
              <span className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded-full">
                🎵 {Math.round(spectraData.bpm)} BPM
              </span>
            )}
            {spectraData?.key && (
              <span className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded-full">
                🎹 {spectraData.key}
              </span>
            )}
          </div>
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

          <button
            onClick={handleToggleQueue}
            className="text-white/80 hover:text-white transition-all duration-200 hover:scale-110 active:scale-95"
          >
            <IoList size={28} />
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
              {line.text}
            </p>
          ))
        )}
      </div>
    </div>
  );

  const queueContent = (
    <div
      {...handlers}
      className={`fsp-lyrics-container ${isEmbedded ? 'absolute w-full h-full' : 'fixed'} inset-0 z-[9999] bg-black bg-opacity-90 backdrop-blur-xl flex flex-col text-white p-4 pb-20 md:pb-4 transition-all duration-400 ${showQueue && !isAnimating ? 'opacity-100' : 'opacity-0'}`}
    >
      <div className={`absolute top-4 left-4 transition-all duration-500 ${showQueue && !isAnimating ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}>
        <button
          onClick={handleToggleQueue}
          className="text-white/70 hover:text-white transition-all duration-200 hover:scale-110 active:scale-95"
        >
          <IoChevronDown size={32} />
        </button>
      </div>

      <div className={`fsp-lyrics-content transition-all duration-500 delay-100 ${showQueue && !isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <h2 className="text-2xl font-bold mb-6 text-center">Cola de Reproducción</h2>
        <div className="space-y-2 overflow-y-auto max-h-[70vh] px-2">
          {originalQueue.length === 0 ? (
            <p className="text-center text-white/50">La cola está vacía</p>
          ) : (
            <Reorder.Group axis="y" values={originalQueue} onReorder={reorderQueue} className="space-y-2">
              {originalQueue.map((song) => (
                <Reorder.Item key={song.id} value={song}>
                  <div
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-grab active:cursor-grabbing transition-colors ${song.id === currentSong?.id
                      ? 'bg-white/20 border border-white/10'
                      : 'bg-white/5 hover:bg-white/10'
                      }`}
                  >
                    <div className="text-white/50 cursor-grab active:cursor-grabbing">
                      <IoReorderTwo size={20} />
                    </div>
                    <div
                      className="flex-1 flex items-center gap-3 min-w-0 cursor-pointer"
                      onClick={() => {
                        const index = originalQueue.findIndex(s => s.id === song.id);
                        if (index !== -1) {
                          playSongList(originalQueue, index);
                          handleToggleQueue();
                        }
                      }}
                    >
                      <img
                        src={song.portada || '/default_cover.png'}
                        alt={song.titulo}
                        className="w-12 h-12 rounded object-cover pointer-events-none"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium truncate ${song.id === currentSong?.id ? 'text-white' : 'text-white/90'}`}>
                          {song.titulo}
                        </p>
                        <p className="text-sm text-white/60 truncate">
                          {song.artista}
                        </p>
                      </div>
                      {song.id === currentSong?.id && (
                        <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)]"></div>
                      )}
                    </div>
                  </div>
                </Reorder.Item>
              ))}
            </Reorder.Group>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {!showLyrics && !showQueue ? playerContent : (showLyrics ? lyricsContent : queueContent)}
    </>
  );
};

export default FullScreenPlayer;