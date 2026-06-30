import { useLibrary } from '../hooks/useLibrary';
import { usePlayer } from '../context/PlayerContext';
import { normalizeTrackList } from '../utils/trackNormalization';
import api from '../api/axiosConfig';

export default function TvLibraryPage() {
    const { currentView, setCurrentView, data, isLoading } = useLibrary();
    const { playSongList, setIsFullScreenOpen } = usePlayer();

    const handlePlayPlaylist = async (id: number) => {
        try {
            const res = await api.get(`/playlists/${id}/songs`);
            if (res.data && res.data.length > 0) {
                const normalized = normalizeTrackList(res.data);
                playSongList(normalized, 0);
                setIsFullScreenOpen(true);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleItemClick = (item: any, index: number) => {
        if (currentView === "playlists") {
            handlePlayPlaylist(item.id);
        } else {
            const normalizedData = normalizeTrackList(data);
            playSongList(normalizedData, index);
            setIsFullScreenOpen(true);
        }
    };

    return (
        <div className="space-y-16 pb-32">
            <h1 className="text-6xl font-extrabold mb-8">Colección</h1>

            {/* Chips */}
            <div className="flex gap-8 mb-12">
                {[
                    { key: "favorites", label: "Tus Favoritos" },
                    { key: "ia-likes", label: "Internet Archive" },
                    { key: "playlists", label: "Playlists" },
                ].map((c) => (
                    <button
                        key={c.key}
                        tabIndex={0}
                        onClick={() => setCurrentView(c.key as any)}
                        className={`text-4xl px-12 py-6 rounded-full transition-all focus:outline-none focus:ring-[6px] focus:ring-white focus:scale-105 ${
                            currentView === c.key ? 'bg-blue-600 text-white font-bold' : 'bg-neutral-800 text-neutral-400'
                        }`}
                    >
                        {c.label}
                    </button>
                ))}
            </div>

            {isLoading && <div className="text-4xl text-neutral-400">Cargando...</div>}

            {!isLoading && data.length === 0 && (
                <div className="text-4xl text-neutral-400">No hay elementos en esta categoría.</div>
            )}

            {!isLoading && data.length > 0 && (
                <div className="flex flex-wrap gap-12">
                    {data.map((item: any, i: number) => (
                        <div
                            key={item.id || item.identifier || `idx-${i}`}
                            tabIndex={0}
                            onClick={() => handleItemClick(item, i)}
                            className="w-[320px] bg-neutral-900 rounded-[32px] p-8 cursor-pointer focus:outline-none focus:ring-[6px] focus:ring-white focus:bg-neutral-800 focus:scale-105 transition-all"
                        >
                            <img
                                src={item.portada || item.cover_url || '/default-album.png'}
                                className="w-full aspect-square object-cover rounded-2xl shadow-2xl mb-6 bg-neutral-800"
                                alt={item.titulo || item.title || item.nombre}
                            />
                            <h3 className="text-[32px] leading-tight font-bold truncate text-white mb-2">
                                {item.titulo || item.title || item.nombre || "Sin título"}
                            </h3>
                            <p className="text-[24px] text-neutral-400 truncate">
                                {currentView === "playlists"
                                    ? `${item.canciones ? item.canciones.length : 0} canciones`
                                    : item.artista || item.artist || "Desconocido"}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
