import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/axiosConfig';
import { usePlayer } from '../context/PlayerContext';
import { usePlaylist } from '../context/PlaylistContext';
import { IoPlaySharp, IoShuffle, IoEllipsisHorizontal, IoTrashOutline, IoTimeOutline } from 'react-icons/io5';
import '../styles/glass.css';
import './ImmersiveLayout.css'; // Mantener estilos específicos de layout inmersivo si son necesarios

export default function PlaylistPage() {
    const { id } = useParams();
    const [playlist, setPlaylist] = useState(null);
    const [songs, setSongs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const { playSongList, currentSong } = usePlayer();
    const { removeSongFromPlaylist } = usePlaylist();
    const [totalDuration, setTotalDuration] = useState(0);

    useEffect(() => {
        const fetchPlaylist = async () => {
            try {
                setLoading(true);
                // Try to fetch from API first
                try {
                    const res = await api.get(`/playlists/${id}`);
                    setPlaylist(res.data);

                    if (res.data.songs) {
                        setSongs(res.data.songs);
                    } else {
                        const songsRes = await api.get(`/playlists/${id}/songs`);
                        setSongs(songsRes.data);
                    }
                } catch (err) {
                    console.warn("API fetch failed, trying local fallback", err);
                    const local = localStorage.getItem('tidol_playlists');
                    if (local) {
                        const parsed = JSON.parse(local);
                        const found = parsed.find(p => p.id.toString() === id);
                        if (found) {
                            setPlaylist(found);
                            setSongs(found.songs || []);
                        } else {
                            throw new Error("Playlist not found locally");
                        }
                    }
                }
                setLoading(false);
            } catch (err) {
                console.error('Error loading playlist:', err);
                setError('No se pudo cargar la playlist');
                setLoading(false);
            }
        };

        if (id) fetchPlaylist();
    }, [id]);

    useEffect(() => {
        if (songs.length > 0) {
            const total = songs.reduce((acc, curr) => acc + (curr.duracion || curr.duration || 0), 0);
            setTotalDuration(total);
        }
    }, [songs]);

    const handleSongClick = (index) => {
        playSongList(songs, index);
    };

    const handleDeleteSong = async (e, songId) => {
        e.stopPropagation();
        if (window.confirm("¿Quitar canción de la playlist?")) {
            const success = await removeSongFromPlaylist(id, songId);
            if (success) {
                setSongs(prev => prev.filter(s => s.id !== songId));
            }
        }
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
                style={{ backgroundImage: `url(${songs[0]?.portada || songs[0]?.cover_url || '/default_cover.png'})` }}
            />
            <div className="fixed inset-0 z-0 bg-gradient-to-b from-black/20 via-[#0a0a0a]/80 to-[#0a0a0a] pointer-events-none" />

            <div className="relative z-10 px-8 pt-24 max-w-7xl mx-auto">
                {/* Hero Section */}
                <div className="flex flex-col md:flex-row gap-8 items-end mb-12 animate-fade-in">
                    <div className="w-64 h-64 shadow-2xl rounded-xl overflow-hidden glass-card flex items-center justify-center bg-white/5">
                        {songs.length > 0 ? (
                            <img
                                src={songs[0]?.portada || songs[0]?.cover_url}
                                alt={playlist?.nombre}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <span className="text-6xl">🎵</span>
                        )}
                    </div>

                    <div className="flex-1">
                        <h5 className="uppercase tracking-widest text-xs font-bold mb-2 text-white/80">Playlist</h5>
                        <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight">{playlist?.nombre}</h1>

                        <div className="flex items-center gap-2 text-sm text-gray-300 mb-6">
                            <span className="font-medium text-white">Creado por ti</span>
                            <span>•</span>
                            <span>{songs.length} canciones</span>
                            <span>•</span>
                            <span>{formatTotalDuration(totalDuration)}</span>
                        </div>

                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => playSongList(songs, 0)}
                                className="w-14 h-14 rounded-full bg-[#1db954] hover:bg-[#1ed760] text-black flex items-center justify-center shadow-lg hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={songs.length === 0}
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
                    <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 px-6 py-3 border-b border-white/5 text-sm text-gray-400 font-medium uppercase tracking-wider">
                        <div className="w-8 text-center">#</div>
                        <div>Título</div>
                        <div className="hidden md:block"><IoTimeOutline size={18} /></div>
                        <div className="w-8"></div>
                    </div>

                    {/* Songs */}
                    {songs.length === 0 ? (
                        <div className="text-center py-16 text-gray-500">
                            <p className="text-lg mb-2">Esta playlist está vacía</p>
                            <p className="text-sm">Agrega canciones desde el menú contextual</p>
                        </div>
                    ) : (
                        songs.map((song, index) => {
                            const isPlaying = currentSong?.id === song.id;
                            return (
                                <div
                                    key={song.id || index}
                                    className={`group grid grid-cols-[auto_1fr_auto_auto] gap-4 px-6 py-3 items-center hover:bg-white/5 transition-colors cursor-pointer border-b border-white/5 last:border-0 ${isPlaying ? 'bg-white/10' : ''}`}
                                    onClick={() => handleSongClick(index)}
                                >
                                    <div className="w-8 text-center text-gray-400 group-hover:text-white relative flex items-center justify-center">
                                        <span className={`group-hover:hidden ${isPlaying ? 'text-[#1db954]' : ''}`}>{index + 1}</span>
                                        <IoPlaySharp className="hidden group-hover:block text-white" />
                                    </div>

                                    <div className="min-w-0">
                                        <div className={`font-medium truncate ${isPlaying ? 'text-[#1db954]' : 'text-white'}`}>
                                            {song.titulo || song.title}
                                        </div>
                                        <div className="text-sm text-gray-400 truncate group-hover:text-gray-300">
                                            {song.artista || song.artist}
                                        </div>
                                    </div>

                                    <div className="hidden md:block text-sm text-gray-400 font-variant-numeric tabular-nums">
                                        {formatDuration(song.duracion || song.duration)}
                                    </div>

                                    <div className="w-8 flex justify-end">
                                        <button
                                            className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-2"
                                            onClick={(e) => handleDeleteSong(e, song.id)}
                                            title="Quitar de playlist"
                                        >
                                            <IoTrashOutline size={18} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
