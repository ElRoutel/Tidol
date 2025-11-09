// tidol-frontend/src/components/PlayerBar.jsx
import { usePlayer } from '../context/PlayerContext';

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
    hasPrevious
  } = usePlayer();

  // Formatear tiempo (segundos a mm:ss)
  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calcular calidad de audio
  const getQuality = () => {
    if (!currentSong) return 'N/A';
    const parts = [];
    if (currentSong.bit_depth) parts.push(`${currentSong.bit_depth}-bit`);
    if (currentSong.sample_rate) parts.push(`${(currentSong.sample_rate / 1000).toFixed(1)} kHz`);
    return parts.join(' / ') || 'N/A';
  };

  // Si no hay canción, no mostrar el player
  if (!currentSong) {
    return null;
  }

  return (
    <footer className="player-container">
      {/* Sección izquierda: Info de la canción */}
      <div className="player-left">
        <img
          src={currentSong.portada || '/default_cover.png'}
          alt={currentSong.titulo}
          className="player-cover"
        />
        <div className="track-info">
          <span className="track-title">{currentSong.titulo}</span>
          <span className="track-artist">{currentSong.artista}</span>
          <span className="track-album">{currentSong.album || 'Desconocido'}</span>
          <span className="track-quality">{getQuality()}</span>
        </div>
      </div>

      {/* Sección central: Controles */}
      <div className="player-center">
        <div className="controls">
          <button
            onClick={previousSong}
            disabled={!hasPrevious}
            title="Anterior"
            className="control-btn"
          >
            ⏮
          </button>
          
          <button
            onClick={togglePlayPause}
            title={isPlaying ? 'Pausar' : 'Reproducir'}
            className="control-btn play-pause"
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          
          <button
            onClick={nextSong}
            disabled={!hasNext}
            title="Siguiente"
            className="control-btn"
          >
            ⏭
          </button>
        </div>

        {/* Barra de progreso */}
        <div className="progress-container">
          <span className="time-current">{formatTime(currentTime)}</span>
          <input
            type="range"
            min="0"
            max="100"
            value={progress || 0}
            onChange={(e) => {
              const newTime = (e.target.value / 100) * duration;
              seek(newTime);
            }}
            className="progress-bar"
          />
          <span className="time-duration">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Sección derecha: Volumen */}
      <div className="player-right">
        <button
          onClick={toggleMute}
          title={isMuted ? 'Activar sonido' : 'Silenciar'}
          className="volume-btn"
        >
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

      <style>{`
        .player-container {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: #181818;
          border-top: 1px solid #282828;
          padding: 12px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          z-index: 1000;
        }

        /* Left section */
        .player-left {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 180px;
          max-width: 300px;
        }

        .player-cover {
          width: 56px;
          height: 56px;
          border-radius: 8px;
          object-fit: cover;
        }

        .track-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          overflow: hidden;
        }

        .track-title {
          font-weight: 600;
          font-size: 14px;
          color: white;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .track-artist, .track-album {
          font-size: 12px;
          color: #b3b3b3;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .track-quality {
          font-size: 11px;
          color: #888;
        }

        /* Center section */
        .player-center {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          max-width: 722px;
        }

        .controls {
          display: flex;
          gap: 16px;
          align-items: center;
        }

        .control-btn {
          background: none;
          border: none;
          color: #b3b3b3;
          font-size: 20px;
          cursor: pointer;
          padding: 8px;
          border-radius: 50%;
          transition: all 0.2s;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .control-btn:hover:not(:disabled) {
          color: white;
          background: rgba(255, 255, 255, 0.1);
        }

        .control-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .play-pause {
          font-size: 24px;
        }

        .progress-container {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .time-current, .time-duration {
          font-size: 11px;
          color: #b3b3b3;
          min-width: 40px;
        }

        .progress-bar {
          flex: 1;
          height: 4px;
          border-radius: 2px;
          background: #404040;
          appearance: none;
          cursor: pointer;
        }

        .progress-bar::-webkit-slider-thumb {
          appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #1db954;
          cursor: pointer;
        }

        .progress-bar::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #1db954;
          cursor: pointer;
          border: none;
        }

        /* Right section */
        .player-right {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 125px;
        }

        .volume-btn {
          background: none;
          border: none;
          color: #b3b3b3;
          font-size: 18px;
          cursor: pointer;
          padding: 8px;
        }

        .volume-btn:hover {
          color: white;
        }

        .volume-slider {
          width: 93px;
          height: 4px;
          border-radius: 2px;
          background: #404040;
          appearance: none;
          cursor: pointer;
        }

        .volume-slider::-webkit-slider-thumb {
          appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
        }

        .volume-slider::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: none;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .player-container {
            bottom: 64px; /* Altura de la barra de navegación móvil */
            padding: 8px 12px;
            gap: 12px;
          }

          .player-left {
            min-width: 120px;
            max-width: 180px;
          }

          .player-cover {
            width: 40px;
            height: 40px;
          }

          .track-quality, .track-album {
            display: none;
          }

          .player-right {
            display: none;
          }
        }
      `}</style>
    </footer>
  );
}
