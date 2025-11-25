import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import { useContextMenu } from '../context/ContextMenuContext';
import api from '../api/axiosConfig';
import { IoPlaySharp, IoPauseSharp, IoShuffle, IoEllipsisVertical } from 'react-icons/io5';
import LikeButton from '../components/LikeButton';

// ✅ IMPORTAMOS EL CSS EXTERNO
import './ImmersiveLayout.css';

const qualityRank = {
  'FLAC': 1, 'WAV': 2, 'M4A': 3, 'MP3': 4, 'OGG': 5, 'unknown': 100
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
  const [likedSongs, setLikedSongs] = useState(new Set());

  const { playSongList, currentSong } = usePlayer();
  const { openContextMenu } = useContextMenu();

  const findBestCover = (files, identifier) => {
    const imageFiles = Object.values(files)
      .filter(f => f.name && /\.(jpg|jpeg|png|gif)$/i.test(f.name))
      .map(f => ({
        name: f.name,
        size: f.size || 0,
        url: `https://archive.org/download/${identifier}/${encodeURIComponent(f.name)}`
      }));

    if (imageFiles.length === 0) return `https://archive.org/services/img/${identifier}`;

    const preferredNames = ['cover', 'folder', 'album', 'front', 'artwork'];
    for (const prefName of preferredNames) {
      const found = imageFiles.find(f => f.name.toLowerCase().includes(prefName));
      if (found) return found.url;
    }
    imageFiles.sort((a, b) => b.size - a.size);
    return imageFiles[0].url;
  };

  useEffect(() => {
    const fetchAlbumData = async () => {
      try {
        setLoading(true);
        const metaRes = await api.get(`https://archive.org/metadata/${identifier}`);
        const metaData = metaRes.data;

        try {
          const likedRes = await api.get('/music/ia/likes');
          if (likedRes.data) setLikedSongs(new Set(likedRes.data.map(s => s.identifier)));
        } catch (e) { console.log("Info: No logueado o sin likes"); }

        if (!metaData || !metaData.metadata) throw new Error('No se encontraron metadatos.');

        const highQualityCover = findBestCover(metaData.files || {}, identifier);

        const albumInfo = {
          titulo: metaData.metadata?.title || identifier,
          autor: metaData.metadata?.creator || 'Autor desconocido',
          portada: highQualityCover,
          year: metaData.metadata?.year || metaData.metadata?.date || null,
          description: metaData.metadata?.description || null,
          totalDuration: 0
        };

        const audioFiles = Object.values(metaData.files || {})
          .filter(f => f.name.match(/\.(mp3|flac|wav|m4a|ogg|MPEG-4)$/i))
          .map(f => {
            const format = (f.format || 'unknown').replace('Audio', '').trim().toUpperCase();
            const duration = parseFloat(f.length) || 0;
            albumInfo.totalDuration += duration;

            return {
              titulo: f.name.split('/').pop().replace(/\.[^/.]+$/, '').replace(/^\d+\.\s*/, ''),
              format: format,
              formatRank: qualityRank[format] || 100,
              url: `https://archive.org/download/${identifier}/${encodeURIComponent(f.name)}`,
              artista: albumInfo.autor,
              album: albumInfo.titulo,
              id: `${identifier}_${f.name}`,
              identifier: `${identifier}_${f.name}`,
              parent_identifier: identifier,
              portada: highQualityCover,
              duracion: duration,
            };
          });

        setAlbum(albumInfo);
        if (audioFiles.length === 0) setError('No se encontraron archivos de audio.');
        setAllFiles(audioFiles);

        const formats = [...new Set(audioFiles.map(f => f.format))];
        formats.sort((a, b) => (qualityRank[a] || 100) - (qualityRank[b] || 100));
        setAvailableFormats(formats);

      } catch (err) {
        setError(err.message || 'Error cargando álbum.');
      } finally {
        setLoading(false);
      }
    };
    fetchAlbumData();
  }, [identifier]);

  useEffect(() => {
    if (allFiles.length === 0) return;
    const grouped = allFiles.reduce((acc, file) => {
      if (!acc[file.titulo]) acc[file.titulo] = { title: file.titulo, artist: file.artista, formats: [] };
      acc[file.titulo].formats.push(file);
      return acc;
    }, {});

    const finalGroupedTracks = Object.values(grouped).map(track => {
      track.formats.sort((a, b) => a.formatRank - b.formatRank);
      return { ...track, best: track.formats[0] };
    });
    setGroupedTracks(finalGroupedTracks);

    let tracksToShow = formatFilter === 'best'
      ? finalGroupedTracks.map(track => track.best)
      : finalGroupedTracks.map(track => track.formats.find(f => f.format === formatFilter)).filter(Boolean);

    setFilteredTracks(tracksToShow);

    if (shouldAutoplay && tracksToShow.length > 0) playSongList(tracksToShow, 0);
  }, [allFiles, formatFilter, shouldAutoplay, playSongList]);

  const handleSongClick = (song) => {
    const index = filteredTracks.findIndex(t => t.id === song.id);
    if (index !== -1) playSongList(filteredTracks, index);
  };

  const handleLikeToggle = (songIdentifier, isLiked) => {
    setLikedSongs(prev => {
      const newSet = new Set(prev);
      isLiked ? newSet.add(songIdentifier) : newSet.delete(songIdentifier);
      return newSet;
    });
  };

  const handleMenuClick = (e, song) => {
    e.stopPropagation();
    // Normalizar datos para el menú global
    const menuData = {
      ...song,
      type: 'ia-song' // Identificador especial si es necesario, o usar 'song' genérico
    };
    openContextMenu(e, 'song', menuData);
  };

  const formatTotalDuration = (seconds) => {
    if (!seconds) return "";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h} h ${m} min` : `${m} min`;
  };

  if (loading) return <div className="ia-loading"><div className="loading-spinner" /></div>;
  if (error) return <div className="ia-error"><h2>{error}</h2></div>;

  return (
    <div className="yt-album-page">

      {/* FONDO INMERSIVO */}
      <div
        className="ambient-background"
        style={{ backgroundImage: `url(${album?.portada})` }}
      />
      <div className="ambient-overlay" />

      <div className="content-wrapper">

        {/* HERO SECTION */}
        <div className="album-hero">
          <div className="cover-container">
            <img src={album?.portada} alt={album?.titulo} className="hero-cover" />
          </div>

          <div className="hero-details">
            <h1 className="album-title">{album?.titulo}</h1>

            <div className="album-meta-row">
              <span className="artist-name">{album?.autor}</span>
              <span className="meta-dot">•</span>
              <span className="meta-text">Internet Archive</span>
              <span className="meta-dot">•</span>
              <span className="meta-text">{album?.year || 'Año desc.'}</span>
            </div>

            <div className="album-stats">
              {groupedTracks.length} canciones • {formatTotalDuration(album?.totalDuration)}
            </div>

            {/* Descripción Expandible */}
            {album?.description && (
              <div className={`description-box ${isDescriptionExpanded ? 'expanded' : ''}`}>
                <div className="description-content" dangerouslySetInnerHTML={{ __html: album.description }} />
                <button onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)} className="desc-toggle">
                  {isDescriptionExpanded ? 'Menos' : 'Más'}
                </button>
              </div>
            )}

            {/* BARRA DE ACCIONES */}
            <div className="action-bar">
              <button onClick={() => playSongList(filteredTracks, 0)} className="btn-primary-white">
                <IoPlaySharp /> <span>Reproducir</span>
              </button>

              <button className="btn-circle-glass">
                <IoShuffle />
              </button>

              {/* Selector de Calidad */}
              <div className="quality-wrapper">
                <select
                  value={formatFilter}
                  onChange={(e) => setFormatFilter(e.target.value)}
                  className="quality-select-glass"
                >
                  <option value="best">Calidad</option>
                  {availableFormats.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* LISTA DE CANCIONES */}
        <div className="tracks-container">
          {groupedTracks.map((track, index) => {
            const song = (formatFilter === 'best') ? track.best : track.formats.find(f => f.format === formatFilter);
            if (!song) return null;

            const isPlaying = currentSong?.id === song.id;

            return (
              <div
                key={song.id}
                className={`track-row ${isPlaying ? 'playing' : ''}`}
                onClick={() => handleSongClick(song)}
              >
                <div className="track-col-index">
                  <span className="number">{index + 1}</span>
                  <span className="icon"><IoPlaySharp /></span>
                </div>

                <div className="track-col-info">
                  <div className="track-title">{song.titulo}</div>
                  <div className="track-artist">{song.artista}</div>
                </div>

                <div className="track-col-meta mobile-hide">
                  <span className="format-badge">{song.format}</span>
                </div>

                <div className="track-col-duration mobile-hide">
                  {Math.floor(song.duracion / 60)}:{Math.floor(song.duracion % 60).toString().padStart(2, '0')}
                </div>

                <div className="track-col-actions" onClick={(e) => e.stopPropagation()}>
                  <LikeButton
                    song={song}
                    isLiked={likedSongs.has(song.identifier)}
                    onLikeToggle={handleLikeToggle}
                    isArchive={true}
                  />

                  <button
                    className="track-menu-btn"
                    onClick={(e) => handleMenuClick(e, song)}
                    aria-label="Más opciones"
                  >
                    <IoEllipsisVertical size={18} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}