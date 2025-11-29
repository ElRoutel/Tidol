import React, { useState, useEffect, useRef } from 'react';
// import ReactDOM from 'react-dom'; // Ya no se usa Portal aquí
import './FullScreenPlayer.css';
import './FullScreenPlayerLyrics.css';
import { motion, Reorder, useDragControls, useAnimation } from 'framer-motion';
import { usePlayer } from '../context/PlayerContext';
import useSpectraSync from '../hooks/useSpectraSync';
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
  // Synchronized lyrics: Update current line based on playback time
  useEffect(() => {
    if (!showLyrics || lyrics.length === 0) return;

    // Find the current line based on currentTime
    let activeIndex = -1;
    for (let i = lyrics.length - 1; i >= 0; i--) {
      if (currentTime >= lyrics[i].time) {
        activeIndex = i;
        break;
      }
    }

    if (activeIndex !== currentLineIndex) {
      setCurrentLineIndex(activeIndex);

      // Auto-scroll to active line
      if (activeIndex >= 0 && lyricsContainerRef.current) {
        const container = lyricsContainerRef.current;
        // Select all lyric lines (motion.p renders as p)
        // We look for p elements inside the container
        const lines = container.querySelectorAll('p');
        const activeLine = lines[activeIndex];

        if (activeLine) {
          const containerHeight = container.clientHeight;
          const containerRect = container.getBoundingClientRect();
          const activeLineRect = activeLine.getBoundingClientRect();

          // Calculate current relative position
          const currentRelativeTop = activeLineRect.top - containerRect.top;
          const lineHeight = activeLineRect.height;

          // Calculate target position (center of viewport)
          const targetRelativeTop = (containerHeight / 2) - (lineHeight / 2);

          // Calculate adjustment needed
          const scrollAdjustment = currentRelativeTop - targetRelativeTop;

          container.scrollTo({
            top: container.scrollTop + scrollAdjustment,
            behavior: 'smooth'
          });
        }
      }
    }
  }, [currentTime, lyrics, showLyrics, currentLineIndex]);



  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 768);
  const [dragY, setDragY] = useState(0);
  const dragControls = useDragControls();
  const controls = useAnimation();

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth > 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync animation with mounted state
  useEffect(() => {
    if (!isEmbedded) {
      if (mounted) {
        controls.start({ y: 0, opacity: 1, transition: { type: "spring", damping: 25, stiffness: 300 } });
      } else {
        controls.start({ y: '100%', opacity: 0, transition: { duration: 0.3 } });
      }
    }
  }, [mounted, isEmbedded, controls]);

  // Drag to dismiss (only when NOT embedded)
  const handleDrag = (event, info) => {
    if (!isEmbedded) {
      setDragY(info.offset.y);
    }
  };

  const handleDragEnd = (event, info) => {
    if (!isEmbedded) {
      const threshold = 150;
      if (info.offset.y > threshold) {
        handleClose();
      } else {
        // Snap back if not closed
        controls.start({ y: 0, transition: { type: "spring", damping: 25, stiffness: 300 } });
        setDragY(0);
      }
    }
  };

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
    ? `fsp-container w-full h-full absolute inset-0 flex flex-col text-white p-4 pb-6 transition-all duration-300 ${mounted ? 'opacity-100' : 'opacity-0 pointer-events-none'}`
    : `fsp-container fixed inset-0 z-[99999] flex flex-col text-white p-4 pb-6`; // Removed bg-black to reveal CinematicBackground

  // --- CINEMATIC BACKGROUND COMPONENT ---
  const CinematicBackground = ({ cover }) => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10 bg-[#050505]">
      {/* Single High-Quality Blur Layer - Unified */}
      <motion.div
        className="absolute inset-0 opacity-70"
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
      >
        <img
          src={cover}
          alt=""
          className="w-full h-full object-cover blur-[60px] saturate-150"
        />
      </motion.div>

      {/* Subtle Gradient Overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/90" />
    </div>
  );

  // Use motion.div with drag ONLY when not embedded
  const ContainerTag = isEmbedded ? 'div' : motion.div;
  const dragProps = isEmbedded ? {} : {
    drag: "y",
    dragConstraints: { top: 0, bottom: 0 },
    dragElastic: { top: 0, bottom: 0.5 },
    dragListener: false, // CRITICAL: We control drag manually
    dragControls: dragControls,
    onDrag: handleDrag,
    onDragEnd: handleDragEnd,
    animate: controls, // CRITICAL: Controls animation state (snap back)
    initial: { y: '100%', opacity: 0 }
  };

  return (
    <ContainerTag
      {...dragProps}
      className={containerClass}
      style={{ pointerEvents: (isEmbedded && !mounted) ? 'none' : 'auto', background: 'transparent' }}
    >
      {/* Render Cinematic Background */}
      <CinematicBackground cover={displayCover} />

      {/* DRAG HANDLE LAYER - Covers background */}
      {!isEmbedded && (
        <div
          className="absolute inset-0 z-0"
          onPointerDown={(e) => dragControls.start(e)}
          style={{ touchAction: 'none' }}
        />
      )}

      {/* Header Drag Zone - Invisible area at top to allow dragging */}
      {!isEmbedded && (
        <div
          className="absolute top-0 left-0 right-0 h-24 z-40"
          onPointerDown={(e) => dragControls.start(e)}
          style={{ touchAction: 'none' }}
        />
      )}



      <div
        className="flex-grow flex flex-col items-center justify-center text-center pt-10 w-full overflow-hidden relative z-10"
      >
        {/* Main Content (Cover + Info) - Hide when Lyrics/Queue are open */}
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-500 ${!showLyrics && !showQueue ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-90 pointer-events-none'}`}
          onPointerDown={(e) => !isEmbedded && dragControls.start(e)} // Re-enable drag on main content background
          style={{ touchAction: 'none' }}
        >
          <div
            className={`relative w-full max-w-md aspect-square shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-xl overflow-hidden transition-all duration-700 delay-200 ${mounted ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-90 rotate-3'}`}
          >
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
          </div>
        </div>

        {/* Lyrics View - Apple Music Style */}
        <div className={`absolute inset-0 transition-all duration-700 ${showLyrics ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
          {/* Atmospheric Gradient Background - Transparent and unified */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Animated mesh gradient derived from album colors */}
            <div
              className="absolute inset-0 opacity-10"
              style={{
                background: `
                  radial-gradient(circle at 20% 30%, rgba(99, 102, 241, 0.3), transparent 60%),
                  radial-gradient(circle at 80% 70%, rgba(236, 72, 153, 0.3), transparent 60%),
                  radial-gradient(circle at 50% 50%, rgba(34, 211, 238, 0.2), transparent 70%)
                `,
                filter: 'blur(80px)',
                animation: 'meshMove 20s ease-in-out infinite alternate'
              }}
            />
          </div>

          {/* Two-Column Layout (Desktop) / Single Column (Mobile) */}
          <div className="relative h-full flex flex-col md:flex-row">

            {/* Left Column - Sticky Album Info (40% on desktop, HIDDEN on mobile) */}
            <div className="hidden md:flex md:w-[40%] md:sticky md:top-0 md:h-screen flex-col justify-center p-8 md:p-12 lg:p-16 overflow-y-auto no-scrollbar -translate-y-16">
              {/* Album Cover */}
              <div className="w-full max-w-sm mx-auto md:mx-0 mb-8">
                <div
                  className="aspect-square rounded-2xl overflow-hidden shadow-2xl"
                  style={{
                    boxShadow: '0 20px 50px rgba(0,0,0,0.5), 0 10px 25px rgba(0,0,0,0.3)',
                    maxHeight: '45vh',
                    width: 'auto',
                    maxWidth: '100%'
                  }}
                >
                  <img
                    src={currentSong.portada}
                    alt={currentSong.titulo}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              {/* Song Metadata */}
              <div className="text-left space-y-2 max-w-sm mx-auto md:mx-0">
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight break-words">
                  {currentSong.titulo}
                </h1>
                <p className="text-xl md:text-2xl text-white/70 font-medium break-words">
                  {currentSong.artista}
                </p>
              </div>
            </div>

            {/* Right Column - Scrollable Lyrics (60% on desktop, 100% on mobile) */}
            <div className="w-full md:w-[60%] h-full md:flex-1 md:relative overflow-hidden">
              <div
                ref={lyricsContainerRef}
                className="h-full w-full overflow-y-auto overflow-x-hidden no-scrollbar"
                style={{
                  scrollBehavior: 'smooth',
                  maskImage: 'linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)',
                  WebkitOverflowScrolling: 'touch' // Smooth scroll on iOS
                }}
              >
                {/* Padding to allow first/last line to center */}
                <div className="py-[40vh] px-4 md:px-12 lg:px-16">
                  {lyrics.length === 0 ? (
                    <div className="flex flex-col items-center justify-center min-h-[20vh] text-white/60">
                      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mb-4"></div>
                      <p className="animate-pulse text-xl font-light">Generando letras...</p>
                      <p className="text-xs opacity-50 mt-2">Spectra VOXW Engine</p>
                    </div>
                  ) : (
                    <div className="space-y-6 md:space-y-8">
                      {lyrics.map((line, i) => (
                        <motion.p
                          key={i}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{
                            opacity: i === currentLineIndex ? 1.0 : 0.5,
                            scale: i === currentLineIndex ? 1.05 : 1.0,
                            filter: i === currentLineIndex ? 'blur(0px)' : 'blur(1.5px)'
                          }}
                          transition={{
                            duration: 0.4,
                            ease: [0.4, 0, 0.2, 1] // cubic-bezier ease-out
                          }}
                          className={`
                            text-2xl md:text-4xl lg:text-5xl
                            font-extrabold
                            text-white
                            cursor-pointer
                            leading-tight
                            transition-colors duration-300
                            hover:text-white/90
                            break-words
                            ${i === currentLineIndex ? 'text-white' : 'text-white/50'}
                          `}
                          style={{
                            fontFamily: 'Inter, -apple-system, "Helvetica Neue", sans-serif',
                            fontWeight: i === currentLineIndex ? '800' : '700'
                          }}
                          onClick={() => seek(line.time)}
                        >
                          {line.text}
                        </motion.p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Floating Karaoke Button (Apple Music Sing Style) */}
            {spectraData?.stems && (
              <div className="absolute bottom-24 right-6 z-50 md:bottom-12 md:right-12">
                <button
                  onClick={toggleVox}
                  className={`
                      flex items-center justify-center
                      w-12 h-12 rounded-full
                      backdrop-blur-xl border border-white/10
                      shadow-lg transition-all duration-300
                      ${voxMode
                      ? 'bg-white text-black scale-110 shadow-[0_0_20px_rgba(255,255,255,0.4)]'
                      : 'bg-black/30 text-white/70 hover:bg-black/50 hover:text-white'
                    }
                    `}
                  title="Modo Karaoke"
                >
                  <IoMic size={22} className={voxMode ? 'animate-pulse' : ''} />
                  {voxMode && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </span>
                  )}
                </button>
              </div>
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
    </ContainerTag >
  );
};

export default FullScreenPlayer;