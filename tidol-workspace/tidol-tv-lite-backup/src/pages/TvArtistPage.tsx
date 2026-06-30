import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import { usePlayer } from '../context/PlayerContext';
import { Play } from 'lucide-react';
import { UnifiedTrack } from '../types/music';

export default function TvArtistPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [artist, setArtist] = useState<any>(null);
    const [albums, setAlbums] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const { playSongList, setIsFullScreenOpen } = usePlayer();

    useEffect(() => {
        const fetchArtist = async () => {
            try {
                setLoading(true);
                const res = await api.get(`/artists/${id}/discography`);
                setArtist(res.data);
                setAlbums(res.data.albums || []);
            } catch (err) {
                console.error('Error cargando artista:', err);
            } finally {
                setLoading(false);
            }
        };
        if (id) fetchArtist();
    }, [id]);

    const handlePlayTopSongs = () => {
        // En una implementación real, se fetchearían los top tracks.
        // Aquí simplificamos reproduciendo el primer álbum como fallback si no hay endpoint
    };

    if (loading) return <div className="text-4xl text-neutral-400">Cargando Artista...</div>;
    if (!artist) return <div className="text-4xl text-red-400">Artista no encontrado</div>;

    return (
        <div className="space-y-16 pb-32">
            <div className="flex gap-12 items-center mb-16">
                <img
                    src={artist.coverUrl || '/default-artist.png'}
                    alt={artist.name}
                    className="w-[400px] h-[400px] shadow-2xl rounded-full object-cover"
                />
                <div>
                    <h5 className="text-3xl uppercase tracking-widest font-bold text-neutral-400 mb-4">Artista</h5>
                    <h1 className="text-[100px] font-black text-white leading-tight mb-4">{artist.name}</h1>
                </div>
            </div>

            {albums.length > 0 && (
                <section>
                    <h2 className="text-5xl font-bold mb-12">Álbumes</h2>
                    <div className="flex overflow-x-auto snap-x snap-mandatory gap-8 pb-8" style={{ scrollbarWidth: 'none' }}>
                        {albums.map((album) => (
                            <div
                                key={album.mbid}
                                tabIndex={0}
                                onClick={() => navigate(`/tv/album/${album.mbid}`)}
                                className="snap-start flex-none w-[360px] bg-neutral-900 rounded-[32px] p-8 cursor-pointer focus:outline-none focus:ring-[6px] focus:ring-white focus:bg-neutral-800 focus:scale-105 transition-all"
                            >
                                <img
                                    src={album.coverUrl || '/default-album.png'}
                                    className="w-full aspect-square object-cover rounded-2xl shadow-2xl mb-6"
                                    alt={album.title}
                                />
                                <h3 className="text-[32px] leading-tight font-bold truncate text-white mb-2">{album.title}</h3>
                                <p className="text-[24px] text-neutral-400">{album.releaseYear || '2024'}</p>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
