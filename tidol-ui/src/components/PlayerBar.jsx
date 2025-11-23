// src/components/PlayerBar.jsx
import { useEffect, useMemo, memo, useRef } from 'react';
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
  // ... (hooks)
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

  // ... (rest of the logic)

  // Refs para tracking y evitar actualizaciones innecesarias
  const lastPositionUpdateRef = useRef(0);
  const mediaSessionInitializedRef = useRef(false);

  // ... (useEffect logic for MediaSession - keep as is)
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
      return; // No actualizar si es la misma canción
    }

    try {
      // Establecer metadata de la canción
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

  // Configurar Action Handlers (separado para mantener referencias actualizadas)
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    try {
      // Play
      navigator.mediaSession.setActionHandler('play', () => {
        if (!isPlaying) togglePlayPause();
      });

      // Pause
      navigator.mediaSession.setActionHandler('pause', () => {
        if (isPlaying) togglePlayPause();
      });

      // Previous Track
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        previousSong();
      });

      // Next Track
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        nextSong();
      });

      // Seek to (ir a una posición específica) - Solo para la barra de progreso
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined && details.seekTime >= 0) {
          seek(details.seekTime);
          // Actualizar inmediatamente después del seek
          lastPositionUpdateRef.current = 0;
        }
      });

      // NO definir seekbackward ni seekforward para evitar los botones de +/-10s en iOS

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

  // Actualizar posición de reproducción (para la barra de progreso en iOS)
  // Super optimizado: Solo actualizar cuando sea absolutamente necesario
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentSong || !duration || duration <= 0) return;

    const now = Date.now();
    const timeSinceLastUpdate = now - lastPositionUpdateRef.current;

    // Solo actualizar cada 10 segundos o en momentos críticos
    const shouldUpdate =
      !mediaSessionInitializedRef.current || // Primera vez
      currentTime === 0 || // Inicio
      Math.abs(currentTime - duration) < 0.5 || // Casi al final
      timeSinceLastUpdate > 10000; // Cada 10 segundos

    if (!shouldUpdate) return;

    try {
      if ('setPositionState' in navigator.mediaSession) {
        // Validar valores antes de enviar
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
      // Solo logear en desarrollo
      if (process.env.NODE_ENV === 'development') {
        console.debug('MediaSession position update skipped:', error.message);
      }
    }
  }, [currentSong?.id, duration, isPlaying]); // Dependencias mínimas

  const handlers = useSwipeable({
    onSwipedLeft: () => nextSong(),
    onSwipedRight: () => previousSong(),
    delta: 50, // Mínimo de píxeles para registrar el swipe
    preventScrollOnSwipe: true,
    trackMouse: true
  });

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Memoizar getQuality para evitar recalcular en cada render
  const quality = useMemo(() => {
    if (!currentSong) return 'N/A';
    const parts = [];
    if (currentSong.bit_depth) parts.push(`${currentSong.bit_depth}-bit`);
    if (currentSong.sample_rate) parts.push(`${(currentSong.sample_rate / 1000).toFixed(1)} kHz`);
    return parts.join(' / ') || 'N/A';
  }, [currentSong?.bit_depth, currentSong?.sample_rate]);

  // Componente para el icono de volumen
  const VolumeIcon = () => {
    if (isMuted || volume === 0) return <IoVolumeMuteSharp size={22} />;
    if (volume < 0.3) return <IoVolumeLowSharp size={22} />;
    if (volume < 0.7) return <IoVolumeMediumSharp size={22} />;
    return <IoVolumeHighSharp size={22} />;
  };
  if (!currentSong) return null;

  // Si estamos en modo Sheet, siempre renderizamos (el padre controla la visibilidad/opacidad)
  // Si NO estamos en modo Sheet, usamos la lógica antigua (!isFullScreenOpen)
  const shouldRender = isSheetMode || !isFullScreenOpen;

  if (!shouldRender) return null;

  return (
    <footer className={`player-container ${isSheetMode ? 'in-sheet' : ''}`} {...handlers}>
      {/* NUEVA BARRA DE PROGRESO (Estilo YT Music) - Solo móvil */}
      <div className="progress-line-container md:hidden">
        <div className="progress-line-bar" style={{ width: `${progress || 0}%` }}></div>
      </div>

      {/* Left section (Siempre visible) */}
      <div className="player-left">
        <AlbumCover
          src={currentSong.portada}
          alt={currentSong.titulo}
          onClick={toggleFullScreenPlayer}
        />
        <div className="track-info">
          <span className="track-title">{currentSong.titulo}</span>
          <span className="track-artist">{currentSong.artista}</span>
          {/* Info solo para escritorio */}
          <span className="track-album hidden md:block">{currentSong.album || 'Desconocido'}</span>
          <span className="track-quality hidden md:block">{quality}</span>
        </div>
      </div>

      {/* Center section (Solo escritorio) */}
      <div className="player-center hidden md:flex">
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
          <span className="time-current">{formatTime(currentTime)}</span>
          <input
            type="range"
            min="0"
            max="100"
            value={progress || 0}
            onChange={(e) => seek((e.target.value / 100) * duration)}
            className="progress-bar"
          />
          <span className="time-duration">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Right section (Contenido cambia) */}
      <div className="player-right">
        {/* Controles de volumen (Solo escritorio) */}
        <div className="hidden md:flex items-center gap-2">
          <button onClick={toggleMute} className="volume-btn" title="Silenciar">
            <VolumeIcon />
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={(e) => changeVolume(parseFloat(e.target.value))}
            className="volume-slider"
          />
        </div>

        {/* Controles de reproducción (Solo móvil) */}
        <div className="flex md:hidden items-center gap-3">
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