// src/pages/InternetArchivePage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import axios from 'axios';

const qualityRank = {
  'FLAC': 1,
  'WAV': 2,
  'M4A': 3,
  'MP3': 4,
  'OGG': 5,
  'unknown': 100
};

export default function InternetArchivePage() {
  const { identifier } = useParams();
  const [searchParams] = useSearchParams();
  const shouldAutoplay = searchParams.get('autoplay') === 'true';

  const [album, setAlbum] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [allFiles, setAllFiles] = useState([]);
  const [groupedTracks, setGroupedTracks] = useState([]);
  const [filteredTracks, setFilteredTracks] = useState([]);
  const [availableFormats, setAvailableFormats] = useState([]);
  const [formatFilter, setFormatFilter] = useState('best');

  const { playSongList, currentSong } = usePlayer();

  useEffect(() => {
    const fetchAlbumData = async () => {
      try {
        setLoading(true);
        const metaRes = await axios.get(`https://archive.org/metadata/${identifier}`);
        const metaData = metaRes.data;

        if (!metaData || !metaData.metadata) {
          throw new Error('No se encontraron metadatos para este item.');
        }

        const albumInfo = {
          titulo: metaData.metadata?.title || identifier,
          autor: metaData.metadata?.creator || 'Autor desconocido',
          portada: `https://archive.org/services/img/${identifier}`
        };
        setAlbum(albumInfo);

        const audioFiles = Object.values(metaData.files || {})
          .filter(f => f.name.match(/\.(mp3|flac|wav|m4a|ogg)$/i))
          .map(f => {
            const format = (f.format || 'unknown').replace('Audio', '').trim().toUpperCase();
            return {
              titulo: f.name.split('/').pop().replace(/\.[^/.]+$/, '').replace(/^\d+\.\s*/, ''),
              format: format,
              formatRank: qualityRank[format] || 100,
              url: `https://archive.org/download/${identifier}/${encodeURIComponent(f.name)}`,
              artista: albumInfo.autor,
              album: albumInfo.titulo,
              id: `${identifier}_${f.name}`,
              portada: albumInfo.portada,
              duracion: parseFloat(f.length) || 0,
            };
          });
        
        if (audioFiles.length === 0) {
          setError('No se encontraron archivos de audio en este item.');
        }

        setAllFiles(audioFiles);

        const formats = [...new Set(audioFiles.map(f => f.format))];
        formats.sort((a, b) => (qualityRank[a] || 100) - (qualityRank[b] || 100));
        setAvailableFormats(formats);

      } catch (err) {
        console.error("Error cargando IA Album:", err);
        setError(err.message || 'No se pudo cargar el álbum de Internet Archive.');
      } finally {
        setLoading(false);
      }
    };
    fetchAlbumData();
  }, [identifier]);

  useEffect(() => {
    if (allFiles.length === 0) return;

    const grouped = allFiles.reduce((acc, file) => {
      if (!acc[file.titulo]) {
        acc[file.titulo] = {
          title: file.titulo,
          artist: file.artista,
          formats: [],
        };
      }
      acc[file.titulo].formats.push(file);
      return acc;
    }, {});

    const finalGroupedTracks = Object.values(grouped).map(track => {
      track.formats.sort((a, b) => a.formatRank - b.formatRank);
      return {
        ...track,
        best: track.formats[0]
      };
    });
    setGroupedTracks(finalGroupedTracks);

    let tracksToShow = [];
    if (formatFilter === 'best') {
      tracksToShow = finalGroupedTracks.map(track => track.best);
    } else {
      tracksToShow = finalGroupedTracks
        .map(track => track.formats.find(f => f.format === formatFilter))
        .filter(Boolean);
    }

    setFilteredTracks(tracksToShow);

    if (shouldAutoplay && tracksToShow.length > 0) {
      playSongList(tracksToShow, 0);
    }
  }, [allFiles, formatFilter, shouldAutoplay, playSongList]);

  const handleSongClick = (song) => {
    const index = filteredTracks.findIndex(t => t.id === song.id);
    if (index !== -1) {
      playSongList(filteredTracks, index);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px', color: 'white' }}>
        <h2>Cargando álbum de Internet Archive...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '50px', color: '#ff5555' }}>
        <h2>{error}</h2>
      </div>
    );
  }

  return (
    <div className="album-page">
      {/* Banner del álbum */}
      <div
        className="album-header"
        style={{
          backgroundImage: `url(${album?.portada || '/default_cover.png'})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="album-overlay">
          <img
            src={album?.portada || '/default_cover.png'}
            alt={album?.titulo}
            className="album-cover-large"
          />
          <div className="album-info">
            <h1>{album?.titulo}</h1>
            <p className="album-artist">{album?.autor || 'Desconocido'}</p>
            <p className="album-meta">
              {groupedTracks.length} canciones
            </p>
            <button 
              onClick={() => playSongList(filteredTracks, 0)}
              className="play-button-main"
            >
              Reproducir
            </button>
          </div>
        </div>
      </div>

      {/* Lista de canciones y filtro */}
      <div className="songs-section">
        <div className="section-header">
          <h2>Canciones</h2>
          <div>
            <label htmlFor="format-filter">Calidad:</label>
            <select 
              id="format-filter"
              value={formatFilter}
              onChange={(e) => setFormatFilter(e.target.value)}
              className="quality-filter"
            >
              <option value="best">Mejor Calidad</option>
              {availableFormats.map(format => (
                <option key={format} value={format}>{format}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="songs-grid">
          {groupedTracks.map((track, index) => {
            const songToShow = (formatFilter === 'best') 
              ? track.best 
              : track.formats.find(f => f.format === formatFilter);

            if (!songToShow) {
              return (
                <div key={track.title} className="song-card disabled">
                  <div className="song-number">{index + 1}</div>
                  <div className="song-info">
                    <div className="song-title">{track.title}</div>
                    <div className="song-artist">{track.artist}</div>
                  </div>
                  <div className="song-quality-unavailable">{formatFilter} no disponible</div>
                </div>
              );
            }

            const isPlaying = currentSong?.id === songToShow.id;

            return (
              <div
                key={songToShow.id}
                className={`song-card ${isPlaying ? 'playing' : ''}`}
                onClick={() => handleSongClick(songToShow)}
              >
                <div className="song-number">{index + 1}</div>
                <img
                  src={songToShow.portada}
                  alt={songToShow.titulo}
                  className="song-thumb"
                />
                <div className="song-info">
                  <div className="song-title">{songToShow.titulo}</div>
                  <div className="song-artist">{songToShow.artista}</div>
                </div>
                <div className="song-quality">{songToShow.format}</div>
                <div className="song-duration">
                  {Math.floor(songToShow.duracion / 60)}:{Math.floor(songToShow.duracion % 60).toString().padStart(2, '0')}
                </div>
                <button className="play-btn-small">
                  {isPlaying ? '⏸' : '▶'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Estilos unificados de AlbumPage */}
      <style>{`
        .album-page {
          padding-bottom: 100px;
          color: white;
        }

        .album-header {
          position: relative;
          height: 340px;
          border-radius: 12px;
          overflow: hidden;
          margin-bottom: 30px;
        }

        .album-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.8));
          display: flex;
          align-items: flex-end;
          padding: 30px;
          gap: 24px;
        }

        .album-cover-large {
          width: 200px;
          height: 200px;
          border-radius: 8px;
          box-shadow: 0 8px 12px rgba(0,0,0,0.5);
        }

        .album-info h1 {
          font-size: 48px;
          margin: 0 0 8px 0;
          color: white;
        }

        .album-artist {
          font-size: 18px;
          color: #b3b3b3;
          margin: 0 0 16px 0;
        }

        .album-meta {
          font-size: 14px;
          color: #b3b3b3;
          margin-bottom: 20px;
        }

        .play-button-main {
          background: #1db954;
          border: none;
          color: white;
          padding: 14px 32px;
          border-radius: 30px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 600;
          transition: all 0.2s;
        }
        .play-button-main:hover {
          transform: scale(1.05);
          background: #1ed760;
        }

        .songs-section {
          padding: 0 16px;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .section-header h2 {
          margin: 0;
        }
        .section-header label {
          margin-right: 8px;
          font-size: 14px;
          color: #b3b3b3;
        }

        .quality-filter {
          background: #282828;
          color: white;
          border: 1px solid #404040;
          border-radius: 4px;
          padding: 8px 12px;
          font-size: 14px;
        }

        .songs-grid {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .song-card {
          display: grid;
          grid-template-columns: 40px 50px 1fr 100px 60px 40px;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .song-card:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        .song-card.playing {
          background: rgba(29, 185, 84, 0.2);
          color: #1db954;
        }
        .song-card.playing .song-title, .song-card.playing .song-artist {
          color: #1db954;
        }
        .song-card.disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .song-card.disabled:hover {
          background: transparent;
        }

        .song-number {
          text-align: center;
          color: #b3b3b3;
          font-size: 14px;
        }

        .song-thumb {
          width: 50px;
          height: 50px;
          border-radius: 4px;
          object-fit: cover;
        }

        .song-info {
          overflow: hidden;
        }

        .song-title {
          font-size: 16px;
          font-weight: 500;
          color: white;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .song-artist {
          font-size: 14px;
          color: #b3b3b3;
        }

        .song-quality, .song-quality-unavailable {
          font-size: 12px;
          color: #888;
          text-align: right;
        }
        .song-quality-unavailable {
          grid-column: span 3;
          text-align: right;
          padding-right: 10px;
        }

        .song-duration {
          text-align: right;
          color: #b3b3b3;
          font-size: 14px;
        }

        .play-btn-small {
          background: none;
          border: none;
          color: white;
          font-size: 24px;
          cursor: pointer;
          opacity: 0;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .song-card:hover .play-btn-small,
        .song-card.playing .play-btn-small {
          opacity: 1;
        }
        .song-card.playing .play-btn-small {
          color: #1db954;
        }

        @media (max-width: 768px) {
          .album-header {
            height: auto;
            padding-bottom: 20px;
            background-image: none !important; /* No background image on mobile */
          }
          .album-overlay {
            position: static; /* Remove absolute positioning */
            flex-direction: column;
            align-items: center;
            text-align: center;
            background: none;
            padding: 16px;
          }
          .album-cover-large {
            width: 180px;
            height: 180px;
            margin-bottom: 16px;
          }
          .album-info h1 {
            font-size: 28px;
          }
          .album-artist {
            font-size: 16px;
          }
          .play-button-main {
            padding: 12px 28px;
            font-size: 14px;
          }
          .song-card {
            grid-template-columns: 30px 40px 1fr 40px;
          }
          .song-quality, .song-duration {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
