import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/axiosConfig';
import { usePlayer } from '../context/PlayerContext';
import { Play } from 'lucide-react';
import { normalizeTrackList } from '../utils/trackNormalization';

export default function TvPlaylistPage() {
    const { id } = useParams();
    const [playlist, setPlaylist] = useState<any>(null);
    const [songs, setSongs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const { playSongList, setIsFullScreenOpen } = usePlayer();

    useEffect(() => {
        const fetchPlaylist = async () => {
            try {
                setLoading(true);
                const [plRes, songsRes] = await Promise.all([
                    api.get(`/playlists/${id}`),
                    api.get(`/playlists/${id}/songs`)
                ]);
                setPlaylist(plRes.data);
                setSongs(songsRes.data);
            } catch (err) {
                console.error('Error cargando playlist en TV:', err);
            } finally {
                setLoading(false);
            }
        };
        if (id) fetchPlaylist();
    }, [id]);

    const handleTrackClick = (index: number) => {
        if (!songs.length) return;
        const normalizedSongs = normalizeTrackList(songs);
        playSongList(normalizedSongs, index);
        setIsFullScreenOpen(true);
    };

    if (loading) return <div className="text-4xl text-neutral-400">Cargando Playlist...</div>;
    if (!playlist) return <div className="text-4xl text-red-400">Playlist no encontrada</div>;

    return (
        <div className="space-y-16 pb-32">
            <div className="flex gap-12 items-end mb-16">
                <div className="w-[400px] h-[400px] bg-neutral-800 rounded-[32px] flex items-center justify-center shadow-2xl">
                    <span className="text-[120px]">🎵</span>
                </div>
                <div>
                    <h5 className="text-3xl uppercase tracking-widest font-bold text-neutral-400 mb-4">Playlist</h5>
                    <h1 className="text-[80px] font-black text-white leading-tight mb-4">{playlist.nombre}</h1>
                    <p className="text-[40px] text-neutral-300 font-medium">
                        {songs.length} canciones
                    </p>
                </div>
            </div>

            <div className="flex flex-col gap-4 w-full">
                {songs.length > 0 && (
                    <button
                        tabIndex={0}
                        onClick={() => handleTrackClick(0)}
                        className="flex items-center gap-4 bg-blue-600 w-fit text-white px-12 py-6 rounded-full text-4xl font-bold focus:outline-none focus:ring-[6px] focus:ring-white focus:scale-105 transition-all mb-12"
                    >
                        <Play size={48} />
                        Reproducir todo
                    </button>
                )}

                {songs.map((track: any, index: number) => (
                    <div
                        key={track.id}
                        tabIndex={0}
                        onClick={() => handleTrackClick(index)}
                        className="flex items-center justify-between p-8 bg-neutral-900 rounded-3xl cursor-pointer focus:outline-none focus:ring-[6px] focus:ring-white focus:bg-neutral-800 transition-all"
                    >
                        <div className="flex items-center gap-8">
                            <span className="text-3xl text-neutral-500 font-bold w-12 text-right">{index + 1}</span>
                            <div>
                                <h3 className="text-4xl font-bold text-white mb-2">{track.titulo || track.title}</h3>
                                <p className="text-2xl text-neutral-400">{track.artista || track.artist}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
