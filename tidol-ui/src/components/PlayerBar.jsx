// src/components/PlayerBar.jsx
import { usePlayer } from '../context/PlayerContext';
import FullScreenPlayer from './FullScreenPlayer';
import './PlayerBar.css';

export default function PlayerBar() {
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
    hasNext,
    hasPrevious,
    toggleFullScreenPlayer,
    isFullScreenPlayerOpen
  } = usePlayer();

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getQuality = () => {
    if (!currentSong) return 'N/A';
    const parts = [];
    if (currentSong.bit_depth) parts.push(`${currentSong.bit_depth}-bit`);
    if (currentSong.sample_rate) parts.push(`${(currentSong.sample_rate / 1000).toFixed(1)} kHz`);
    return parts.join(' / ') || 'N/A';
  };

  if (!currentSong) return null;

  return (
    <>
      {/* SOLO MOSTRAR PLAYER CHICO SI FULLSCREEN NO ESTÁ ABIERTO */}
      {!isFullScreenPlayerOpen && (
        <footer className="player-container">
          {/* Left section */}
          <div className="player-left">
            <img
              src={currentSong.portada || '/default_cover.png'}
              alt={currentSong.titulo}
              className="player-cover cursor-pointer"
              onClick={toggleFullScreenPlayer}
            />
            <div className="track-info">
              <span className="track-title">{currentSong.titulo}</span>
              <span className="track-artist">{currentSong.artista}</span>
              <span className="track-album">{currentSong.album || 'Desconocido'}</span>
              <span className="track-quality">{getQuality()}</span>
            </div>
          </div>

          {/* Center section */}
          <div className="player-center">
            <div className="controls">
              <button onClick={previousSong} disabled={!hasPrevious} className="control-btn" title="Anterior">⏮</button>
              <button onClick={togglePlayPause} className="control-btn play-pause" title={isPlaying ? 'Pausar' : 'Reproducir'}>
                {isPlaying ? '⏸' : '▶'}
              </button>
              <button onClick={nextSong} disabled={!hasNext} className="control-btn" title="Siguiente">⏭</button>
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

          {/* Right section */}
          <div className="player-right">
            <button onClick={toggleMute} className="volume-btn" title="Silenciar">
              {isMuted || volume === 0 ? '🔇' : volume < 0.3 ? '🔈' : volume < 0.7 ? '🔉' : '🔊'}
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
        </footer>
      )}

      {/* FULLSCREEN PLAYER */}
      {isFullScreenPlayerOpen && <FullScreenPlayer />}
    </>
  );
}
