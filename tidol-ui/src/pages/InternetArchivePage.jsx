// src/pages/InternetArchivePage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import api from '../api/axiosConfig'; // Usar la instancia de axios configurada
import { IoPlaySharp, IoPauseSharp } from 'react-icons/io5';
import LikeButton from '../components/LikeButton'; // Importamos el nuevo componente

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
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [likedSongs, setLikedSongs] = useState(new Set()); // Para guardar los IDs de canciones favoritas

  const { playSongList, currentSong } = usePlayer();

  /**
   * Busca la mejor portada disponible en los archivos del item
   * Prioriza archivos de imagen de alta calidad
   */
  const findBestCover = (files, identifier) => {
    // Filtrar archivos de imagen
    const imageFiles = Object.values(files)
      .filter(f => f.name && /\.(jpg|jpeg|png|gif)$/i.test(f.name))
      .map(f => ({
        name: f.name,
        size: f.size || 0,
        url: `https://archive.org/download/${identifier}/${encodeURIComponent(f.name)}`
      }));

    if (imageFiles.length === 0) {
      // Fallback a services/img si no hay imágenes
      return `https://archive.org/services/img/${identifier}`;
    }

    // Priorizar por nombre (covers conocidos)
    const preferredNames = [
      'cover.jpg', 'cover.jpeg', 'cover.png',
      'folder.jpg', 'folder.jpeg', 'folder.png',
      'album.jpg', 'album.jpeg', 'album.png',
      'front.jpg', 'front.jpeg', 'front.png',
      'artwork.jpg', 'artwork.jpeg', 'artwork.png'
    ];

    // Buscar por nombre preferido
    for (const prefName of preferredNames) {
      const found = imageFiles.find(f => 
        f.name.toLowerCase().includes(prefName.toLowerCase())
      );
      if (found) return found.url;
    }

    // Si no hay nombre preferido, tomar la imagen más grande
    imageFiles.sort((a, b) => b.size - a.size);
    return imageFiles[0].url;
  };

  useEffect(() => {
    const fetchAlbumData = async () => {
      try {
        setLoading(true);
        const metaRes = await api.get(`https://archive.org/metadata/${identifier}`);
        const metaData = metaRes.data;

        // Obtenemos los likes de IA del usuario
        const likedRes = await api.get('/music/ia/likes'); // <-- CORRECCIÓN: Usar el endpoint local correcto
        if (likedRes.data) {
          setLikedSongs(new Set(likedRes.data.map(s => s.identifier)));
        }

        if (!metaData || !metaData.metadata) {
          throw new Error('No se encontraron metadatos para este item.');
        }

        // ✅ Obtener portada de máxima calidad
        const highQualityCover = findBestCover(metaData.files || {}, identifier);

        const albumInfo = {
          titulo: metaData.metadata?.title || identifier,
          autor: metaData.metadata?.creator || 'Autor desconocido',
          portada: highQualityCover, // ✅ Portada de alta calidad
          year: metaData.metadata?.year || metaData.metadata?.date || null,
          description: metaData.metadata?.description || null
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
              identifier: `${identifier}_${f.name}`, // Usamos un identificador único
              parent_identifier: identifier, // <-- AÑADIMOS ESTA LÍNEA
              portada: highQualityCover,
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

  // Manejar el cambio de estado de "Me Gusta"
  const handleLikeToggle = (songIdentifier, isLiked) => {
    setLikedSongs(prev => {
      const newSet = new Set(prev);
      if (isLiked) {
        newSet.add(songIdentifier);
      } else {
        newSet.delete(songIdentifier);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px', color: 'white' }}>
        <div className="loading-spinner" />
        <h2>Cargando álbum de Internet Archive...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '50px', color: '#ff5555' }}>
        <h2>{error}</h2>
        <p style={{ color: '#b3b3b3', marginTop: '10px' }}>
          Intenta buscar otro contenido o verifica el identificador.
        </p>
      </div>
    );
  }

  return (
    <div className="album-page">
      {/* Banner del álbum con portada de alta calidad */}
      <div
        className="album-header"
        style={{
          backgroundImage: `url(${album?.portada})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="album-overlay">
          <img
            src={album?.portada}
            alt={album?.titulo}
            className="album-cover-large"
            loading="eager" // ✅ Carga prioritaria
          />
          <div className="album-info">
            <h1>{album?.titulo}</h1>
            <p className="album-artist">{album?.autor || 'Desconocido'}</p>
            <p className="album-meta">
              {groupedTracks.length} canciones
              {album?.year && ` • ${album.year}`}
            </p>
            {album?.description && (
              <div className="description-container">
                <div
                  className={`album-description ${!isDescriptionExpanded ? 'collapsed' : ''}`}
                  dangerouslySetInnerHTML={{ __html: album.description }}
                />
                <button onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)} className="toggle-description-btn">
                  {isDescriptionExpanded ? 'MOSTRAR MENOS' : 'MOSTRAR MÁS'}
                </button>
              </div>
            )}
            <button 
              onClick={() => playSongList(filteredTracks, 0)}
              className="play-button-main"
            >
              <IoPlaySharp /> Reproducir
            </button>
          </div>
        </div>
      </div>

      {/* Lista de canciones y filtro */}
      <div className="songs-section">
        <div className="section-header">
          <h2>Canciones</h2>
          <div className="filter-controls">
            <label htmlFor="format-filter">Calidad:</label>
            <select 
              id="format-filter"
              value={formatFilter}
              onChange={(e) => setFormatFilter(e.target.value)}
              className="quality-filter"
            >
              <option value="best">Mejor Calidad</option>
              {availableFormats.map(format => (
                <option key={format} value={format}>
                  {format === 'FLAC' ? '💎' : format === 'WAV' ? '🎵' : '🎧'} {format}
                </option>
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
                  {/* Placeholder for album art to maintain alignment */}
                  <div />
                  <div className="song-info">
                    <div className="song-title">{track.title}</div>
                    <div className="song-artist">{track.artist}</div>
                  </div>
                  <div 
                    className="song-quality-unavailable"
                    style={{ gridColumn: '4 / -1', textAlign: 'right', paddingRight: '10px' }}
                  >
                    {formatFilter} no disponible
                  </div>
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
                  loading="lazy" // ✅ Lazy loading para miniaturas
                />
                <div className="song-info">
                  <div className="song-title">{songToShow.titulo}</div>
                  <div className="song-artist">{songToShow.artista}</div>
                </div>
                <div className="song-quality">{songToShow.format}</div>
                <LikeButton 
                  song={songToShow}
                  isLiked={likedSongs.has(songToShow.identifier)}
                  onLikeToggle={handleLikeToggle}
                  isArchive={true}
                />
                <div className="song-duration">
                  {Math.floor(songToShow.duracion / 60)}:{Math.floor(songToShow.duracion % 60).toString().padStart(2, '0')}
                </div>
                <button className="play-btn-small">
                  {isPlaying ? <IoPauseSharp /> : <IoPlaySharp />}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Estilos mejorados */}
      <style>{`
        .album-page {
          padding-bottom: 100px;
          color: white;
        }

        .loading-spinner {
          width: 50px;
          height: 50px;
          border: 4px solid rgba(255,255,255,0.1);
          border-top: 4px solid #1db954;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 20px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .album-header {
          position: relative;
          height: 400px;
          border-radius: 12px;
          overflow: hidden;
          margin-bottom: 30px;
        }

        .album-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to bottom, rgba(0,0,0,0.4), rgba(0,0,0,0.9));
          display: flex;
          align-items: flex-end;
          padding: 40px;
          gap: 30px;
        }

        .album-cover-large {
          width: 232px;
          height: 232px;
          border-radius: 8px;
          box-shadow: 0 12px 24px rgba(0,0,0,0.6);
          object-fit: cover;
        }
        
        .album-info {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }

        .album-info h1 {
          font-size: 56px;
          margin: 0 0 12px 0;
          color: white;
          font-weight: 900;
          text-shadow: 0 2px 8px rgba(0,0,0,0.5);
        }

        .album-artist {
          font-size: 20px;
          color: #ffffff;
          margin: 0 0 8px 0;
          font-weight: 600;
        }

        .album-meta {
          font-size: 14px;
          color: #b3b3b3;
          margin-bottom: 12px;
        }

        .description-container {
          margin-bottom: 20px;
        }

        .album-description {
          font-size: 14px;
          color: #b3b3b3;
          max-width: 600px;
          line-height: 1.5;
          transition: max-height 0.3s ease-in-out;
        }
        .album-description.collapsed {
          max-height: 63px;
          overflow: hidden;
          position: relative;
          -webkit-mask-image: linear-gradient(to bottom, black 50%, transparent 100%);
          mask-image: linear-gradient(to bottom, black 50%, transparent 100%);
        }

        .toggle-description-btn {
          background: none;
          border: none;
          color: #b3b3b3;
          cursor: pointer;
          font-weight: 700;
          padding: 8px 0 0;
          font-size: 12px;
          letter-spacing: 0.5px;
        }
        .toggle-description-btn:hover {
            color: white;
        }

        .play-button-main {
          background: #1db954;
          border: none;
          color: white;
          padding: 16px 48px;
          border-radius: 30px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 20px;
          transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(29,185,84,0.3);
        }
        .play-button-main:hover {
          transform: scale(1.06);
          background: #1ed760;
          box-shadow: 0 6px 16px rgba(29,185,84,0.5);
        }
        .play-button-main:active {
          transform: scale(1.02);
        }

        .songs-section {
          padding: 0 24px;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .section-header h2 {
          margin: 0;
          font-size: 24px;
          font-weight: 700;
        }

        .filter-controls {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .filter-controls label {
          font-size: 14px;
          color: #b3b3b3;
          font-weight: 600;
        }

        .quality-filter {
          background: #282828;
          color: white;
          border: 1px solid #404040;
          border-radius: 6px;
          padding: 10px 16px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .quality-filter:hover {
          background: #333;
          border-color: #555;
        }

        .songs-grid {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .song-card {
          display: grid;
          grid-template-columns: 40px 50px 1fr 100px 40px 60px 40px;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .song-card:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        .song-card.playing {
          background: rgba(29, 185, 84, 0.2);
        }
        .song-card.playing .song-title {
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
          font-weight: 500;
        }

        .song-thumb {
          width: 50px;
          height: 50px;
          border-radius: 4px;
          object-fit: cover;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
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
          font-weight: 600;
        }
        .song-quality-unavailable {
          text-align: right;
          padding-right: 10px;
        }

        .like-btn {
          background: none;
          border: none;
          color: #b3b3b3;
          font-size: 20px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .like-btn:hover {
          color: white;
          transform: scale(1.1);
        }

        .song-duration {
          text-align: right;
          color: #b3b3b3;
          font-size: 14px;
          font-variant-numeric: tabular-nums;
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
          width: 32px;
          height: 32px;
        }
        .song-card:hover .play-btn-small,
        .song-card.playing .play-btn-small {
          opacity: 1;
        }
        .song-card.playing .play-btn-small {
          color: #1db954;
        }

        @media (max-width: 768px) {
          .album-page {
            padding-bottom: 120px;
          }

          .album-header {
            height: auto;
            background-image: none !important;
            margin: -0.5rem -0.5rem 16px -0.5rem;
            border-radius: 0;
          }
          
          .album-overlay {
            position: static;
            flex-direction: column;
            align-items: center;
            text-align: center;
            background: linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 100%);
            padding: 32px 20px 24px;
            gap: 16px;
          }
          
          .album-cover-large {
            width: 200px;
            height: 200px;
            margin-bottom: 8px;
          }
          
          .album-info {
            width: 100%;
            align-items: center;
          }
          
          .album-info h1 {
            font-size: 28px;
            line-height: 1.2;
            margin-bottom: 8px;
            text-align: center;
          }
          
          .album-artist {
            font-size: 16px;
            margin-bottom: 6px;
          }
          
          .album-meta {
            font-size: 13px;
            margin-bottom: 8px;
          }

          .description-container {
            width: 100%;
            margin-bottom: 16px;
          }

          .album-description {
            font-size: 13px;
            text-align: center;
            max-width: 100%;
          }

          .album-description.collapsed {
            max-height: 60px;
          }

          .toggle-description-btn {
            font-size: 11px;
            padding: 6px 0 0;
          }
          
          .play-button-main {
            padding: 14px 40px;
            font-size: 15px;
            margin-top: 12px;
            width: 100%;
            max-width: 280px;
            justify-content: center;
          }

          .songs-section {
            padding: 0 12px;
          }

          .section-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
            margin-bottom: 16px;
          }

          .section-header h2 {
            font-size: 20px;
          }

          .filter-controls {
            width: 100%;
            justify-content: space-between;
          }

          .filter-controls label {
            font-size: 13px;
          }

          .quality-filter {
            flex: 1;
            max-width: 200px;
            padding: 10px 14px;
            font-size: 13px;
          }

          .songs-grid {
            gap: 2px;
          }
          
          .song-card {
            grid-template-columns: 42px 1fr 36px 36px;
            gap: 10px;
            padding: 10px 8px;
            border-radius: 8px;
          }

          .song-card:active {
            background: rgba(255, 255, 255, 0.15);
            transform: scale(0.98);
          }

          .song-card.playing {
            background: rgba(29, 185, 84, 0.25);
          }
          
          .song-thumb {
            width: 42px;
            height: 42px;
          }
          
          .song-info {
            min-width: 0;
          }

          .song-title {
            font-size: 15px;
            line-height: 1.3;
          }
          
          .song-artist {
            font-size: 13px;
            margin-top: 2px;
          }

          .song-quality,
          .song-duration,
          .song-number {
            display: none;
          }

          .song-quality-unavailable {
            grid-column: 3 / -1;
            font-size: 11px;
            padding-right: 8px;
          }

          .play-btn-small {
            font-size: 20px;
            width: 36px;
            height: 36px;
            opacity: 1;
          }

          /* Estilos para el botón de Like en móvil */
          .song-card :global(.like-btn) {
            font-size: 18px;
          }
        }

        @media (max-width: 480px) {
          .album-cover-large {
            width: 170px;
            height: 170px;
          }

          .album-info h1 {
            font-size: 24px;
          }

          .album-artist {
            font-size: 15px;
          }

          .play-button-main {
            padding: 12px 32px;
            font-size: 14px;
          }

          .song-card {
            grid-template-columns: 40px 1fr 34px 34px;
            gap: 8px;
            padding: 8px 6px;
          }

          .song-thumb {
            width: 40px;
            height: 40px;
          }

          .song-title {
            font-size: 14px;
          }

          .song-artist {
            font-size: 12px;
          }

          .play-btn-small {
            font-size: 18px;
            width: 34px;
            height: 34px;
          }
        }
      `}</style>
    </div>
  );
}