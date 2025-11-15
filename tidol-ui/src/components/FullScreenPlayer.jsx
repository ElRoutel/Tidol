// FullScreenPlayer.jsx
import React, { useState, useEffect, useRef } from 'react';
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
    toggleLike,
    isSongLiked,
  } = usePlayer();

  const [showLyrics, setShowLyrics] = useState(false);
  const [lyrics, setLyrics] = useState([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [mounted, setMounted] = useState(false);
  const lyricsContainerRef = useRef(null);

  const [bestCover, setBestCover] = useState(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Portada HD desde backend si existe identifier
  useEffect(() => {
    let mounted = true;
    if (!currentSong?.identifier) {
      setBestCover(currentSong?.portada || null);
      return;
    }
    const fetchBestCover = async () => {
      try {
        const res = await api.get(`/music/getCover/${currentSong.identifier}`);
        if (mounted && res.data?.portada) {
          setBestCover(res.data.portada);
        } else if (mounted) {
          setBestCover(currentSong.portada || null);
        }
      } catch (err) {
        console.error("Error al obtener portada desde el backend:", err);
        if (mounted) setBestCover(currentSong.portada || null);
      }
    };
    fetchBestCover();
    return () => { mounted = false; };
  }, [currentSong]);

  const handlers = useSwipeable({
    onSwipedLeft: () => !isAnimating && nextSong(),
    onSwipedRight: () => !isAnimating && previousSong(),
    onSwipedDown: () => !isAnimating && handleClose(),
    preventScrollOnSwipe: true,
    trackMouse: true,
  });

  // Cargar lyrics (si están disponibles). No hacemos fetch si no se pidió showLyrics.
  useEffect(() => {
    if (!currentSong || !showLyrics) return;

    // si el objeto ya tiene `lyrics` o `lyricsLoaded` podríamos usarlo; si no hacemos fetch
    let mounted = true;
    setLyrics([]);

    const fetchLyrics = async () => {
      try {
        // si tenemos identifier (IA) quizás las letras no existan en endpoint local, pero dejamos lógica simple:
        const id = currentSong.id || currentSong.identifier;
        const res = await api.get(`/music/songs/${id}/lyrics`);
        if (!mounted) return;
        const payload = res.data;
        if (payload?.success && Array.isArray(payload.lyrics)) {
          setLyrics(payload.lyrics);
        } else if (Array.isArray(payload)) {
          setLyrics(payload);
        } else {
          setLyrics([]);
        }
      } catch (err) {
        console.error("Error cargando letras:", err);
        if (mounted) setLyrics([]);
      }
    };

    fetchLyrics();
    return () => { mounted = false; };
  }, [currentSong, showLyrics]);

  // Calcular currentLineIndex de forma segura
  const currentLineIndex = (() => {
    if (!lyrics || lyrics.length === 0) return -1;
    try {
      const nowMs = (currentTime || 0) * 1000;
      for (let i = 0; i < lyrics.length; i++) {
        const lineTime = Number(lyrics[i].time_ms || lyrics[i].time || 0);
        const nextLineTime = i + 1 < lyrics.length ? Number(lyrics[i + 1].time_ms || lyrics[i + 1].time || Infinity) : Infinity;
        if (nowMs >= lineTime && nowMs < nextLineTime) return i;
      }
      return lyrics.length - 1;
    } catch (e) {
      return -1;
    }
  })();

  // Auto-scroll a la línea activa
  useEffect(() => {
    if (!lyricsContainerRef.current) return;
    const activeLine = lyricsContainerRef.current.querySelector('.fsp-active');
    if (activeLine) {
      const container = lyricsContainerRef.current;
      const offset = Math.max(0, activeLine.offsetTop - container.clientHeight / 2 + activeLine.clientHeight / 2);
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
    setShowLyrics(prev => !prev);
    setTimeout(() => setIsAnimating(false), 400);
  };

  if (!currentSong) return null;

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleToggleLike = () => {
    if (!currentSong) return;
    
    // Pasamos todos los datos de la canción al contexto
    toggleLike(currentSong.id, {
      // Datos para identificar la canción
      identifier: currentSong.identifier,
      source: currentSong.source,
      
      // Datos para GUARDAR si la canción no existe en la DB
      titulo: currentSong.titulo,
      artista: currentSong.artista,
      url: currentSong.url,           // <-- AÑADIDO
      portada: currentSong.portada,   // <-- AÑADIDO
      duration: currentSong.duration  // <-- AÑADIDO
    });
  };
  const liked = currentSong ? isSongLiked(currentSong.id) : false;

  return (
    <>
      {!showLyrics ? (
        <div
          {...handlers}
          className={`fsp-container fixed inset-0 bg-black bg-opacity-90 backdrop-blur-xl z-[9999] flex flex-col text-white p-4 pb-20 md:pb-4 transition-all duration-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full'}`}
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
                src={bestCover || currentSong.portada || '/default_cover.png'}
                alt="cover"
                className="w-full h-full object-cover transition-all duration-[20s] ease-linear hover:scale-110"
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
                aria-label="Like"
              >
                {liked ? <IoHeart size={30} color="red" /> : <IoHeartOutline size={30} />}
              </button>

              <button
                onClick={previousSong}
                className="text-white/80 hover:text-white transition-all duration-200 hover:scale-110 active:scale-95"
                aria-label="Previous"
              >
                <IoPlaySkipBackSharp size={32} />
              </button>

              <button
                onClick={togglePlayPause}
                className="bg-white text-black rounded-full p-4 shadow-lg hover:shadow-white/50 hover:scale-110 active:scale-95 transition-all duration-200"
                aria-label="PlayPause"
              >
                {isPlaying ? <IoPauseSharp size={40} /> : <IoPlaySharp size={40} />}
              </button>

              <button
                onClick={nextSong}
                className="text-white/80 hover:text-white transition-all duration-200 hover:scale-110 active:scale-95"
                aria-label="Next"
              >
                <IoPlaySkipForwardSharp size={32} />
              </button>

              <button
                onClick={handleToggleLyrics}
                className="text-white/80 hover:text-white transition-all duration-200 hover:scale-110 active:scale-95"
                aria-label="Lyrics"
              >
                <IoText size={28} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          {...handlers}
          className={`fsp-lyrics-container fixed inset-0 z-[9999] bg-black bg-opacity-90 backdrop-blur-xl flex flex-col text-white p-4 pb-20 md:pb-4 transition-all duration-400 ${showLyrics && !isAnimating ? 'opacity-100' : 'opacity-0'}`}
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
      )}
    </>
  );
};

export default FullScreenPlayer;
