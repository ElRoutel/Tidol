import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import { usePlayer } from '../context/PlayerContext';
import { UnifiedTrack } from '../types/music';

export default function TvHomePage() {
    const [data, setData] = useState<any>(() => {
        const cached = localStorage.getItem('tv_home_cache');
        return cached ? JSON.parse(cached) : { listenAgain: [], recentlyPlayed: [], albums: [] };
    });
    const { playSongList, setIsFullScreenOpen } = usePlayer();
    const navigate = useNavigate();

    useEffect(() => {
        const fetchHome = async () => {
            try {
                const homePromise = api.get('/home', { timeout: 8000 }).catch(() => ({ data: {} }));
                const albumsPromise = api.get('/music/albums', { timeout: 8000 }).catch(() => ({ data: [] }));
                
                const [homeRes, albumsRes] = await Promise.all([homePromise, albumsPromise]);
                
                const newData = {
                    ...(homeRes?.data || {}),
                    albums: albumsRes?.data || []
                };
                
                // Only update if we actually got something useful to avoid overwriting cache with empty data on timeout
                if (newData.listenAgain?.length > 0 || newData.albums?.length > 0) {
                    setData(newData);
                    localStorage.setItem('tv_home_cache', JSON.stringify(newData));
                }
            } catch (err) {
                console.error("Error cargando /home en TV:", err);
            }
        };
        fetchHome();
    }, []);

    const handlePlayRow = (rowSongs: any[], index: number) => {
        const unifiedSongs: UnifiedTrack[] = rowSongs.map((s: any) => ({
            id: s.id || s.mbid || s.uuid || Math.random().toString(),
            trackId: s.id || s.mbid || s.uuid,
            trackName: s.name || s.title || 'Unknown Track',
            artistName: s.artistName || s.artist || 'Unknown Artist',
            coverArtUrl: s.coverArtUrl || s.cover_url || s.coverUrl || s.portada || '/default-album.png',
            playbackUrl: s.url || s.audio_url || s.playbackUrl,
            sourceType: 'local',
            duration: s.duration || 0,
            albumName: s.album || s.albumName || 'Unknown Album',
            attributes: {
                name: s.name || s.title,
                artistName: s.artistName || s.artist,
                albumName: s.album || s.albumName,
                artwork: { url: s.coverArtUrl || s.cover_url || s.coverUrl || s.portada || '/default-album.png' }
            }
        }));
        playSongList(unifiedSongs, index);
        setIsFullScreenOpen(true);
    };

    const handleAlbumClick = (id: string | number) => {
        navigate(`/album/${id}`);
    };

    return (
        <div className="space-y-16">
            <h1 className="text-6xl font-extrabold mb-12">Inicio</h1>

            {data.listenAgain && data.listenAgain.length > 0 && (
                <section>
                    <h2 className="text-4xl font-bold mb-8">Volver a escuchar</h2>
                    <div className="flex overflow-x-auto snap-x snap-mandatory gap-8 pb-8" style={{ scrollbarWidth: 'none' }}>
                        {data.listenAgain.map((song: any, idx: number) => (
                            <div
                                key={`la-${song.id || idx}`}
                                tabIndex={0}
                                onClick={() => handlePlayRow(data.listenAgain, idx)}
                                className="snap-start flex-none w-[360px] bg-neutral-900 rounded-[32px] p-8 cursor-pointer focus:outline-none focus:ring-[6px] focus:ring-white focus:bg-neutral-800 focus:scale-105 transition-all duration-300"
                            >
                                <img
                                    src={song.coverArtUrl || song.cover_url || song.coverUrl || song.portada || '/default-album.png'}
                                    className="w-full aspect-square object-cover rounded-2xl shadow-2xl mb-6"
                                    alt="cover"
                                    loading="lazy"
                                    decoding="async"
                                />
                                <h3 className="text-[32px] leading-tight font-bold truncate text-white mb-2">{song.name || song.title}</h3>
                                <p className="text-[24px] text-neutral-400 truncate">{song.artistName || song.artist}</p>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {data.recentlyPlayed && data.recentlyPlayed.length > 0 && (
                <section>
                    <h2 className="text-4xl font-bold mb-8">Agregados Recientemente</h2>
                    <div className="flex overflow-x-auto snap-x snap-mandatory gap-8 pb-8" style={{ scrollbarWidth: 'none' }}>
                        {data.recentlyPlayed.map((song: any, idx: number) => (
                            <div
                                key={`rp-${song.id || idx}`}
                                tabIndex={0}
                                onClick={() => handlePlayRow(data.recentlyPlayed, idx)}
                                className="snap-start flex-none w-[360px] bg-neutral-900 rounded-[32px] p-8 cursor-pointer focus:outline-none focus:ring-[6px] focus:ring-white focus:bg-neutral-800 focus:scale-105 transition-all duration-300"
                            >
                                <img
                                    src={song.coverArtUrl || song.cover_url || song.coverUrl || song.portada || '/default-album.png'}
                                    className="w-full aspect-square object-cover rounded-2xl shadow-2xl mb-6"
                                    alt="cover"
                                    loading="lazy"
                                    decoding="async"
                                />
                                <h3 className="text-[32px] leading-tight font-bold truncate text-white mb-2">{song.name || song.title}</h3>
                                <p className="text-[24px] text-neutral-400 truncate">{song.artistName || song.artist}</p>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {data.albums && data.albums.length > 0 && (
                <section>
                    <h2 className="text-4xl font-bold mb-8">Descubrir Álbumes Populares</h2>
                    <div className="flex overflow-x-auto snap-x snap-mandatory gap-8 pb-8" style={{ scrollbarWidth: 'none' }}>
                        {data.albums.map((album: any, idx: number) => (
                            <div
                                key={`al-${album.id || idx}`}
                                tabIndex={0}
                                onClick={() => handleAlbumClick(album.id)}
                                className="snap-start flex-none w-[360px] bg-neutral-900 rounded-[32px] p-8 cursor-pointer focus:outline-none focus:ring-[6px] focus:ring-white focus:bg-neutral-800 focus:scale-105 transition-all duration-300"
                            >
                                <img
                                    src={album.coverUrl || album.cover_url || album.coverFull || album.portada || '/default-album.png'}
                                    className="w-full aspect-square object-cover rounded-2xl shadow-2xl mb-6"
                                    alt="cover"
                                    loading="lazy"
                                    decoding="async"
                                />
                                <h3 className="text-[32px] leading-tight font-bold truncate text-white mb-2">{album.title || album.titulo || album.name}</h3>
                                <p className="text-[24px] text-neutral-400 truncate">{album.artistName || album.artist_name || album.autor || album.artist}</p>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
