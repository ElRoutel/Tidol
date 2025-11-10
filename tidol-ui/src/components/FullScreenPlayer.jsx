// FullScreenPlayer.jsx
import React, { useState, useEffect, useRef } from 'react';
import './FullScreenPlayer.css';
import './FullScreenPlayerLyrics.css';
import { usePlayer } from '../context/PlayerContext';
import { useSwipeable } from 'react-swipeable';
import api from '../api/axiosConfig'; // ✅ AGREGAR ESTA IMPORTACIÓN
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
    closeFullScreenPlayer,
    toggleLike,      // ✅ Mejor opción: usar el del context
    isSongLiked,     // ✅ Mejor opción: usar el del context
  } = usePlayer();

  const [showLyrics, setShowLyrics] = useState(false);
  const [lyrics, setLyrics] = useState([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [mounted, setMounted] = useState(false);
  const lyricsContainerRef = useRef(null);

  // ======= NUEVO: MANEJO DE PORTADA HD =======
  const [bestCover, setBestCover] = useState(null);

  useEffect(() => {
    // Si la canción no es de IA, no hacemos nada especial.
    if (!currentSong?.identifier) {
      setBestCover(null); // Resetea por si la canción anterior sí tenía
      return;
    }

    const fetchBestCover = async () => {
      try {
        const res = await api.get(`/music/getCover/${currentSong.identifier}`);
        if (res.data?.portada) {
          setBestCover(res.data.portada);
          console.log("✅ Portada HD desde backend:", res.data.portada);
        }
      } catch (err) {
        console.error("Error al obtener portada desde el backend:", err);
        // En caso de error, usamos la portada de baja calidad que ya tiene la canción
        setBestCover(currentSong.portada);
      }
    };

    fetchBestCover();
  }, [currentSong]);
  // ===========================================

  const handlers = useSwipeable({
    onSwipedLeft: () => !isAnimating && nextSong(),
    onSwipedRight: () => !isAnimating && previousSong(),
    onSwipedDown: () => !isAnimating && handleClose(),
    preventScrollOnSwipe: true,
    trackMouse: true,
  });

  // Animación de entrada
  useEffect(() => {
    setMounted(true);
  }, []);

  // Cargar letras - ✅ CAMBIAR A API
  useEffect(() => {
    if (!currentSong || !showLyrics) return;
    
    // ✅ Solo buscar letras si la canción NO es de Internet Archive
    if (currentSong.identifier) {
      setLyrics([]); // Limpiamos por si había letras de una canción anterior
      return;
    }
    api.get(`/music/songs/${currentSong.id}/lyrics`) // ✅ Usar api en lugar de fetch
      .then((res) => {
        if (res.data.success && res.data.lyrics) {
          setLyrics(res.data.lyrics);
        } else {
          setLyrics([]);
        }
      })
      .catch((err) => {
        console.error("Error cargando letras:", err);
        setLyrics([]);
      });
  }, [currentSong, showLyrics]);

  const currentLineIndex = lyrics.findIndex(
    (line, i) =>
      currentTime * 1000 >= line.time_ms &&
      (i === lyrics.length - 1 || currentTime * 1000 < lyrics[i + 1].time_ms)
  );

  // Scroll suave de letras
  useEffect(() => {
    if (!lyricsContainerRef.current) return;
    const activeLine = lyricsContainerRef.current.querySelector('.active');
    if (activeLine) {
      const container = lyricsContainerRef.current;
      const offset = activeLine.offsetTop - container.offsetHeight / 2 + activeLine.offsetHeight / 2;
      container.scrollTo({ top: offset, behavior: 'smooth' });
    }
  }, [currentLineIndex]);

  const handleClose = () => {
    setMounted(false);
    setTimeout(() => closeFullScreenPlayer(), 300);
  };

  const handleToggleLyrics = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setShowLyrics(!showLyrics);
    setTimeout(() => setIsAnimating(false), 400);
  };

  if (!currentSong) return null;

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // ✅ OPCIÓN 1: Usar el toggleLike del context (RECOMENDADO)
  const handleToggleLike = () => {
    if (currentSong) {
      toggleLike(currentSong.id);
    }
  };

  // Obtener el estado del like desde el context
  const liked = currentSong ? isSongLiked(currentSong.id) : false;

  return (
    <>
      {!showLyrics ? (
        <div
          {...handlers}
          className={`fixed inset-0 bg-black bg-opacity-90 backdrop-blur-xl z-50 flex flex-col text-white p-4 pb-20 md:pb-4 transition-all duration-300 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full'
          }`}
        >
          {/* Header con botón de cerrar */}
          <div className={`absolute top-4 left-4 transition-all duration-500 delay-100 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
          }`}>
            <button
              onClick={handleClose}
              className="text-white/70 hover:text-white transition-all duration-200 hover:scale-110 active:scale-95"
            >
              <IoChevronDown size={32} />
            </button>
          </div>

          {/* Contenido principal */}
          <div className="flex-grow flex flex-col items-center justify-center text-center pt-10">
            {/* Portada del álbum */}
            <div className={`relative w-full max-w-md aspect-square shadow-2xl shadow-black/50 rounded-lg overflow-hidden transition-all duration-700 delay-200 ${
              mounted ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-90 rotate-3'
            }`}>
              <img
                src={bestCover || currentSong.portada || '/default_cover.png'}
                alt="cover"
                className="w-full h-full object-cover transition-all duration-[20s] ease-linear hover:scale-110"
              />
            </div>

            {/* Información de la canción */}
            <div className={`mt-8 transition-all duration-700 delay-300 ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}>
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

          {/* Controles */}
          <div className={`w-full max-w-md mx-auto pb-6 transition-all duration-700 delay-400 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}>
            {/* Barra de progreso */}
            <div className="w-full group">
              <input
                type="range"
                min="0"
                max={duration || 100}
                value={currentTime}
                onChange={(e) => seek(Number(e.target.value))}
                className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer group-hover:h-2 transition-all duration-200"
                style={{
                  background: `linear-gradient(to right, white ${progress}%, rgba(255,255,255,0.2) ${progress}%)`,
                }}
              />
              <div className="flex justify-between text-xs text-white/50 mt-1">
                <span className="transition-colors duration-200 hover:text-white/70">{formatTime(currentTime)}</span>
                <span className="transition-colors duration-200 hover:text-white/70">{formatTime(duration)}</span>
              </div>
            </div>

            <div className="flex items-center justify-center space-x-4 mt-4">
              {/* ❤️ Botón Like */}
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
      ) : (
        <div
          {...handlers}
          className={`fixed inset-0 z-50 bg-black bg-opacity-90 backdrop-blur-xl flex flex-col text-white p-4 pb-20 md:pb-4 transition-all duration-400 ${
            showLyrics && !isAnimating ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {/* Header de letras */}
          <div className={`absolute top-4 left-4 transition-all duration-500 ${
            showLyrics && !isAnimating ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
          }`}>
            <button
              onClick={handleToggleLyrics}
              className="text-white/70 hover:text-white transition-all duration-200 hover:scale-110 active:scale-95"
            >
              <IoChevronDown size={32} />
            </button>
          </div>

          {/* Contenedor de letras */}
          <div
            ref={lyricsContainerRef}
            className={`lyrics-container transition-all duration-500 delay-100 ${
              showLyrics && !isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
          >
            {lyrics.length === 0 ? (
              <p className="text-center text-white/50 mt-10 animate-pulse">
                No hay letras disponibles
              </p>
            ) : (
              lyrics.map((line, i) => (
                <p
                  key={i}
                  className={`lyric-line transition-all duration-300 ${
                    i === currentLineIndex ? 'active' : ''
                  }`}
                  style={{
                    transitionDelay: `${i * 20}ms`,
                  }}
                >
                  {line.line}
                </p>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default FullScreenPlayer;
