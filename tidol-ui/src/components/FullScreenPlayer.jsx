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
  }, [showLyrics, currentSong?.id]); // Solo depende del ID, no del objeto completo

  // Ref to track polling interval and prevent multiple fetches
  const pollingIntervalRef = useRef(null);
  const isFetchingRef = useRef(false);

  const fetchLyrics = async () => {
    // Prevent multiple simultaneous fetches
    if (isFetchingRef.current) {
      console.log('[Lyrics] Already fetching, skipping...');
      return;
    }

    // Clear any existing polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    const MAX_RETRIES = 20; // 20 retries x 6 seconds = 2 minutes max
    const RETRY_DELAY = 6000; // 6 seconds between retries
    let retryCount = 0;

    const pollLyrics = async () => {
      try {
        const lyricsData = await fetchSpectraLyrics();

        if (lyricsData && lyricsData.length > 0) {
          setLyrics(lyricsData);
          console.log(`[Lyrics] ✅ Loaded successfully after ${retryCount} retries`);
          return true; // Success
        } else {
          // Empty response, lyrics might still be generating
          return false;
        }
      } catch (error) {
        // 404 means lyrics not ready yet, keep trying
        if (error.message.includes('404')) {
          return false;
        }
        // Other errors, stop retrying
        console.error('Error fetching lyrics:', error);
        throw error;
      }
    };

    try {
      isFetchingRef.current = true;
      setLyrics([]); // Reset to show loading state

      // First attempt
      const success = await pollLyrics();
      if (success) {
        isFetchingRef.current = false;
        return;
      }

      // Start polling
      console.log('[Lyrics] Not ready yet, starting polling...');

      pollingIntervalRef.current = setInterval(async () => {
        retryCount++;

        if (retryCount >= MAX_RETRIES) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
          isFetchingRef.current = false;
          console.log('[Lyrics] ⏱️ Timeout: Lyrics generation took too long');
          setLyrics([]); // Give up
          return;
        }

        console.log(`[Lyrics] Polling attempt ${retryCount}/${MAX_RETRIES}...`);

        try {
          const success = await pollLyrics();
          if (success) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
            isFetchingRef.current = false;
          }
        } catch (error) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
          isFetchingRef.current = false;
          setLyrics([]);
        }
      }, RETRY_DELAY);

    } catch (error) {
      console.error('Error fetching lyrics:', error);
      isFetchingRef.current = false;
      setLyrics([]);
    }
  };

  // Cleanup polling when component unmounts or song changes
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        console.log('[Lyrics] Cleaning up polling interval');
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      isFetchingRef.current = false;
    };
  }, [currentSong?.id]); // Cleanup when song changes

  // Synchronized lyrics: Update current line based on playback time
  useEffect(() => {
    if (!showLyrics || lyrics.length === 0) return;

    console.log('[Karaoke] currentTime:', currentTime, 'lyrics count:', lyrics.length);

    // Find the current line based on currentTime
    let activeIndex = -1;
    for (let i = lyrics.length - 1; i >= 0; i--) {
      if (currentTime >= lyrics[i].time) {
        activeIndex = i;
        break;
      }
    }

    console.log('[Karaoke] Active index:', activeIndex, 'Line:', lyrics[activeIndex]?.text);

    if (activeIndex !== currentLineIndex) {
      setCurrentLineIndex(activeIndex);

      // Auto-scroll to active line
      if (activeIndex >= 0 && lyricsContainerRef.current) {
        const container = lyricsContainerRef.current;
        const activeLine = container.children[activeIndex];

        if (activeLine) {
          const containerHeight = container.clientHeight;
          const lineTop = activeLine.offsetTop;
          const lineHeight = activeLine.clientHeight;

          // Center the active line in the viewport
          const scrollTo = lineTop - (containerHeight / 2) + (lineHeight / 2);

          container.scrollTo({
            top: scrollTo,
            behavior: 'smooth'
          });
        }
      }
    }
  }, [currentTime, lyrics, showLyrics, currentLineIndex]);



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

  return (
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

      <div className="flex-grow flex flex-col items-center justify-center text-center pt-10 w-full overflow-hidden relative">
        {/* Main Content (Cover + Info) - Hide when Lyrics/Queue are open */}
        <div className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-500 ${!showLyrics && !showQueue ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-90 pointer-events-none'}`}>
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

        {/* Lyrics View - Inline */}
        <div className={`absolute inset-0 flex flex-col items-center justify-center p-4 transition-all duration-500 ${showLyrics ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-8 pointer-events-none'}`}>
          <div
            ref={lyricsContainerRef}
            className="w-full h-full overflow-y-auto text-center space-y-6 py-10 no-scrollbar"
            style={{ maskImage: 'linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)' }}
          >
            {lyrics.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-white/50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white/50 mb-4"></div>
                <p className="animate-pulse mb-2 text-lg">Generando letras con IA...</p>
                <p className="text-xs">Spectra VOXW (Whisper)</p>
                <p className="text-xs mt-2 text-white/30">Esto puede tomar 1-2 minutos</p>
                <p className="text-xs mt-1 text-white/20">Se actualizará automáticamente</p>
              </div>
            ) : (
              lyrics.map((line, i) => (
                <p
                  key={i}
                  className={`text-2xl font-bold transition-all duration-500 cursor-pointer hover:text-white ${i === currentLineIndex ? 'text-white scale-110 blur-none' : 'text-white/30 blur-[1px]'}`}
                  style={{ transitionDelay: `${i * 20}ms` }}
                  onClick={() => seek(line.time)}
                >
                  {line.text}
                </p>
              ))
            )}
          </div>
        </div>

        {/* Queue View - Inline */}
        <div className={`absolute inset-0 flex flex-col items-center justify-start p-4 transition-all duration-500 ${showQueue ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-8 pointer-events-none'}`}>
          <h2 className="text-2xl font-bold mb-6 text-center sticky top-0 bg-black/0 backdrop-blur-md py-2 z-10 w-full">Cola de Reproducción</h2>
          <div className="w-full h-full overflow-y-auto space-y-2 px-2 pb-20 no-scrollbar">
            {originalQueue.length === 0 ? (
              <p className="text-center text-white/50 mt-10">La cola está vacía</p>
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
                        <div className="flex-1 min-w-0 text-left">
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
            className={`transition-all duration-200 hover:scale-110 active:scale-95 ${showLyrics ? 'text-primary scale-110' : 'text-white/80 hover:text-white'}`}
          >
            <IoText size={28} />
          </button>

          <button
            onClick={handleToggleQueue}
            className={`transition-all duration-200 hover:scale-110 active:scale-95 ${showQueue ? 'text-primary scale-110' : 'text-white/80 hover:text-white'}`}
          >
            <IoList size={28} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default FullScreenPlayer;