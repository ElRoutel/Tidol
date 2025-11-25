// src/components/PlayerBar.jsx
import { useEffect, useMemo, memo, useRef, useState } from 'react';
import { usePlayer } from '../context/PlayerContext';
import './PlayerBar.css';
import { useSwipeable } from 'react-swipeable';
import {
  IoPlaySharp,
  IoPauseSharp,
  IoPlaySkipForwardSharp,
  IoPlaySkipBackSharp,
  IoVolumeHighSharp,
  IoVolumeMediumSharp,
  IoVolumeLowSharp,
  IoVolumeMuteSharp,
} from 'react-icons/io5';

// Componente memoizado para la portada (evita re-renders innecesarios)
const AlbumCover = memo(({ src, alt, onClick }) => (
  <img
    src={src || '/default_cover.png'}
    alt={alt}
    className="player-cover cursor-pointer"
    onClick={onClick}
    loading="eager"
    decoding="async"
  />
));

AlbumCover.displayName = 'AlbumCover';

export default function PlayerBar({ isSheetMode = false }) {
  const {
    currentSong,
    isPlaying,
    volume,
    isMuted,
    currentTime,
    duration,
    progress,
    togglePlayPause,
    nextSong,
    previousSong,
    changeVolume,
    toggleMute,
    seek,
    toggleFullScreenPlayer,
    isFullScreenOpen
  } = usePlayer();

  // Estado local para el slider de progreso (evita saltos al arrastrar)
  const [isDragging, setIsDragging] = useState(false);
  const [localProgress, setLocalProgress] = useState(0);

  // Sincronizar progreso local con el real cuando no se está arrastrando
  useEffect(() => {
    if (!isDragging) {
      setLocalProgress(progress || 0);
    }
  }, [progress, isDragging]);

  // Cargar volumen de localStorage al inicio
  useEffect(() => {
    const savedVolume = localStorage.getItem('userPreferences.volume');
    if (savedVolume !== null) {
      changeVolume(parseFloat(savedVolume));
    }
  }, [changeVolume]);

  // Manejadores del Slider de Progreso
  const handleSeekStart = () => {
    setIsDragging(true);
  };

  const handleSeekChange = (e) => {
    setLocalProgress(parseFloat(e.target.value));
  };

  const handleSeekEnd = (e) => {
    const newProgress = parseFloat(e.target.value);
    const newTime = (newProgress / 100) * duration;
    seek(newTime);
    setIsDragging(false);
  };

  // Manejador de Volumen
  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    changeVolume(newVolume);
    localStorage.setItem('userPreferences.volume', newVolume);
  };

  // Refs para tracking y evitar actualizaciones innecesarias
  const lastPositionUpdateRef = useRef(0);
  const mediaSessionInitializedRef = useRef(false);

  // Configurar Metadata de Media Session (solo cuando cambia la canción)
  useEffect(() => {
    if (!currentSong || !('mediaSession' in navigator)) return;

    // Evitar actualizaciones si la metadata es la misma
    const currentMetadata = navigator.mediaSession.metadata;
    if (
      currentMetadata &&
      currentMetadata.title === currentSong.titulo &&
      currentMetadata.artist === currentSong.artista &&
      currentMetadata.album === currentSong.album
    ) {
      return;
    }

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentSong.titulo || 'Canción Desconocida',
        artist: currentSong.artista || 'Artista Desconocido',
        album: currentSong.album || 'Álbum Desconocido',
        artwork: [
          {
            src: currentSong.portada || '/default_cover.png',
            sizes: '96x96',
            type: 'image/jpeg'
          },
          {
            src: currentSong.portada || '/default_cover.png',
            sizes: '128x128',
            type: 'image/jpeg'
          },
          {
            src: currentSong.portada || '/default_cover.png',
            sizes: '192x192',
            type: 'image/jpeg'
          },
          {
            src: currentSong.portada || '/default_cover.png',
            sizes: '256x256',
            type: 'image/jpeg'
          },
          {
            src: currentSong.portada || '/default_cover.png',
            sizes: '384x384',
            type: 'image/jpeg'
          },
          {
            src: currentSong.portada || '/default_cover.png',
            sizes: '512x512',
            type: 'image/jpeg'
          }
        ]
      });
    } catch (error) {
      console.error('Error configurando Media Session metadata:', error);
    }
  }, [currentSong?.id, currentSong?.titulo, currentSong?.artista, currentSong?.album, currentSong?.portada]);

  // Configurar Action Handlers
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.setActionHandler('play', () => {
        if (!isPlaying) togglePlayPause();
      });

      navigator.mediaSession.setActionHandler('pause', () => {
        if (isPlaying) togglePlayPause();
      });

      navigator.mediaSession.setActionHandler('previoustrack', () => {
        previousSong();
      });

      navigator.mediaSession.setActionHandler('nexttrack', () => {
        nextSong();
      });

      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined && details.seekTime >= 0) {
          seek(details.seekTime);
          lastPositionUpdateRef.current = 0;
        }
      });
    } catch (error) {
      console.error('Error configurando Media Session handlers:', error);
    }
  }, [isPlaying, togglePlayPause, nextSong, previousSong, seek]);

  // Actualizar el estado de reproducción
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    } catch (error) {
      console.error('Error actualizando playback state:', error);
    }
  }, [isPlaying]);

  // Actualizar posición de reproducción
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentSong || !duration || duration <= 0) return;

    const now = Date.now();
    const timeSinceLastUpdate = now - lastPositionUpdateRef.current;

    const shouldUpdate =
      !mediaSessionInitializedRef.current ||
      currentTime === 0 ||
      Math.abs(currentTime - duration) < 0.5 ||
      timeSinceLastUpdate > 10000;

    if (!shouldUpdate) return;

    try {
      if ('setPositionState' in navigator.mediaSession) {
        const validDuration = Math.max(0, Math.floor(duration));
        const validPosition = Math.max(0, Math.min(Math.floor(currentTime), validDuration));

        navigator.mediaSession.setPositionState({
          duration: validDuration,
          playbackRate: 1.0,
          position: validPosition
        });

        lastPositionUpdateRef.current = now;
        mediaSessionInitializedRef.current = true;
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.debug('MediaSession position update skipped:', error.message);
      }
    }
  }, [currentSong?.id, duration, isPlaying]);

  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 768);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth > 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => nextSong(),
    onSwipedRight: () => previousSong(),
    delta: 50,
    preventScrollOnSwipe: true,
    trackMouse: true
  });

  const handlers = isDesktop ? {} : swipeHandlers;

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const quality = useMemo(() => {
    if (!currentSong) return 'N/A';
    const parts = [];
    if (currentSong.bit_depth) parts.push(`${currentSong.bit_depth}-bit`);
    if (currentSong.sample_rate) parts.push(`${(currentSong.sample_rate / 1000).toFixed(1)} kHz`);
    return parts.join(' / ') || 'N/A';
  }, [currentSong?.bit_depth, currentSong?.sample_rate]);

  const VolumeIcon = () => {
    if (isMuted || volume === 0) return <IoVolumeMuteSharp size={22} />;
    if (volume < 0.3) return <IoVolumeLowSharp size={22} />;
    if (volume < 0.7) return <IoVolumeMediumSharp size={22} />;
    return <IoVolumeHighSharp size={22} />;
  };

  if (!currentSong) return null;

  const shouldRender = isSheetMode || !isFullScreenOpen;
  if (!shouldRender) return null;

  return (
    <footer className={`player-container glass-card ${isSheetMode ? 'in-sheet' : ''}`} {...handlers}>
      {/* Barra de progreso superior (solo móvil) */}
      <div className="progress-line-container">
        <div className="progress-line-bar" style={{ width: `${progress || 0}%` }}></div>
      </div>

      {/* Left section */}
      <div className="player-left">
        <AlbumCover
          src={currentSong.portada}
          alt={currentSong.titulo}
          onClick={toggleFullScreenPlayer}
        />
        <div className="track-info">
          <span className="track-title">{currentSong.titulo}</span>
          <span className="track-artist">{currentSong.artista}</span>
          <span className="track-album">{currentSong.album || 'Desconocido'}</span>
          <span className="track-quality">{quality}</span>
        </div>
      </div>

      {/* Center section (Solo escritorio) */}
      <div className="player-center">
        <div className="controls">
          <button onClick={previousSong} className="control-btn" title="Anterior">
            <IoPlaySkipBackSharp />
          </button>
          <button onClick={togglePlayPause} className="control-btn play-pause" title={isPlaying ? 'Pausar' : 'Reproducir'}>
            {isPlaying ? <IoPauseSharp /> : <IoPlaySharp />}
          </button>
          <button onClick={nextSong} className="control-btn" title="Siguiente">
            <IoPlaySkipForwardSharp />
          </button>
        </div>
        <div className="progress-container">
          <span className="time-current">{formatTime(isDragging ? (localProgress / 100) * duration : currentTime)}</span>
          <input
            type="range"
            min="0"
            max="100"
            value={localProgress}
            onMouseDown={handleSeekStart}
            onTouchStart={handleSeekStart}
            onChange={handleSeekChange}
            onMouseUp={handleSeekEnd}
            onTouchEnd={handleSeekEnd}
            className="progress-bar"
          />
          <span className="time-duration">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Right section */}
      <div className="player-right">
        {/* Controles de volumen (Solo escritorio) */}
        <div className="player-volume-controls">
          <button onClick={toggleMute} className="volume-btn" title="Silenciar">
            <VolumeIcon />
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="volume-slider"
          />
        </div>

        {/* Controles de reproducción (Solo móvil) */}
        <div className="player-mobile-controls">
          <button onClick={togglePlayPause} className="control-btn play-pause-mobile" title={isPlaying ? 'Pausar' : 'Reproducir'}>
            {isPlaying ? <IoPauseSharp size={22} /> : <IoPlaySharp size={22} />}
          </button>
          <button onClick={nextSong} className="control-btn" title="Siguiente">
            <IoPlaySkipForwardSharp size={22} />
          </button>
        </div>
      </div>
    </footer>
  );
}