import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/axiosConfig';
import { usePlayer } from '../context/PlayerContext';
import { IoPlaySharp, IoTimeOutline, IoShuffle, IoHeartOutline, IoDownloadOutline, IoEllipsisHorizontal } from 'react-icons/io5';
import '../styles/glass.css';

export default function AlbumPage() {
  const { id } = useParams();
  const [album, setAlbum] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { playSongList, currentSong } = usePlayer();

  useEffect(() => {
    const fetchAlbum = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get(`/albums/${id}`);
        setAlbum(res.data);
      } catch (err) {
        console.error('Error cargando álbum:', err);
        setError('No se pudo cargar el álbum.');
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchAlbum();
  }, [id]);

  const handleTrackClick = (index) => {
    if (!album || !album.tracks) return;
    const normalizedSongs = album.tracks.map((t) => ({
      id: t.trackId,
      trackId: t.trackId,
      trackName: t.title,
      artistName: album.artistName,
      albumName: album.title,
      coverArtUrl: album.coverUrl,
      sourceType: 'musicbrainz',
      type: 'songs',
      attributes: {
        name: t.title,
        artistName: album.artistName,
        albumName: album.title,
        durationInSeconds: t.duration || 0,
        artwork: { url: album.coverUrl }
      }
    }));
    playSongList(normalizedSongs, index);
  };

  const formatDuration = (seconds) => {
    if (!seconds) return "--:--";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) return (
    <div className="relative min-h-screen pb-40 overflow-x-hidden bg-black animate-pulse">

      <div className="w-full h-[50vh] bg-white/5"></div>
      <div className="relative z-10 -mt-[20vh] px-4 md:px-8 max-w-[1600px] mx-auto flex flex-col justify-end">
        <div className="flex flex-col md:flex-row gap-6 md:gap-10 items-end mb-10">
            <div className="w-56 h-56 md:w-72 md:h-72 lg:w-80 lg:h-80 bg-white/10 rounded-lg flex-shrink-0"></div>
            <div className="flex flex-col justify-end gap-4 w-full">
                <div className="hidden md:block h-4 bg-white/10 rounded w-24"></div>
                <div className="h-12 md:h-20 lg:h-24 bg-white/10 rounded w-3/4"></div>
                <div className="h-6 bg-white/10 rounded w-1/3"></div>
            </div>
        </div>
        <div className="flex items-center gap-6 mb-8 py-4 border-b border-white/5 md:border-none">
            <div className="h-16 w-16 bg-white/10 rounded-full"></div>
        </div>
        <div className="space-y-1 mt-4">
            {[1,2,3,4,5,6].map(i => (
                <div key={i} className="flex gap-4 items-center h-16 bg-transparent rounded-md px-4 border border-transparent">
                    <div className="w-8 h-8 bg-white/5 rounded"></div>
                    <div className="flex-1 space-y-2">
                        <div className="h-4 bg-white/10 rounded w-1/3"></div>
                        <div className="h-3 bg-white/5 rounded w-1/4"></div>
                    </div>
                    <div className="w-8 h-8 bg-white/5 rounded-full"></div>
                </div>
            ))}
        </div>
      </div>
    </div>
  );

  if (error || !album) return (
    <div className="flex items-center justify-center min-h-screen bg-black text-red-400">
      <h2 className="text-2xl font-bold">{error || "Álbum no encontrado"}</h2>
    </div>
  );

  return (
    <div className="relative min-h-screen pb-40 overflow-x-hidden bg-[#121212]">
      {/* Blurred album art glow */}
      <div className="absolute top-0 left-0 w-full h-[60vh] z-0 pointer-events-none overflow-hidden">
        <div 
          className="w-full h-full bg-cover bg-center blur-[100px] opacity-50 scale-150"
          style={{ backgroundImage: `url(${album.coverUrl || '/default-album.png'})` }}
        ></div>
      </div>
      {/* Gradient overlay: fades the glow into the page base color */}
      <div className="absolute top-0 left-0 w-full h-[60vh] z-[1] pointer-events-none bg-gradient-to-b from-black/30 via-[#121212]/70 to-[#121212]"></div>

      <div className="relative z-10 px-4 md:px-8 pt-24 md:pt-32 max-w-[1600px] mx-auto">
        {/* Hero Section */}
        <div className="flex flex-col md:flex-row gap-6 md:gap-10 items-end mb-6 animate-fade-in text-center md:text-left">
          {/* Cover Art */}
          <div className="w-50 h-50 md:w-56 md:h-56 lg:w-64 lg:h-64 shadow-[0_8px_30px_rgba(0,0,0,0.5)] rounded-md overflow-hidden flex-shrink-0">
            <img
              src={album.coverUrl || '/default-album.png'}
              alt={album.title}
              onError={(e) => {
                  e.currentTarget.src = '/default-album.png';
                  if (album?.mbid) {
                      api.post(`/albums/${album.mbid}/report-cover-404`).catch(() => {});
                  }
              }}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>

          <div className="flex flex-col flex-1 w-full justify-end">
            <h5 className="hidden md:block uppercase tracking-widest text-xs font-bold mb-2 text-white/70">Álbum</h5>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white mb-4 tracking-tight leading-none">
              {album.title}
            </h1>
            
            <div className="flex flex-row items-center gap-2 text-sm text-gray-300 font-medium">
              <img src={album.coverUrl || '/default-album.png'} className="w-5 h-5 rounded-full object-cover" alt={album.artistName} onError={(e) => { 
                  e.currentTarget.onerror = null; 
                  e.currentTarget.src = '/default-album.png'; 
                  if (album?.mbid) {
                      api.post(`/albums/${album.mbid}/report-cover-404`).catch(() => {});
                  }
              }} />
              <span className="text-white hover:underline cursor-pointer font-bold">{album.artistName}</span>
              <span className="text-white/40">•</span>
              <span className="text-white/60">{album.releaseYear || 'Quien sabe'}</span>
              <span className="text-white/40">•</span>
              <span className="text-white/60">{album.tracks?.length || 0} canciones</span>
            </div>
          </div>
        </div>

        {/* Play Action Row */}
        <div className="flex items-center gap-5 mt-6 mb-8">
            <button
              onClick={() => handleTrackClick(0)}
              className="h-14 w-14 rounded-full bg-[#1db954] hover:bg-[#1ed760] text-black flex items-center justify-center shadow-lg hover:scale-105 transition-all flex-shrink-0"
            >
              <IoPlaySharp size={28} className="ml-0.5" />
            </button>
            <button className="text-gray-400 hover:text-white transition-colors p-1">
                <IoShuffle size={24} />
            </button>
            <button className="text-gray-400 hover:text-white transition-colors p-1">
                <IoHeartOutline size={24} />
            </button>
            <button className="text-gray-400 hover:text-white transition-colors p-1">
                <IoDownloadOutline size={22} />
            </button>
            <button className="text-gray-400 hover:text-white transition-colors p-1">
                <IoEllipsisHorizontal size={24} />
            </button>
        </div>

        {/* Tracks Table */}
        <div className="animate-slide-up">
          <div className="grid grid-cols-[auto_1fr_auto] gap-4 px-4 py-2 border-b border-white/10 text-xs text-gray-500 font-medium uppercase tracking-widest mb-2">
            <div className="w-8 text-center">#</div>
            <div>Título</div>
            <div className="text-right flex justify-end"><IoTimeOutline size={16} /></div>
          </div>

          <div className="flex flex-col pb-2">
            {album.tracks?.map((track, index) => {
              const isPlaying = currentSong?.id === track.trackId;
              
              return (
                <div
                  key={track.trackId}
                  className={`group grid grid-cols-[auto_1fr_auto] gap-4 px-4 py-3 items-center hover:bg-white/10 transition-colors cursor-pointer rounded-md mb-1 ${isPlaying ? 'bg-white/10' : ''}`}
                  onClick={() => handleTrackClick(index)}
                >
                  <div className="w-8 flex items-center justify-end text-gray-400 font-medium text-base group-hover:text-white transition-colors">
                    <span className={`block group-hover:hidden ${isPlaying ? 'text-[#1db954]' : ''}`}>{track.trackNumber || index + 1}</span>
                    <IoPlaySharp className="hidden group-hover:block text-white" size={18} />
                  </div>

                  <div className="min-w-0 flex flex-col justify-center">
                    <div className={`text-base md:text-lg font-medium leading-tight truncate ${isPlaying ? 'text-[#1db954]' : 'text-white'}`}>
                      {track.title}
                    </div>
                    <div className="text-sm text-gray-400 truncate mt-1">
                      {album.artistName}
                    </div>
                  </div>

                  <div className="text-sm text-gray-400 font-variant-numeric tabular-nums text-right w-16 group-hover:text-white transition-colors flex justify-end items-center gap-2">
                    {isPlaying && <span className="text-[#1db954] font-bold text-xs">✓</span>}
                    {formatDuration(track.duration)}
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
