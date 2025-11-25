import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import api from '../api/axiosConfig';
import { usePlayer } from '../context/PlayerContext';
import { useContextMenu } from '../context/ContextMenuContext';
import { IoPlaySharp, IoShuffle, IoEllipsisHorizontal, IoEllipsisVertical, IoTimeOutline } from 'react-icons/io5';
import LikeButton from '../components/LikeButton';
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
      {/* Ambient Background */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center blur-3xl opacity-30 scale-110 pointer-events-none transition-all duration-1000"
        style={{ backgroundImage: `url(${album?.portada || '/default_cover.png'})` }}
      />
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-black/20 via-[#0a0a0a]/80 to-[#0a0a0a] pointer-events-none" />

      <div className="relative z-10 px-8 pt-24 max-w-7xl mx-auto">
        {/* Hero Section */}
        <div className="flex flex-col md:flex-row gap-8 items-end mb-12 animate-fade-in">
          <div className="w-64 h-64 shadow-2xl rounded-xl overflow-hidden glass-card flex items-center justify-center bg-white/5">
            <img
              src={album?.portada || '/default_cover.png'}
              alt={album?.titulo}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex-1">
            <h5 className="uppercase tracking-widest text-xs font-bold mb-2 text-white/80">Álbum</h5>
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight">{album?.titulo}</h1>

            <div className="flex items-center gap-2 text-sm text-gray-300 mb-6">
              {album?.artista_id ? (
                <Link to={`/artist/${album.artista_id}`} className="font-medium text-white hover:underline">
                  {album?.autor || 'Desconocido'}
                </Link>
              ) : (
                <span className="font-medium text-white">{album?.autor || 'Desconocido'}</span>
              )}
              <span>•</span>
              <span>{album?.year || '2024'}</span>
              <span>•</span>
              <span>{songs.length} canciones</span>
              <span>•</span>
              <span>{formatTotalDuration(totalDuration)}</span>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => playSongList(songs, 0)}
                className="w-14 h-14 rounded-full bg-[#1db954] hover:bg-[#1ed760] text-black flex items-center justify-center shadow-lg hover:scale-105 transition-all"
              >
                <IoPlaySharp size={28} className="ml-1" />
              </button>
              <button className="w-10 h-10 rounded-full border border-white/20 hover:bg-white/10 flex items-center justify-center text-white transition-all">
                <IoShuffle size={20} />
              </button>
              <button className="w-10 h-10 rounded-full border border-white/20 hover:bg-white/10 flex items-center justify-center text-white transition-all">
                <IoEllipsisHorizontal size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Tracks List */}
        <div className="glass-card rounded-xl overflow-hidden animate-slide-up">
          {/* Header Row */}
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-6 py-3 border-b border-white/5 text-sm text-gray-400 font-medium uppercase tracking-wider">
            <div className="w-8 text-center">#</div>
            <div>Título</div>
            <div className="hidden md:block text-right">Calidad</div>
            <div className="hidden md:block text-right"><IoTimeOutline size={18} /></div>
            <div className="w-8"></div>
          </div>

          {/* Songs */}
          {songs.map((song, index) => {
            const isPlaying = currentSong?.id === song.id;
            const qualityBadge = formatQuality(song);

            return (
              <div
                key={song.id}
                className={`group grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-6 py-3 items-center hover:bg-white/5 transition-colors cursor-pointer border-b border-white/5 last:border-0 ${isPlaying ? 'bg-white/10' : ''}`}
                onClick={() => handleSongClick(index)}
              >
                <div className="w-8 text-center text-gray-400 group-hover:text-white relative flex items-center justify-center">
                  <span className={`group-hover:hidden ${isPlaying ? 'text-[#1db954]' : ''}`}>{index + 1}</span>
                  <IoPlaySharp className="hidden group-hover:block text-white" />
                </div>

                <div className="min-w-0">
                  <div className={`font-medium truncate ${isPlaying ? 'text-[#1db954]' : 'text-white'}`}>
                    {song.titulo}
                  </div>
                  <div className="text-sm text-gray-400 truncate group-hover:text-gray-300">
                    {song.artista}
                  </div>
                </div>

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

                <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                  <LikeButton
                    song={song}
                    isLiked={likedSongs.has(song.id)}
                    onLikeToggle={handleLikeToggle}
                  />
                  <button
                    className="p-2 text-gray-400 hover:text-white transition-colors"
                    onClick={(e) => handleMenuClick(e, song)}
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