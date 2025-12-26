import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import api from '../api/axiosConfig';
import { usePlayer } from '../context/PlayerContext';
import { useContextMenu } from '../context/ContextMenuContext';
import { IoPlaySharp, IoShuffle, IoEllipsisHorizontal, IoEllipsisVertical, IoTimeOutline } from 'react-icons/io5';
import LikeButton from '../components/LikeButton';
import AmbientBackground from '../components/AmbientBackground';
import '../styles/glass.css';

export default function AlbumPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const songId = searchParams.get('song');

  const [album, setAlbum] = useState(null);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [likedSongs, setLikedSongs] = useState(new Set());

  const { playSongList, currentSong } = usePlayer();
  const { openContextMenu } = useContextMenu();
  const [totalDuration, setTotalDuration] = useState(0);

  useEffect(() => {
    const fetchAlbum = async () => {
      try {
        setLoading(true);

        // 1. Cargar Likes
        try {
          const likedRes = await api.get('/music/songs/likes');
          if (likedRes.data) setLikedSongs(new Set(likedRes.data.map(s => s.id)));
        } catch (e) { console.log("No logueado o error likes"); }

        // 2. Datos del Álbum
        const albumRes = await api.get(`/music/albums/${id}`);
        setAlbum(albumRes.data);

        // 3. Canciones
        const songsRes = await api.get(`/music/albums/${id}/songs`);
        setSongs(songsRes.data);

        const total = songsRes.data.reduce((acc, curr) => acc + (curr.duracion || 0), 0);
        setTotalDuration(total);

        if (songId && songsRes.data.length > 0) {
          const songIndex = songsRes.data.findIndex(s => s.id == songId);
          if (songIndex !== -1) playSongList(songsRes.data, songIndex);
        }

        setLoading(false);
      } catch (err) {
        console.error('Error cargando álbum:', err);
        setError('No se pudo cargar el álbum');
        setLoading(false);
      }
    };

    if (id) fetchAlbum();
  }, [id, songId]);

  const handleSongClick = (index) => {
    playSongList(songs, index);
  };

  const handleLikeToggle = (songId, isLiked) => {
    setLikedSongs(prev => {
      const newSet = new Set(prev);
      isLiked ? newSet.add(songId) : newSet.delete(songId);
      return newSet;
    });
  };

  const handleMenuClick = (e, song) => {
    e.stopPropagation();
    const menuData = {
      id: song.id,
      titulo: song.titulo,
      artista: song.artista,
      album: album?.titulo,
      portada: album?.portada,
      duracion: song.duracion,
      url: song.url || song.filepath
    };
    openContextMenu(e, 'song', menuData);
  };

  const formatQuality = (song) => {
    if (song.bit_depth === 24 || song.bit_depth === 32) return 'Hi-Res';
    if (song.format && song.format.toLowerCase().includes('flac')) return 'FLAC';
    return null;
  };

  const formatTotalDuration = (seconds) => {
    if (!seconds) return "";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h} h ${m} min` : `${m} min`;
  };

  const formatDuration = (seconds) => {
    if (!seconds) return "--:--";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center h-screen text-red-400">
      <h2 className="text-xl font-bold">{error}</h2>
    </div>
  );

  return (
    <div className="relative min-h-screen pb-40">
      {/* Aurora Ambient Background - Premium animated mesh gradient */}
      <div className="fixed inset-0 z-0">
        <AmbientBackground
          songId={album?.id}
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
          <IoEllipsisHorizontal size={24} />
        </button>
      </div>

      <div className="relative z-10 px-6 pt-20 md:pt-24 max-w-7xl mx-auto">
        {/* Hero Section */}
        <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-center md:items-end mb-8 md:mb-12 animate-fade-in text-center md:text-left">
          {/* Cover Art */}
          <div className="w-[60vw] max-w-[250px] aspect-square shadow-2xl rounded-xl overflow-hidden glass-card flex items-center justify-center bg-white/5 mx-auto md:mx-0">
            <img
              src={album?.coverFull || album?.portada || '/default_cover.png'}
              alt={album?.titulo}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>

          <div className="flex-1 min-w-0 w-full">
            {/* 2. Centered Typography Hierarchy */}
            <h5 className="hidden md:block uppercase tracking-widest text-xs font-bold mb-2 text-white/60">Álbum</h5> {/* Hidden on mobile */}

            <h1 className="text-2xl md:text-7xl font-bold text-white mb-2 md:mb-6 tracking-tight line-clamp-3 leading-tight px-4 md:px-0">
              {album?.titulo}
            </h1>

            {/* iOS Style Metadata */}
            <div className="flex flex-col md:flex-row items-center md:items-center gap-1 md:gap-2 mb-8 md:mb-6 justify-center md:justify-start">
              {/* Artist - iOS Accent */}
              {album?.artista_id ? (
                <Link to={`/artist/${album.artista_id}`} className="text-xl md:text-xl font-bold text-[#1db954] hover:underline w-fit">
                  {album?.autor || 'Desconocido'}
                </Link>
              ) : (
                <span className="text-xl md:text-xl font-bold text-[#1db954] w-fit">{album?.autor || 'Desconocido'}</span>
              )}

              {/* Metadata Line */}
              <div className="flex items-center gap-2 text-sm text-gray-400/80 font-medium mt-1 md:mt-0">
                <span className="hidden md:inline">•</span>
                <span className="uppercase tracking-wide">{album?.genre || 'Música'}</span>
                <span>•</span>
                <span>{album?.year || '2024'}</span>
              </div>
            </div>

            {/* 3. Button Precise Refinement */}
            <div className="grid grid-cols-2 gap-3 w-full md:w-auto md:flex md:items-center md:gap-4 mb-2 md:my-0">
              {/* Play Button */}
              <button
                onClick={() => playSongList(songs, 0)}
                className="h-[50px] md:h-14 md:w-14 rounded-full bg-[#1db954] hover:bg-[#1ed760] text-black md:text-black font-semibold text-base md:text-lg flex items-center justify-center shadow-lg hover:scale-105 transition-all"
              >
                <IoPlaySharp size={22} className="mr-1 md:ml-1 md:mr-0" />
                <span className="md:hidden">Reproducir</span>
              </button>

              {/* Shuffle Button - Translucent Glass */}
              <button className="h-[50px] md:h-10 md:w-10 rounded-full bg-white/10 hover:bg-white/20 text-[#1db954] md:text-white font-semibold text-base flex items-center justify-center backdrop-blur-md transition-all border-none md:border md:border-white/20">
                <IoShuffle size={20} className="mr-2 md:mr-0" />
                <span className="md:hidden">Aleatorio</span>
              </button>

              <button className="hidden md:flex w-10 h-10 rounded-full border border-white/20 hover:bg-white/10 items-center justify-center text-white transition-all">
                <IoEllipsisHorizontal size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* 4. Unboxing the Song List */}
        <div className="glass-card md:rounded-xl overflow-hidden animate-slide-up bg-transparent shadow-none border-none md:bg-white/5 md:shadow-xl md:border md:border-white/5">
          {/* Header Row - Hidden on Mobile */}
          <div className="hidden md:grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-6 py-3 border-b border-white/5 text-sm text-gray-400 font-medium uppercase tracking-wider">
            <div className="w-8 text-center">#</div>
            <div>Título</div>
            <div className="text-right">Calidad</div>
            <div className="text-right"><IoTimeOutline size={18} /></div>
            <div className="w-8"></div>
          </div>

          {/* Songs */}
          <div className="flex flex-col pb-4 md:pb-0">
            {songs.map((song, index) => {
              const isPlaying = currentSong?.id === song.id;
              const qualityBadge = formatQuality(song);

              return (
                <div
                  key={song.id}
                  className={`group relative grid grid-cols-[32px_1fr_40px] md:grid-cols-[auto_1fr_auto_auto_auto] gap-3 md:gap-4 px-0 md:px-6 py-2 md:py-3 items-center hover:bg-white/5 transition-colors cursor-pointer min-h-[64px] border-b border-white/5 md:border-b-0 ${isPlaying ? 'bg-white/10 rounded-lg md:rounded-none' : ''}`}
                  onClick={() => handleSongClick(index)}
                >
                  {/* Index / Play Icon */}
                  <div className="text-left md:text-center text-gray-500 font-medium text-sm md:w-8 pl-1 md:pl-0">
                    <span className={`block ${isPlaying ? 'text-[#1db954]' : ''}`}>{index + 1}</span>
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
                    {/* Mobile: Explicit badge placeholder if needed */}
                  </div>

                  {/* Desktop Metadata */}
                  <div className="hidden md:flex justify-end">
                    {qualityBadge && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-white/30 text-white/70 uppercase tracking-wider">
                        {qualityBadge}
                      </span>
                    )}
                  </div>

                  <div className="hidden md:block text-sm text-gray-400 font-variant-numeric tabular-nums text-right">
                    {formatDuration(song.duracion)}
                  </div>

                  {/* Actions / Menu */}
                  <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="p-3 text-gray-400 hover:text-white transition-colors"
                      onClick={(e) => handleMenuClick(e, song)}
                    >
                      <IoEllipsisHorizontal size={20} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}