import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/axiosConfig';
import { usePlayer } from '../context/PlayerContext';
import { usePlaylist } from '../context/PlaylistContext';
import { IoPlaySharp, IoShuffle, IoEllipsisHorizontal, IoTrashOutline } from 'react-icons/io5';
import LikeButton from '../components/LikeButton';
import './ImmersiveLayout.css';

export default function PlaylistPage() {
    const { id } = useParams();
    const [playlist, setPlaylist] = useState(null);
    const [songs, setSongs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const { playSongList, currentSong } = usePlayer();
    const { deletePlaylist, removeSongFromPlaylist } = usePlaylist();
    const [totalDuration, setTotalDuration] = useState(0);

    useEffect(() => {
        const fetchPlaylist = async () => {
            try {
                setLoading(true);
                // Try to fetch from API first
                try {
                    const res = await api.get(`/playlists/${id}`);
                    setPlaylist(res.data);

                    // If the playlist object has songs directly (depends on backend)
                    if (res.data.songs) {
                        setSongs(res.data.songs);
                    } else {
                        // Otherwise fetch songs separately
                        const songsRes = await api.get(`/playlists/${id}/songs`);
                        setSongs(songsRes.data);
                    }
                } catch (err) {
                    console.warn("API fetch failed, trying local fallback", err);
                    // Fallback to local storage
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

    // Calculate duration whenever songs change
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

    if (loading) return <div className="ia-loading"><div className="loading-spinner" /></div>;
    if (error) return <div className="ia-error"><h2>{error}</h2></div>;

    return (
        <div className="yt-album-page">

            {/* Ambient Background */}
            <div
                className="ambient-background"
                style={{ backgroundImage: `url(${songs[0]?.portada || songs[0]?.cover_url || '/default_cover.png'})` }}
            />
            <div className="ambient-overlay" />

            <div className="content-wrapper">

                <div className="album-hero">
                    <div className="cover-container">
                        <div className="playlist-cover-placeholder glass-card flex items-center justify-center w-full h-full bg-white/10">
                            {songs.length > 0 ? (
                                <img
                                    src={songs[0]?.portada || songs[0]?.cover_url}
                                    alt={playlist?.nombre}
                                    className="hero-cover"
                                />
                            ) : (
                                <span className="text-4xl">🎵</span>
                            )}
                        </div>
                    </div>

                    <div className="hero-details">
                        <h5 className="uppercase tracking-widest text-xs font-bold mb-2">Playlist</h5>
                        <h1 className="album-title">{playlist?.nombre}</h1>

                        <div className="album-meta-row">
                            <span className="meta-text">Creado por ti</span>
                            <span className="meta-dot">•</span>
                            <span className="album-stats">
                                {songs.length} canciones • {formatTotalDuration(totalDuration)}
                            </span>
                        </div>

                        <div className="action-bar">
                            <button onClick={() => playSongList(songs, 0)} className="btn-primary-white" disabled={songs.length === 0}>
                                <IoPlaySharp /> <span>Reproducir</span>
                            </button>
                            <button className="btn-circle-glass">
                                <IoShuffle />
                            </button>
                            <button className="btn-circle-glass">
                                <IoEllipsisHorizontal />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="tracks-container">
                    {songs.length === 0 ? (
                        <div className="text-center py-10 text-gray-400">
                            <p>Esta playlist está vacía.</p>
                            <p className="text-sm mt-2">Agrega canciones desde el menú contextual.</p>
                        </div>
                    ) : (
                        songs.map((song, index) => {
                            const isPlaying = currentSong?.id === song.id;

                            return (
                                <div
                                    key={song.id || index}
                                    className={`track-row ${isPlaying ? 'playing' : ''} group`}
                                    onClick={() => handleSongClick(index)}
                                >
                                    <div className="track-col-index">
                                        <span className="number">{index + 1}</span>
                                        <span className="icon"><IoPlaySharp /></span>
                                    </div>

                                    <div className="track-col-info">
                                        <div className="track-title">{song.titulo || song.title}</div>
                                        <div className="track-artist">{song.artista || song.artist}</div>
                                    </div>

                                    <div className="track-col-duration mobile-hide">
                                        {Math.floor((song.duracion || song.duration || 0) / 60)}:{((song.duracion || song.duration || 0) % 60).toString().padStart(2, '0')}
                                    </div>

                                    <div className="track-col-actions">
                                        <button
                                            className="p-2 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={(e) => handleDeleteSong(e, song.id)}
                                            title="Quitar de playlist"
                                        >
                                            <IoTrashOutline />
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
