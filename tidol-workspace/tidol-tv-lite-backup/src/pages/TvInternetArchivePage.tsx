import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/axiosConfig';
import { usePlayer } from '../context/PlayerContext';
import { Play } from 'lucide-react';
import { UnifiedTrack } from '../types/music';

export default function TvInternetArchivePage() {
    const { identifier } = useParams();
    const [album, setAlbum] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const { playSongList, setIsFullScreenOpen } = usePlayer();

    useEffect(() => {
        const fetchAlbum = async () => {
            try {
                setLoading(true);
                const res = await api.get(`/music/ia/metadata/${identifier}`);
                setAlbum(res.data);
            } catch (err) {
                console.error('Error cargando IA Album en TV:', err);
            } finally {
                setLoading(false);
            }
        };
        if (identifier) fetchAlbum();
    }, [identifier]);

    const handleTrackClick = (index: number) => {
        if (!album || !album.tracks) return;
        const normalizedSongs: UnifiedTrack[] = album.tracks.map((t: any) => ({
            id: `${identifier}_${t.file}`,
            trackId: t.file,
            trackName: t.title,
            artistName: album.artistName || album.creator || 'Internet Archive',
            albumName: album.title,
            coverArtUrl: album.coverUrl,
            sourceType: 'internet-archive',
            playbackUrl: t.url,
            attributes: {
                name: t.title,
                artistName: album.artistName || album.creator || 'Internet Archive',
                albumName: album.title,
                durationInSeconds: t.duration || 0,
                artwork: { url: album.coverUrl }
            }
        }));
        playSongList(normalizedSongs, index);
        setIsFullScreenOpen(true);
    };

    if (loading) return <div className="text-4xl text-neutral-400">Cargando Internet Archive...</div>;
    if (!album) return <div className="text-4xl text-red-400">Álbum IA no encontrado</div>;

    return (
        <div className="space-y-16 pb-32">
            <div className="flex gap-12 items-end mb-16">
                <img
                    src={album.coverUrl || '/default-album.png'}
                    alt={album.title}
                    className="w-[400px] h-[400px] shadow-2xl rounded-[32px] object-cover"
                />
                <div>
                    <h5 className="text-3xl uppercase tracking-widest font-bold text-neutral-400 mb-4">Internet Archive 🌐</h5>
                    <h1 className="text-[80px] font-black text-white leading-tight mb-4">{album.title}</h1>
                    <p className="text-[40px] text-neutral-300 font-medium">
                        {album.artistName || album.creator || 'Unknown'} • {album.tracks?.length || 0} pistas
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
                        key={track.file || index}
                        tabIndex={0}
                        onClick={() => handleTrackClick(index)}
                        className="flex items-center justify-between p-8 bg-neutral-900 rounded-3xl cursor-pointer focus:outline-none focus:ring-[6px] focus:ring-white focus:bg-neutral-800 transition-all"
                    >
                        <div className="flex items-center gap-8">
                            <span className="text-3xl text-neutral-500 font-bold w-12 text-right">{track.track || index + 1}</span>
                            <div>
                                <h3 className="text-4xl font-bold text-white mb-2">{track.title}</h3>
                                <p className="text-2xl text-neutral-400">{album.artistName || album.creator || 'Internet Archive'}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
