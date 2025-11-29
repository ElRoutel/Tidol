// src/components/PlayerBar.jsx
import { useEffect, useMemo, memo, useState } from 'react';
import { usePlayerState, usePlayerProgress, usePlayerActions } from '../context/PlayerContext';
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
  IoMicSharp,
  IoMusicalNotesSharp,
  IoPersonSharp
} from 'react-icons/io5';
import { getOptimizedImageUrl } from '../utils/imageUtils';


// Componente memoizado para la portada
const AlbumCover = memo(({ src, alt, onClick, isSheetMode }) => (
  <div
    className={`relative overflow-hidden rounded-lg shadow-lg cursor-pointer transition-transform hover:scale-105 ${isSheetMode ? 'w-12 h-12' : 'w-14 h-14'}`}
    onClick={onClick}
  >
    <img
      src={src || '/default_cover.png'}
      alt={alt}
      className="w-full h-full object-cover"
      loading="eager"
      decoding="async"
    />
  </div>
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
    <div className="flex items-center gap-2 w-full">
      <span className="text-xs text-text-secondary w-10 text-right font-mono">{formatTime(displayTime)}</span>
      <div className="relative flex-1 h-1 group cursor-pointer transition-all duration-300">
        {/* Standard Progress Bar Background */}
        <div className="absolute inset-0 bg-white/20 rounded-full"></div>

        <div
          className="absolute inset-y-0 left-0 bg-white rounded-full transition-all duration-100 group-hover:bg-primary"
          style={{ width: `${displayProgress}%` }}
        ></div>
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
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
          style={{ left: `${displayProgress}%`, transform: `translate(-50%, -50%)` }}
        ></div>
      </div>
      <span className="text-xs text-text-secondary w-10 font-mono">{formatTime(duration)}</span>
    </div>
  );
});
ProgressBar.displayName = 'ProgressBar';

// Componente memoizado para la barra superior en móvil
const MobileProgressBar = memo(() => {
  const { progress } = usePlayerProgress();
  return (
    <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/10 pointer-events-none">
      <div
        className="h-full bg-primary transition-all duration-100 ease-linear"
        style={{ width: `${progress || 0}%` }}
      ></div>
    </div>
  );
});
MobileProgressBar.displayName = 'MobileProgressBar';

const PlayerBar = memo(function PlayerBar({ isSheetMode = false }) {
  const {
    togglePlayPause,
    nextSong,
    previousSong,
    changeVolume,
    toggleMute,
    seek,
    toggleFullScreenPlayer,
    toggleVox,
    toggleVoxType
  } = usePlayerActions();

  const { currentSong, isPlaying, volume, isMuted, isFullScreenOpen, detectedQuality, voxMode, voxType, isVoxLoading } = usePlayerState();

  const { duration } = usePlayerProgress();
  const [isDragging, setIsDragging] = useState(false);
  const [localProgress, setLocalProgress] = useState(0);

  useEffect(() => {
    const savedVolume = localStorage.getItem('userPreferences.volume');
    if (savedVolume !== null) {
      changeVolume(parseFloat(savedVolume));
    }
  }, [changeVolume]);

  const handleSeekStart = () => setIsDragging(true);
  const handleSeekChange = (e) => setLocalProgress(parseFloat(e.target.value));
  const handleSeekEnd = (e) => {
    const newProgress = parseFloat(e.target.value);
    const newTime = (newProgress / 100) * duration;
    seek(newTime);
    setIsDragging(false);
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    changeVolume(newVolume);
    localStorage.setItem('userPreferences.volume', newVolume);
  };

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
    if (!currentSong) return '';

    // Check if quality info exists directly in currentSong
    if (currentSong.bit_depth || currentSong.sample_rate) {
      const parts = [];
      if (currentSong.bit_depth) parts.push(`${currentSong.bit_depth}-bit`);
      if (currentSong.sample_rate) parts.push(`${(currentSong.sample_rate / 1000).toFixed(1)} kHz`);
      return parts.join(' / ');
    }

    // For Internet Archive songs, use detected quality
    if (detectedQuality) {
      const parts = [];
      if (detectedQuality.bit_depth) parts.push(`${detectedQuality.bit_depth}-bit`);
      if (detectedQuality.sample_rate) parts.push(`${(detectedQuality.sample_rate / 1000).toFixed(1)} kHz`);
      return parts.join(' / ');
    }

    return '';
  }, [currentSong?.bit_depth, currentSong?.sample_rate, detectedQuality]);

  const VolumeIcon = () => {
    if (isMuted || volume === 0) return <IoVolumeMuteSharp size={20} />;
    if (volume < 0.3) return <IoVolumeLowSharp size={20} />;
    if (volume < 0.7) return <IoVolumeMediumSharp size={20} />;
    return <IoVolumeHighSharp size={20} />;
  };

  if (!currentSong) return null;

  const shouldRender = isSheetMode || !isFullScreenOpen;
  if (!shouldRender) return null;

  // Clases base para el contenedor
  // User feedback: "evita que ese gris se quede si esta el fondo interactivo" -> Usamos black/60 con blur fuerte
  const containerClasses = isSheetMode
    ? "relative w-full h-full flex items-center bg-transparent px-4 overflow-hidden"
    : "fixed bottom-0 left-0 right-0 z-[1000] flex items-center justify-between px-4 py-2 pb-[env(safe-area-inset-bottom)] bg-black/80 backdrop-blur-xl border-t border-white/10 md:left-64 md:px-6 md:py-3 transition-all duration-300";

  return (
    <footer className={containerClasses} {...handlers}>
      {/* Barra de progreso superior (solo móvil y si no es sheet mode) */}
      {!isDesktop && !isSheetMode && <MobileProgressBar />}

      {/* Left section */}
      <div className={`flex items-center gap-3 min-w-0 ${isSheetMode ? 'flex-1' : 'flex-1 md:flex-[0_0_30%]'}`}>
        <AlbumCover
          src={getOptimizedImageUrl(currentSong.portada, 100)}
          alt={currentSong.titulo}
          onClick={toggleFullScreenPlayer}
          isSheetMode={isSheetMode}
        />
        <div className="flex flex-col min-w-0 overflow-hidden">
          <span className="text-sm font-semibold text-white truncate hover:underline cursor-pointer" onClick={toggleFullScreenPlayer}>
            {currentSong.titulo}
          </span>
          <span className="text-xs text-text-secondary truncate hover:text-white cursor-pointer">
            {currentSong.artista}
          </span>
          {/* Info extra solo desktop */}
          <div className="hidden md:block">
            <span className="text-[10px] text-primary font-medium mt-0.5 block">{quality}</span>
          </div>
        </div>
      </div>

      {/* Center section (Solo escritorio) */}
      <div className="hidden md:flex flex-col items-center gap-2 flex-1 max-w-[40%]">
        <div className="flex items-center gap-6">
          <button onClick={previousSong} className="text-text-secondary hover:text-white transition-colors p-2 rounded-full hover:bg-white/10" title="Anterior">
            <IoPlaySkipBackSharp size={20} />
          </button>
          <button
            onClick={togglePlayPause}
            className="w-8 h-8 flex items-center justify-center bg-white text-black rounded-full hover:scale-105 transition-transform"
            title={isPlaying ? 'Pausar' : 'Reproducir'}
          >
            {isPlaying ? <IoPauseSharp size={20} /> : <IoPlaySharp size={20} className="ml-0.5" />}
          </button>
          <button onClick={nextSong} className="text-text-secondary hover:text-white transition-colors p-2 rounded-full hover:bg-white/10" title="Siguiente">
            <IoPlaySkipForwardSharp size={20} />
          </button>
        </div>

        <ProgressBar
          isDragging={isDragging}
          onSeekStart={handleSeekStart}
          onSeekChange={handleSeekChange}
          onSeekEnd={handleSeekEnd}
          localProgress={localProgress}
        />
      </div>

      {/* Right section */}
      <div className="flex items-center justify-end gap-4 flex-1 md:flex-[0_0_30%]">

        {/* VOX Controls (Desktop) */}
        <div className="hidden md:flex items-center gap-2 border-r border-white/10 pr-4 mr-2">
          <button
            onClick={toggleVox}
            disabled={isVoxLoading}
            className={`p-2 rounded-full transition-all ${voxMode ? 'bg-primary text-white shadow-[0_0_15px_rgba(var(--primary-rgb),0.6)]' : 'text-text-secondary hover:text-white hover:bg-white/10'}`}
            title="AI Vocal Separation (VOX)"
          >
            {isVoxLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <IoMicSharp size={20} />
            )}
          </button>

          {voxMode && (
            <button
              onClick={toggleVoxType}
              className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium text-white bg-white/10 hover:bg-white/20 transition-all border border-white/5"
              title={voxType === 'vocals' ? 'Switch to Instrumental' : 'Switch to Vocals'}
            >
              {voxType === 'vocals' ? (
                <>
                  <IoPersonSharp size={14} /> <span>Vocals</span>
                </>
              ) : (
                <>
                  <IoMusicalNotesSharp size={14} /> <span>Karaoke</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Controles de volumen (Solo escritorio) */}
        <div className="hidden md:flex items-center gap-2 group">
          <button onClick={toggleMute} className="text-text-secondary hover:text-white transition-colors" title="Silenciar">
            <VolumeIcon />
          </button>
          <div className="w-24 h-1 bg-white/20 rounded-full relative cursor-pointer">
            <div
              className="absolute inset-y-0 left-0 bg-white rounded-full group-hover:bg-primary transition-colors"
              style={{ width: `${isMuted ? 0 : volume * 100}%` }}
            ></div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
        </div>

        {/* Controles de reproducción (Solo móvil) */}
        <div className="flex md:hidden items-center gap-4">
          <button onClick={togglePlayPause} className="text-white p-2" title={isPlaying ? 'Pausar' : 'Reproducir'}>
            {isPlaying ? <IoPauseSharp size={28} /> : <IoPlaySharp size={28} />}
          </button>
          <button onClick={nextSong} className="text-white p-2" title="Siguiente">
            <IoPlaySkipForwardSharp size={28} />
          </button>
        </div>
      </div>
    </footer>
  );
});

export default PlayerBar;