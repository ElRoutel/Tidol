import { useEffect, useMemo, memo, useState } from 'react';
import { motion, useTransform } from 'framer-motion';
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
  IoPersonSharp,
  IoShuffle,
  IoRepeat,
  IoList,
  IoHomeSharp,
  IoGlobeOutline,
  IoCloudOutline,
  IoServerOutline,
  IoFlash
} from 'react-icons/io5';
import { getOptimizedImageUrl } from '../utils/imageUtils';
import { getCoverSrc } from '../utils/coverArt';


// Componente memoizado para la portada
const AlbumCover = memo(({ src, alt, onClick, isSheetMode }) => (
  <div
    className={`relative overflow-hidden shadow-lg cursor-pointer transition-transform hover:scale-105 ${isSheetMode ? 'w-12 h-12 rounded-md' : 'w-14 h-14 rounded-md'}`}
    onClick={onClick}
  >
    <img
      src={src || '/default-album.png'}
      alt={alt}
      className="w-full h-full object-cover"
      loading="eager"
      decoding="async"
    />
  </div>
));
AlbumCover.displayName = 'AlbumCover';

const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Componente memoizado para el progreso (se actualiza 60fps)
const ProgressBar = memo(({ isDragging, onSeekStart, onSeekChange, onSeekEnd, onSeekCancel, localProgress }) => {
  const { currentTimeMotion, progressMotion, duration } = usePlayerProgress();

  const formattedTime = useTransform(currentTimeMotion, time => formatTime(time));
  const progressPercent = useTransform(progressMotion, p => `${p || 0}%`);

  const displayTime = isDragging ? formatTime((localProgress / 100) * duration) : formattedTime;
  const displayWidth = isDragging ? `${localProgress}%` : progressPercent;

  return (
    <div className="flex items-center gap-2 w-full">
      <motion.span className="text-xs text-text-secondary w-10 text-right font-mono">{displayTime}</motion.span>
      <div className="relative flex-1 h-3 group cursor-pointer transition-all duration-300 flex items-center">
        {/* Standard Progress Bar Background */}
        <div className="absolute left-0 right-0 h-1 bg-white/20 rounded-full group-hover:h-2 transition-all duration-300"></div>

        <motion.div
          className="absolute left-0 h-1 bg-white rounded-full group-hover:h-2 group-hover:bg-primary transition-all duration-300"
          style={{ width: displayWidth, willChange: 'width' }}
        ></motion.div>
        {/* El input es invisible (opacity-0): su `value` solo importa durante el
            drag. Antes se le pasaba el MotionValue como value (objeto, no número)
            y el drag arrancaba siempre desde la posición previa (0). */}
        {/* Pointer events (cubren mouse y touch) + pointercancel: con los pares
            mouse/touch de antes, un gesto cancelado por el navegador no disparaba
            el "end" e isDragging quedaba en true → barra congelada para siempre. */}
        <input
          type="range"
          min="0"
          max="100"
          step="0.01"
          value={isDragging ? localProgress : progressMotion.get() || 0}
          onPointerDown={() => onSeekStart(progressMotion.get() || 0)}
          onChange={onSeekChange}
          onPointerUp={onSeekEnd}
          onPointerCancel={onSeekCancel}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          style={{ touchAction: 'none' }}
        />
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
          style={{ left: displayWidth, transform: `translate(-50%, -50%)`, willChange: 'left' }}
        ></motion.div>
      </div>
      <span className="text-xs text-text-secondary w-10 font-mono">{formatTime(duration)}</span>
    </div>
  );
});
ProgressBar.displayName = 'ProgressBar';

// Componente memoizado para la barra superior en móvil
const MobileProgressBar = memo(() => {
  const { progressMotion } = usePlayerProgress();
  const progressPercent = useTransform(progressMotion, p => `${p || 0}%`);
  return (
    <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/10 pointer-events-none">
      <motion.div
        className="h-full bg-primary"
        style={{ width: progressPercent, willChange: 'width' }}
      ></motion.div>
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

  const { currentSong, isPlaying, volume, isMuted, isFullScreenOpen, detectedQuality, voxMode, voxType, isVoxLoading, playbackDetails } = usePlayerState();

  // Fix: Define isDesktop using a hook or check
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const barStyles = isDesktop ? {
    // Desktop: Anchored Grounding
    background: 'rgba(0, 0, 0, 0.4)',
    backdropFilter: 'blur(40px)',
    WebkitBackdropFilter: 'blur(40px)',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: 0,
    margin: 0,
    width: '100%',
    height: '6rem', // h-24
    bottom: 0,
    left: 0
  } : {
    // Mobile: Floating iOS Pill
    background: 'rgba(28, 28, 30, 0.90)', // Lighter native dark
    backdropFilter: 'blur(40px) saturate(200%)',
    WebkitBackdropFilter: 'blur(40px) saturate(200%)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 0 rgba(255, 255, 255, 0.15)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: '20px',
    margin: '0 12px',
    width: 'calc(100% - 24px)',
    bottom: '12px', // Safe area
    left: '0'
  };

  const { duration } = usePlayerProgress();
  const [isDragging, setIsDragging] = useState(false);
  const [localProgress, setLocalProgress] = useState(0);

  useEffect(() => {
    const savedVolume = parseFloat(localStorage.getItem('userPreferences.volume'));
    if (Number.isFinite(savedVolume)) {
      changeVolume(savedVolume);
    }
  }, [changeVolume]);

  const handleSeekStart = (startProgress = 0) => {
    setLocalProgress(startProgress); // arranca el drag desde la posición actual
    setIsDragging(true);
  };
  const handleSeekChange = (e) => setLocalProgress(parseFloat(e.target.value));
  const handleSeekEnd = (e) => {
    const newProgress = parseFloat(e.target.value);
    const newTime = (newProgress / 100) * duration;
    seek(newTime);
    setIsDragging(false);
  };
  // Gesto cancelado (el navegador se quedó el pointer): soltar sin hacer seek.
  const handleSeekCancel = () => setIsDragging(false);

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    changeVolume(newVolume);
    localStorage.setItem('userPreferences.volume', newVolume);
  };



  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => nextSong(),
    onSwipedRight: () => previousSong(),
    delta: 50,
    preventScrollOnSwipe: true,
    trackMouse: true
  });

  const handlers = isDesktop ? {} : swipeHandlers;

  const handleBarClick = (e) => {
    // Abrir el fullscreen al tocar cualquier zona NO interactiva de la barra:
    // portada, título, artista o el fondo. Los controles (play/next/mute/sliders)
    // se excluyen con closest() para no abrir el player al usarlos. Es el ÚNICO
    // punto que abre: portada/título ya no llevan onClick propio (disparaban un
    // doble toggle al burbujear hasta aquí → abría y cerraba).
    if (e.target.closest('button, input, a, [role="button"]')) return;
    toggleFullScreenPlayer();
  };

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
  const containerClasses = isSheetMode
    ? "relative w-full h-full flex items-center bg-transparent px-4 overflow-hidden cursor-pointer"
    : `fixed bottom-0 left-0 right-0 z-[1000] flex items-center justify-between px-4 py-2 cursor-pointer ${!isDesktop ? 'pb-2' : 'pb-[env(safe-area-inset-bottom)]'} bg-black/40 backdrop-blur-2xl border-t border-white/10 md:left-64 md:px-6 md:py-0 md:h-24 transition-all duration-300`;

  return (
      <footer className={containerClasses} onClick={handleBarClick} {...handlers}>
      {/* Barra de progreso superior (solo móvil y si no es sheet mode) */}
      {!isDesktop && !isSheetMode && <MobileProgressBar />}

      {/* Left section */}
      <div className={`flex items-center gap-3 min-w-0 ${isSheetMode ? 'flex-1' : 'flex-1 md:flex-[0_0_30%]'}`}>
        <AlbumCover
          src={getCoverSrc(currentSong, true)}
          alt={currentSong.trackName}
          isSheetMode={isSheetMode}
        />
        <div className="flex flex-col min-w-0 overflow-hidden">
          <span className="text-sm font-semibold text-white truncate hover:underline cursor-pointer">
            {currentSong.trackName}
          </span>
          <span className="text-xs text-text-secondary truncate hover:text-white cursor-pointer">
            {currentSong.artistName}
          </span>
          {/* Info extra solo desktop */}
          <div className="hidden md:block">
            <div className="flex items-center gap-1.5 mt-0.5">
              {/* Source Indicator */}
              {playbackDetails?.provider === 'webtorrent' && <IoGlobeOutline className="text-blue-400" size={12} title={`P2P Network (${playbackDetails.metadata?.seedCount || '?'} seeds)`} />}
              {playbackDetails?.provider === 'local' && <IoHomeSharp className="text-yellow-400" size={12} title="Local Cache" />}
              {playbackDetails?.provider === 'internet_archive' && <IoServerOutline className="text-gray-400" size={12} title="Internet Archive" />}

              <span className="text-[10px] text-primary font-medium">{quality}</span>
            </div>
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
          onSeekCancel={handleSeekCancel}
          localProgress={localProgress}
        />
      </div>

      {/* Right section */}
      <div className="flex items-center justify-end gap-4 flex-1 md:flex-[0_0_30%]">

        {/* VOX Controls (Desktop) */}


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
