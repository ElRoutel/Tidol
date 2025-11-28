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
  IoReorderTwo,
  IoMic
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
    spectraData,
    toggleVox,
    voxMode
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
    } else {
      // Stop polling if lyrics hidden
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      isFetchingRef.current = false;
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

    const MAX_RETRIES = 100; // 100 retries x 3 seconds = 5 minutes
    const RETRY_DELAY = 3000; // 3 seconds between retries
    let retryCount = 0;

    const pollLyrics = async (skipGeneration = false) => {
      try {
        const lyricsData = await fetchSpectraLyrics(skipGeneration);

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
          const success = await pollLyrics(true); // Skip generation, just check status
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
    ? `fsp-container w-full h-full absolute inset-0 bg-black bg-opacity-90 backdrop-blur-xl flex flex-col text-white p-4 pb-6 transition-all duration-300 ${mounted ? 'opacity-100' : 'opacity-0 pointer-events-none'}`
    : `fsp-container fixed inset-0 z-[99999] bg-black bg-opacity-90 backdrop-blur-xl flex flex-col text-white p-4 pb-6 transition-all duration-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full'}`;

  // --- CINEMATIC BACKGROUND COMPONENT ---
  const CinematicBackground = ({ cover }) => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
      {/* Layer 1: Deep Background (Dark Base) */}
      <div className="absolute inset-0 bg-[#0a0a0a]" />

      {/* Layer 2: Blurred & Scaled Cover Art (The "Neon" Light Source) */}
      <motion.div
        className="absolute inset-0 opacity-60"
        animate={{
          scale: [1.2, 1.3, 1.2],
          rotate: [0, 5, -5, 0]
        }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: "linear"
        }}
      >
        <img
          src={cover}
          alt=""
          className="w-full h-full object-cover blur-[100px] saturate-150"
        />
      </motion.div>

      {/* Layer 3: Film Grain Overlay */}
      <div className="absolute inset-0 opacity-[0.15] mix-blend-overlay"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
      />

      {/* Layer 4: Vignette & Shadows (Focus on Center) */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.6)_100%)]" />
    </div>
  );

  return (
    <div
      {...handlers}
      className={containerClass}
      style={{ pointerEvents: (isEmbedded && !mounted) ? 'none' : 'auto', background: 'transparent' }} // Override bg to transparent
    >
      {/* Render Cinematic Background */}
      <CinematicBackground cover={displayCover} />

      <div className={`absolute top-4 left-4 transition-all duration-500 delay-100 z-50 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        <button
          onClick={handleClose}
          className="text-white/70 hover:text-white transition-all duration-200 hover:scale-110 active:scale-95 bg-black/20 backdrop-blur-md p-2 rounded-full"
        >
          <IoChevronDown size={32} />
        </button>
      </div>

      <div className="flex-grow flex flex-col items-center justify-center text-center pt-10 w-full overflow-hidden relative z-10">
        {/* Main Content (Cover + Info) - Hide when Lyrics/Queue are open */}
        <div className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-500 ${!showLyrics && !showQueue ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-90 pointer-events-none'}`}>
          <div className={`relative w-full max-w-md aspect-square shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-xl overflow-hidden transition-all duration-700 delay-200 ${mounted ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-90 rotate-3'}`}>
            <img
              src={displayCover}
              alt="cover"
              className="w-full h-full object-cover"
            />
            {/* Glass reflection effect on cover */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
          </div>

          <div className={`mt-10 transition-all duration-700 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <h2 className="text-4xl font-bold tracking-tight text-white drop-shadow-lg">
              {currentSong.titulo || 'Canción Desconocida'}
            </h2>
            {currentSong.artista && (
              <p className="text-xl text-white/80 mt-2 font-medium drop-shadow-md">
                {currentSong.artista}
              </p>
            )}

            {/* Spectra Metadata Chips */}
            <div className="flex justify-center gap-3 text-sm text-white/70 mt-4 font-medium">
              {spectraData?.bpm && (
                <span className="flex items-center gap-1 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/5 shadow-sm">
                  🎵 {Math.round(spectraData.bpm)} BPM
                </span>
              )}
              {spectraData?.key && (
                <span className="flex items-center gap-1 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/5 shadow-sm">
                  🎹 {spectraData.key}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Lyrics View - Cinematic Style */}
        <div className={`absolute inset-0 flex flex-col items-center justify-center p-4 transition-all duration-700 ${showLyrics ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
          <div
            ref={lyricsContainerRef}
            className="w-full h-full overflow-y-auto text-center space-y-8 py-[50vh] no-scrollbar"
            style={{ maskImage: 'linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)' }}
          >
            {lyrics.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-white/60">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mb-6"></div>
                <p className="animate-pulse mb-2 text-2xl font-light tracking-wide">Generando letras...</p>
                <p className="text-sm font-mono opacity-50">Spectra VOXW Engine</p>
              </div>
            ) : (
              lyrics.map((line, i) => (
                <motion.p
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{
                    opacity: i === currentLineIndex ? 1 : 0.3,
                    y: 0,
                    scale: i === currentLineIndex ? 1.1 : 1,
                    filter: i === currentLineIndex ? 'blur(0px)' : 'blur(2px)'
                  }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className={`text-2xl md:text-5xl font-bold cursor-pointer transition-colors duration-300 hover:text-white hover:opacity-80 px-4 leading-snug`}
                  onClick={() => seek(line.time)}
                >
                  {line.text}
                </motion.p>
              ))
            )}
          </div>
        </div>

        {/* Queue View - Glass Style */}
        <div className={`absolute inset-0 flex flex-col items-center justify-start p-6 transition-all duration-500 ${showQueue ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-8 pointer-events-none'}`}>
          <h2 className="text-3xl font-bold mb-8 text-center sticky top-0 drop-shadow-lg z-10 w-full">Cola de Reproducción</h2>
          <div className="w-full max-w-2xl h-full overflow-y-auto space-y-3 px-2 pb-24 no-scrollbar">
            {originalQueue.length === 0 ? (
              <p className="text-center text-white/50 mt-10">La cola está vacía</p>
            ) : (
              <Reorder.Group axis="y" values={originalQueue} onReorder={reorderQueue} className="space-y-3">
                {originalQueue.map((song) => (
                  <Reorder.Item key={song.id} value={song}>
                    <div
                      className={`flex items-center gap-4 p-4 rounded-xl cursor-grab active:cursor-grabbing transition-all duration-300 backdrop-blur-md border ${song.id === currentSong?.id
                        ? 'bg-white/20 border-white/20 shadow-lg'
                        : 'bg-black/20 border-white/5 hover:bg-white/10'
                        }`}
                    >
                      <div className="text-white/50 cursor-grab active:cursor-grabbing">
                        <IoReorderTwo size={24} />
                      </div>
                      <div
                        className="flex-1 flex items-center gap-4 min-w-0 cursor-pointer"
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
                          className="w-14 h-14 rounded-lg object-cover shadow-md pointer-events-none"
                        />
                        <div className="flex-1 min-w-0 text-left">
                          <p className={`font-bold text-lg truncate ${song.id === currentSong?.id ? 'text-white' : 'text-white/90'}`}>
                            {song.titulo}
                          </p>
                          <p className="text-sm text-white/60 truncate">
                            {song.artista}
                          </p>
                        </div>
                        {song.id === currentSong?.id && (
                          <div className="w-3 h-3 rounded-full bg-green-400 shadow-[0_0_15px_rgba(74,222,128,0.8)] animate-pulse"></div>
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

      <div className={`w-full max-w-3xl mx-auto pb-10 px-6 transition-all duration-700 delay-400 z-50 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="w-full group relative">
          <input
            type="range"
            min="0"
            max={duration || 100}
            value={Math.min(currentTime, duration || 100)}
            onChange={(e) => seek(Number(e.target.value))}
            className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer group-hover:h-2.5 transition-all duration-300 backdrop-blur-sm"
            style={{
              background: `linear-gradient(to right, white ${isNaN(progress) ? 0 : progress}%, rgba(255,255,255,0.1) ${isNaN(progress) ? 0 : progress}%)`,
            }}
          />
          <div className="flex justify-between text-xs font-medium text-white/60 mt-2">
            <span className="transition-colors duration-200 hover:text-white">{formatTime(currentTime)}</span>
            <span className="transition-colors duration-200 hover:text-white">{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex items-center justify-center space-x-4 md:space-x-8 mt-6 md:mt-8">
          <button
            onClick={handleToggleLike}
            className="text-white/70 hover:text-red-500 transition-all duration-300 hover:scale-110 active:scale-95 hover:drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]"
          >
            {liked ? <IoHeart size={28} className="md:w-8 md:h-8" color="#ef4444" /> : <IoHeartOutline size={28} className="md:w-8 md:h-8" />}
          </button>

          <button
            onClick={previousSong}
            className="text-white/80 hover:text-white transition-all duration-300 hover:scale-110 active:scale-95"
          >
            <IoPlaySkipBackSharp size={32} className="md:w-9 md:h-9" />
          </button>

          <button
            onClick={togglePlayPause}
            className="bg-white text-black rounded-full p-4 md:p-5 shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:shadow-[0_0_50px_rgba(255,255,255,0.5)] hover:scale-110 active:scale-95 transition-all duration-300"
          >
            {isPlaying ? <IoPauseSharp size={40} className="md:w-11 md:h-11" /> : <IoPlaySharp size={40} className="ml-1 md:w-11 md:h-11" />}
          </button>

          <button
            onClick={nextSong}
            className="text-white/80 hover:text-white transition-all duration-300 hover:scale-110 active:scale-95"
          >
            <IoPlaySkipForwardSharp size={32} className="md:w-9 md:h-9" />
          </button>

          <div className="flex gap-3 md:gap-4">
            {/* Karaoke Button - Only show if stems are available */}
            {spectraData?.stems && (
              <button
                onClick={toggleVox}
                className={`transition-all duration-300 hover:scale-110 active:scale-95 p-2 rounded-full ${voxMode ? 'text-white bg-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.4)]' : 'text-white/60 hover:text-white'}`}
                title="Modo Karaoke"
              >
                <IoMic size={24} className="md:w-7 md:h-7" color={voxMode ? '#4ade80' : 'currentColor'} />
              </button>
            )}

            <button
              onClick={handleToggleLyrics}
              className={`transition-all duration-300 hover:scale-110 active:scale-95 p-2 rounded-full ${showLyrics ? 'text-white bg-white/20 shadow-[0_0_15px_rgba(255,255,255,0.2)]' : 'text-white/60 hover:text-white'}`}
            >
              <IoText size={24} className="md:w-7 md:h-7" />
            </button>

            <button
              onClick={handleToggleQueue}
              className={`transition-all duration-300 hover:scale-110 active:scale-95 p-2 rounded-full ${showQueue ? 'text-white bg-white/20 shadow-[0_0_15px_rgba(255,255,255,0.2)]' : 'text-white/60 hover:text-white'}`}
            >
              <IoList size={24} className="md:w-7 md:h-7" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FullScreenPlayer;