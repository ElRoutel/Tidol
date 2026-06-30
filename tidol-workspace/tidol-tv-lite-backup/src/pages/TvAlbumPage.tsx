import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import { usePlayer } from '../context/PlayerContext';
import { Play } from 'lucide-react';

export default function TvAlbumPage() {
    const { id } = useParams();
    const [album, setAlbum] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const { playSongList, setIsFullScreenOpen } = usePlayer();

    useEffect(() => {
        const fetchAlbum = async () => {
            try {
                setLoading(true);
                const res = await api.get(`/albums/${id}`);
                setAlbum(res.data);
            } catch (err) {
                console.error('Error cargando álbum en TV:', err);
            } finally {
                setLoading(false);
            }
        };
        if (id) fetchAlbum();
    }, [id]);

    const handleTrackClick = (index: number) => {
        if (!album || !album.tracks) return;
        const normalizedSongs = album.tracks.map((t: any) => ({
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
        setIsFullScreenOpen(true);
    };

    if (loading) return <div className="text-4xl text-neutral-400">Cargando Álbum...</div>;
    if (!album) return <div className="text-4xl text-red-400">Álbum no encontrado</div>;

    return (
        <div className="space-y-16 pb-32">
            <div className="flex gap-12 items-end mb-16">
                <img
                    src={album.coverUrl || '/default-album.png'}
                    alt={album.title}
                    className="w-[400px] h-[400px] shadow-2xl rounded-[32px] object-cover"
                />
                <div>
                    <h5 className="text-3xl uppercase tracking-widest font-bold text-neutral-400 mb-4">Álbum</h5>
                    <h1 className="text-[80px] font-black text-white leading-tight mb-4">{album.title}</h1>
                    <p className="text-[40px] text-neutral-300 font-medium flex items-center gap-4">
                        <button 
                            className="hover:text-white hover:underline focus:outline-none focus:text-white focus:underline"
                            onClick={() => album.artist_id && navigate(`/tv/artist/${album.artist_id}`)}
                        >
                            {album.artistName}
                        </button>
                        <span>•</span>
                        <span>{album.releaseYear || '2024'}</span>
                        <span>•</span>
                        <span>{album.tracks?.length || 0} canciones</span>
                    </p>
                </div>
            </div>

            <div className="flex flex-col gap-4 w-full">
                <button
                    tabIndex={0}
                    onClick={() => handleTrackClick(0)}
                    className="flex items-center gap-4 bg-blue-600 w-fit text-white px-12 py-6 rounded-full text-4xl font-bold focus:outline-none focus:ring-[6px] focus:ring-white focus:scale-105 transition-all mb-12"
                >
                    <Play size={48} />
                    Reproducir todo
                </button>

                {album.tracks?.map((track: any, index: number) => (
                    <div
                        key={track.trackId}
                        tabIndex={0}
                        onClick={() => handleTrackClick(index)}
                        className="flex items-center justify-between p-8 bg-neutral-900 rounded-3xl cursor-pointer focus:outline-none focus:ring-[6px] focus:ring-white focus:bg-neutral-800 transition-all"
                    >
                        <div className="flex items-center gap-8">
                            <span className="text-3xl text-neutral-500 font-bold w-12 text-right">{track.trackNumber || index + 1}</span>
                            <div>
                                <h3 className="text-4xl font-bold text-white mb-2">{track.title}</h3>
                                <p className="text-2xl text-neutral-400">{album.artistName}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
