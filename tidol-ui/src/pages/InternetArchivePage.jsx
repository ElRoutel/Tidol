import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import { useContextMenu } from '../context/ContextMenuContext';
import api from '../api/axiosConfig';
import { IoPlaySharp, IoPauseSharp, IoShuffle, IoEllipsisVertical, IoChevronDown, IoChevronUp } from 'react-icons/io5';
import LikeButton from '../components/LikeButton';
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

      {/* FONDO INMERSIVO */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-top blur-3xl opacity-40 scale-110 pointer-events-none transition-all duration-1000"
        style={{ backgroundImage: `url(${album?.portada})` }}
      />
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-black/20 via-[#0a0a0a]/80 to-[#0a0a0a] pointer-events-none" />

      <div className="relative z-10 px-8 max-w-7xl mx-auto flex flex-col gap-12 pt-32 pb-12">

        {/* HERO SECTION */}
        <div className="flex flex-col md:flex-row items-end gap-8 md:gap-12">
          <div className="w-64 h-64 md:w-72 md:h-72 shrink-0 shadow-2xl rounded-lg overflow-hidden">
            <img src={album?.portada} alt={album?.titulo} className="w-full h-full object-cover" />
          </div>

          <div className="flex flex-col justify-end flex-grow gap-4">
            <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-none shadow-lg">
              {album?.titulo}
            </h1>

            <div className="flex items-center gap-2 text-sm md:text-base font-medium text-white/90 flex-wrap">
              <span className="font-bold text-white">{album?.autor}</span>
              <span className="text-white/50">•</span>
              <span>Internet Archive</span>
              <span className="text-white/50">•</span>
              <span>{album?.year || 'Año desc.'}</span>
            </div>

            <div className="text-sm text-white/60">
              {groupedTracks.length} canciones • {formatTotalDuration(album?.totalDuration)}
            </div>

            {/* Descripción Expandible */}
            {album?.description && (
              <div className="mt-2 max-w-2xl">
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

            {/* BARRA DE ACCIONES */}
            <div className="flex items-center gap-4 mt-4 flex-wrap">
              <button
                onClick={() => playSongList(filteredTracks, 0)}
                className="px-8 py-3 rounded-full bg-white text-black font-bold flex items-center gap-2 hover:scale-105 transition-transform shadow-xl hover:shadow-white/20"
              >
                <IoPlaySharp size={20} />
                <span>Reproducir</span>
              </button>

              <button className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-colors">
                <IoShuffle size={20} />
              </button>

              {/* Selector de Calidad */}
              <div className="relative">
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
        <div className="flex flex-col gap-1">
          {groupedTracks.map((track, index) => {
            const song = (formatFilter === 'best') ? track.best : track.formats.find(f => f.format === formatFilter);
            if (!song) return null;

            const isPlaying = currentSong?.id === song.id;

            return (
              <div
                key={song.id}
                className={`group grid grid-cols-[40px_1fr_auto_auto] md:grid-cols-[50px_1fr_auto_60px_auto] gap-4 items-center p-3 rounded-md hover:bg-white/10 transition-colors cursor-pointer ${isPlaying ? 'bg-white/10' : ''}`}
                onClick={() => handleSongClick(song)}
              >
                <div className="flex justify-center items-center text-gray-400 font-medium text-sm w-8">
                  {isPlaying ? (
                    <IoPlaySharp className="text-[#1db954]" />
                  ) : (
                    <span className="group-hover:hidden">{index + 1}</span>
                  )}
                  <IoPlaySharp className="hidden group-hover:block text-white" />
                </div>

                <div className="min-w-0 flex flex-col">
                  <div className={`font-medium truncate text-sm md:text-base ${isPlaying ? 'text-[#1db954]' : 'text-white'}`}>
                    {song.titulo}
                  </div>
                  <div className="text-xs md:text-sm text-gray-400 truncate">
                    {song.artista}
                  </div>
                </div>

                <div className="hidden md:block">
                  <span className="bg-white/10 text-gray-300 text-[10px] px-2 py-0.5 rounded font-bold">
                    {song.format}
                  </span>
                </div>

                <div className="text-sm text-gray-400 font-variant-numeric tabular-nums text-right hidden md:block">
                  {Math.floor(song.duracion / 60)}:{Math.floor(song.duracion % 60).toString().padStart(2, '0')}
                </div>

                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <LikeButton
                    song={song}
                    isLiked={likedSongs.has(song.identifier)}
                    onLikeToggle={handleLikeToggle}
                    isArchive={true}
                  />

                  <button
                    className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100"
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