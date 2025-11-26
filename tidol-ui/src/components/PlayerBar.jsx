// src/components/PlayerBar.jsx
import { useEffect, useMemo, memo, useRef, useState } from 'react';
import { usePlayerState, usePlayerProgress, usePlayerActions } from '../context/PlayerContext';
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

// Componente memoizado para la portada
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

// Componente memoizado para el progreso (se actualiza 60fps)
const ProgressBar = memo(({ isDragging, onSeekStart, onSeekChange, onSeekEnd, localProgress }) => {
  const { currentTime, duration, progress } = usePlayerProgress();

  const displayProgress = isDragging ? localProgress : (progress || 0);
  const displayTime = isDragging ? (localProgress / 100) * duration : currentTime;

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="progress-container">
      <span className="time-current">{formatTime(displayTime)}</span>
      <input
        type="range"
        min="0"
        max="100"
        value={displayProgress}
        onMouseDown={onSeekStart}
        onTouchStart={onSeekStart}
        onChange={onSeekChange}
        onMouseUp={onSeekEnd}
        onTouchEnd={onSeekEnd}
        className="progress-bar"
      />
      <span className="time-duration">{formatTime(duration)}</span>
    </div>
  );
});
ProgressBar.displayName = 'ProgressBar';

// Componente memoizado para la barra superior en móvil
const MobileProgressBar = memo(() => {
  const { progress } = usePlayerProgress();
  return (
    <div className="progress-line-container">
      <div className="progress-line-bar" style={{ width: `${progress || 0}%` }}></div>
    </div>
  );
});
MobileProgressBar.displayName = 'MobileProgressBar';

const PlayerBar = memo(function PlayerBar({ isSheetMode = false }) {
  // Usar contextos separados para evitar re-renders innecesarios
  const { currentSong, isPlaying, volume, isMuted, isFullScreenOpen } = usePlayerState();
  const {
    togglePlayPause,
    nextSong,
    previousSong,
    changeVolume,
    toggleMute,
    seek,
    toggleFullScreenPlayer
  } = usePlayerActions();

  // Necesitamos duration del progress context para cálculos de seek, 
  // pero solo lo usamos en el handler, no renderizamos
  const { duration } = usePlayerProgress();

  // Estado local para el slider de progreso
  const [isDragging, setIsDragging] = useState(false);
  const [localProgress, setLocalProgress] = useState(0);

  // Cargar volumen de localStorage al inicio
  useEffect(() => {
    const savedVolume = localStorage.getItem('userPreferences.volume');
    if (savedVolume !== null) {
      changeVolume(parseFloat(savedVolume));
    }
  }, [changeVolume]);

  // Manejadores del Slider de Progreso
  const handleSeekStart = () => setIsDragging(true);

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

  // Media Session logic moved to PlayerContext or handled here if UI specific?
  // Logic for Media Session is better in Context/Provider as it's global behavior.
  // We removed it from here to avoid duplication and re-renders.

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
      {/* Barra de progreso superior (solo móvil) - Componente separado */}
      <MobileProgressBar />

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

        {/* Progress Bar aislado */}
        <ProgressBar
          isDragging={isDragging}
          onSeekStart={handleSeekStart}
          onSeekChange={handleSeekChange}
          onSeekEnd={handleSeekEnd}
          localProgress={localProgress}
        />
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
});

export default PlayerBar;