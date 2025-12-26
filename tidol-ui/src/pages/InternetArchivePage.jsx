import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import { useContextMenu } from '../context/ContextMenuContext';
import useLazyCaching from '../hooks/useLazyCaching';
import api from '../api/axiosConfig';
import { IoPlaySharp, IoPauseSharp, IoShuffle, IoEllipsisVertical, IoChevronDown, IoChevronUp, IoTimeOutline } from 'react-icons/io5';
import LikeButton from '../components/LikeButton';
import AmbientBackground from '../components/AmbientBackground';
import '../styles/glass.css';

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

  const { currentSong } = usePlayer();
  const { openContextMenu } = useContextMenu();
  const { handlePlayList } = useLazyCaching();

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

    if (shouldAutoplay && tracksToShow.length > 0) handlePlayList(tracksToShow, 0);
  }, [allFiles, formatFilter, shouldAutoplay, handlePlayList]);

  const handleSongClick = (song) => {
    const index = filteredTracks.findIndex(t => t.id === song.id);
    if (index !== -1) handlePlayList(filteredTracks, index);
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

  if (loading) return (
    <div className="flex justify-center items-center h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
    </div>
  );

  if (error) return (
    <div className="flex justify-center items-center h-screen text-red-400">
      <h2 className="text-2xl font-bold">{error}</h2>
    </div>
  );

  return (
    <div className="relative min-h-screen pb-40 overflow-x-hidden font-sans text-white">

      {/* Aurora Ambient Background - Premium animated mesh gradient */}
      <div className="fixed inset-0 z-0">
        <AmbientBackground
          songId={identifier}
          colors={album?.extractedColors}
          intensity={0.5}
        />
      </div>
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-black/20 via-[#0a0a0a]/80 to-[#0a0a0a] pointer-events-none" />

      {/* 1. Immersive Header & Navigation (Mobile Only) */}
      <div className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-4 py-4 md:hidden bg-transparent">
        <button
          onClick={() => window.history.back()}
          className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <button
          onClick={(e) => openContextMenu && openContextMenu(e, 'album', album)}
          className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white"
        >
          <IoEllipsisVertical size={24} />
        </button>
      </div>

      <div className="relative z-10 px-6 pt-20 md:pt-32 pb-12 max-w-7xl mx-auto flex flex-col gap-8 md:gap-12">

        {/* HERO SECTION */}
        <div className="flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-12 text-center md:text-left">
          <div className="w-[60vw] max-w-[250px] aspect-square md:w-72 md:h-72 shrink-0 shadow-2xl rounded-xl overflow-hidden glass-card flex items-center justify-center bg-white/5 mx-auto md:mx-0">
            <img src={album?.portada} alt={album?.titulo} className="w-full h-full object-cover" loading="lazy" />
          </div>

          <div className="flex flex-col justify-end flex-grow gap-2 md:gap-4 w-full">
            <h1 className="text-2xl md:text-6xl font-black tracking-tight leading-tight shadow-md md:shadow-none line-clamp-3 px-2 md:px-0">
              {album?.titulo}
            </h1>

            {/* iOS Style Metadata */}
            <div className="flex flex-col md:flex-row items-center md:items-center gap-1 md:gap-2 justify-center md:justify-start">
              <span className="text-xl md:text-xl font-bold text-[#1db954]">{album?.autor}</span>

              <div className="flex items-center gap-2 text-sm text-gray-400 font-medium mt-1 md:mt-0">
                <span className="hidden md:inline">•</span>
                <span>Internet Archive</span>
                <span className="text-white/30">•</span>
                <span>{album?.year || 'Año desc.'}</span>
              </div>
            </div>

            <div className="text-sm text-white/50 font-medium mt-1 hidden md:block">
              {groupedTracks.length} canciones • {formatTotalDuration(album?.totalDuration)}
            </div>

            {/* Descripción Expandible (Mobile centered, Desktop aligned) */}
            {album?.description && (
              <div className="mt-2 max-w-2xl mx-auto md:mx-0 text-left">
                <div
                  className={`text-sm text-white/70 leading-relaxed overflow-hidden transition-all duration-300 ${isDescriptionExpanded ? 'max-h-[800px]' : 'max-h-[42px] line-clamp-2'}`}
                  dangerouslySetInnerHTML={{ __html: album.description }}
                />
                <button
                  onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                  className="mt-1 text-xs font-bold text-white/90 hover:text-white flex items-center gap-1"
                >
                  {isDescriptionExpanded ? 'Menos' : 'Más'}
                  {isDescriptionExpanded ? <IoChevronUp /> : <IoChevronDown />}
                </button>
              </div>
            )}

            {/* BARRA DE ACCIONES (iOS Pills vs Desktop Buttons) */}
            <div className="grid grid-cols-2 gap-3 w-full md:w-auto md:flex md:items-center md:gap-4 mt-6 md:mt-4">
              <button
                onClick={() => handlePlayList(filteredTracks, 0)}
                className="h-[50px] md:h-12 md:px-8 md:py-3 rounded-full bg-[#1db954] md:bg-white text-black font-bold flex items-center justify-center gap-2 hover:scale-105 transition-transform shadow-lg md:shadow-xl group"
              >
                <IoPlaySharp size={22} className="group-hover:scale-110 transition-transform" />
                <span>Reproducir</span>
              </button>

              <select
                value={formatFilter}
                onChange={(e) => setFormatFilter(e.target.value)}
                className="appearance-none bg-white/10 text-white/90 border border-white/10 px-4 py-2 pr-8 rounded-full text-sm font-medium hover:bg-white/20 focus:outline-none cursor-pointer transition-colors"
              >
                <option value="best" className="bg-gray-900">Calidad: Mejor</option>
                {availableFormats.map(f => <option key={f} value={f} className="bg-gray-900">{f}</option>)}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/50">
                <IoChevronDown size={14} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* LISTA DE CANCIONES */}
      <div className="glass-card md:rounded-xl overflow-hidden animate-slide-up bg-transparent shadow-none border-none md:bg-white/5 md:shadow-xl md:border md:border-white/5">
        {/* Header Row - Hidden on Mobile */}
        <div className="hidden md:grid grid-cols-[50px_1fr_auto_60px_auto] gap-4 px-6 py-3 border-b border-white/5 text-sm text-gray-400 font-medium uppercase tracking-wider">
          <div className="w-8 text-center">#</div>
          <div>Título</div>
          <div className="text-right">Formato</div>
          <div className="text-right"><IoTimeOutline size={18} /></div>
          <div className="w-8"></div>
        </div>

        <div className="flex flex-col pb-4 md:pb-0">
          {groupedTracks.map((track, index) => {
            const song = (formatFilter === 'best') ? track.best : track.formats.find(f => f.format === formatFilter);
            if (!song) return null;

            const isPlaying = currentSong?.id === song.id;

            return (
              <div
                key={song.id}
                className={`group relative grid grid-cols-[32px_1fr_40px] md:grid-cols-[50px_1fr_auto_60px_auto] gap-3 md:gap-4 px-0 md:px-6 py-2 md:py-3 items-center hover:bg-white/5 transition-colors cursor-pointer min-h-[64px] border-b border-white/5 md:border-b-0 ${isPlaying ? 'bg-white/10 rounded-lg md:rounded-none' : ''}`}
                onClick={() => handleSongClick(song)}
              >
                {/* Index / Play Icon */}
                <div className="text-left md:text-center text-gray-500 font-medium text-sm md:w-8 pl-1 md:pl-0 flex items-center justify-start md:justify-center">
                  {isPlaying ? (
                    <IoPlaySharp className="text-[#1db954]" />
                  ) : (
                    <span className="block group-hover:hidden">{index + 1}</span>
                  )}
                  <IoPlaySharp className={`hidden group-hover:block text-white ${isPlaying ? 'hidden' : ''}`} />
                </div>

                {/* Title & Artist Stack */}
                <div className="min-w-0 flex flex-col justify-center">
                  <div className={`text-[16px] font-medium leading-tight truncate mb-0.5 ${isPlaying ? 'text-[#1db954]' : 'text-white'}`}>
                    {song.titulo}
                  </div>
                  {/* Mobile: Hide Artist Name (Redundant) */}
                  <div className="hidden md:block text-[14px] text-gray-400 truncate font-normal">
                    {song.artista}
                  </div>
                </div>

                {/* Desktop Metadata */}
                <div className="hidden md:block text-right">
                  <span className="bg-white/10 text-gray-300 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                    {song.format}
                  </span>
                </div>

                <div className="text-sm text-gray-400 font-variant-numeric tabular-nums text-right hidden md:block">
                  {Math.floor(song.duracion / 60)}:{Math.floor(song.duracion % 60).toString().padStart(2, '0')}
                </div>

                {/* Actions / Menu */}
                <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                  <LikeButton
                    song={song}
                    isLiked={likedSongs.has(song.identifier)}
                    onLikeToggle={handleLikeToggle}
                  />
                  <button
                    className="p-3 md:p-2 text-gray-400 hover:text-white transition-colors"
                    onClick={(e) => handleMenuClick(e, song)}
                  >
                    <IoEllipsisVertical size={20} />
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