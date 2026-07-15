import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Reorder, useDragControls } from 'framer-motion';
import api from '../api/axiosConfig';
import { usePlayer } from '../context/PlayerContext';
import { usePlaylist } from '../context/PlaylistContext';
import { useContextMenuTrigger } from '../hooks/useContextMenuTrigger';
import { getCoverSrc } from '../utils/coverArt';
import { IoPlaySharp, IoShuffle, IoEllipsisHorizontal, IoTrashOutline, IoTimeOutline, IoPencilOutline, IoHeart, IoHeartOutline, IoReorderThreeOutline, IoMusicalNotesOutline } from 'react-icons/io5';
import { normalizeTrackList } from '../utils/trackNormalization';
import PlaylistNameModal from '../components/PlaylistNameModal';
import ConfirmModal from '../components/ConfirmModal';
import '../styles/glass.css';
import './ImmersiveLayout.css'; // Mantener estilos específicos de layout inmersivo si son necesarios

// Fila de canción de la playlist. Antes se delegaba en UniversalCard, que
// ignora `children`/`index`/variante list: ni numeración, ni duración, ni el
// botón de quitar llegaban a renderizarse. La fila propia además soporta
// reordenación drag & drop (solo el dueño, desde el asa ≡).
function PlaylistSongRow({ song, index, isOwner, isCurrent, onPlay, onRequestRemove, onDragEnd, formatDuration }) {
    const dragControls = useDragControls();
    // Al soltar un arrastre, el navegador dispara también un click sobre la
    // fila; sin esta guarda cada reordenación reproducía la canción movida.
    const dragEndAtRef = useRef(0);

    const { triggerProps, open } = useContextMenuTrigger('song', song, {
        extra: isOwner ? [{
            label: 'Quitar de esta playlist',
            icon: IoTrashOutline,
            destructive: true,
            onSelect: () => onRequestRemove(song),
        }] : undefined,
    });

    return (
        <Reorder.Item
            as="div"
            value={song}
            dragListener={false}
            dragControls={dragControls}
            onDragEnd={() => { dragEndAtRef.current = Date.now(); onDragEnd(); }}
            className={`ctx-longpress group grid grid-cols-[2rem_1fr_auto_auto] gap-4 items-center px-4 md:px-6 py-2.5 cursor-pointer border-b border-white/5 last:border-0 transition-colors hover:bg-white/5 ${isCurrent ? 'bg-white/10' : ''}`}
            onClick={() => { if (Date.now() - dragEndAtRef.current > 250) onPlay(); }}
            {...triggerProps}
        >
            {/* nº / asa de arrastre (el asa sustituye al número al hacer hover si eres dueño) */}
            <div className="w-8 flex items-center justify-center text-sm text-gray-400">
                {isOwner ? (
                    <>
                        <span className="group-hover:hidden">{index + 1}</span>
                        <button
                            data-no-longpress
                            onPointerDown={(e) => { e.stopPropagation(); dragControls.start(e); }}
                            onClick={(e) => e.stopPropagation()}
                            className="hidden group-hover:flex items-center justify-center text-white/60 hover:text-white cursor-grab active:cursor-grabbing p-1"
                            style={{ touchAction: 'none' }}
                            aria-label="Reordenar"
                            title="Arrastrar para reordenar"
                        >
                            <IoReorderThreeOutline size={20} />
                        </button>
                    </>
                ) : (
                    <span>{index + 1}</span>
                )}
            </div>

            <div className="flex items-center gap-3 min-w-0">
                <img
                    src={getCoverSrc(song, true)}
                    alt=""
                    loading="lazy"
                    onError={(e) => { e.currentTarget.src = '/default-album.png'; }}
                    className="w-11 h-11 rounded-md object-cover shrink-0"
                />
                <div className="min-w-0">
                    <p className={`text-sm font-medium truncate ${isCurrent ? 'text-primary' : 'text-white'}`}>
                        {song.trackName || song.titulo || song.title}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                        {song.artistName || song.artista || song.artist}
                    </p>
                </div>
            </div>

            <div className="hidden md:block text-sm text-gray-400 tabular-nums">
                {formatDuration(song.durationInSeconds || song.duracion || song.duration)}
            </div>

            <div className="w-10 flex justify-end">
                <button
                    className="w-10 h-10 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100"
                    onClick={(e) => { e.stopPropagation(); open(e); }}
                    title="Más opciones"
                    aria-label="Más opciones"
                >
                    <IoEllipsisHorizontal size={18} />
                </button>
            </div>
        </Reorder.Item>
    );
}

/**
 * Portada de la playlist: mosaico 2x2 con las primeras portadas si hay ≥4
 * canciones, portada única con 1-3, placeholder si está vacía.
 */
function PlaylistCover({ songs, name }) {
    const covers = [];
    const seen = new Set();
    for (const song of songs) {
        const src = getCoverSrc(song, true);
        if (src && !seen.has(src)) {
            seen.add(src);
            covers.push(src);
        }
        if (covers.length === 4) break;
    }

    return (
        <div className="w-44 h-44 md:w-64 md:h-64 shrink-0 rounded-xl overflow-hidden shadow-2xl glass-card bg-white/5 mx-auto md:mx-0">
            {covers.length >= 4 ? (
                <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
                    {covers.map((src, i) => (
                        <img
                            key={i}
                            src={src}
                            alt=""
                            loading="lazy"
                            onError={(e) => { e.currentTarget.src = '/default-album.png'; }}
                            className="w-full h-full object-cover"
                        />
                    ))}
                </div>
            ) : covers.length > 0 ? (
                <img
                    src={covers[0]}
                    alt={name}
                    onError={(e) => { e.currentTarget.src = '/default-album.png'; }}
                    className="w-full h-full object-cover"
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/10 to-white/[0.02]">
                    <span className="text-5xl md:text-6xl">🎵</span>
                </div>
            )}
        </div>
    );
}

/** Última copia conocida del listado. Solo se usa estando offline. */
function readCachedPlaylist(playlistId) {
    try {
        const local = localStorage.getItem('tidol_playlists');
        if (!local) return null;
        return JSON.parse(local).find(p => String(p.id) === String(playlistId)) || null;
    } catch {
        return null;
    }
}

export default function PlaylistPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [playlist, setPlaylist] = useState(null);
    const [songs, setSongs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const { playSongList, currentSong } = usePlayer();
    const { removeSongFromPlaylist, renamePlaylist, deletePlaylist, reorderPlaylistSongs } = usePlaylist();
    const [totalDuration, setTotalDuration] = useState(0);
    const [showMenu, setShowMenu] = useState(false);
    const [isRenameOpen, setIsRenameOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [songToRemove, setSongToRemove] = useState(null);

    // Solo el dueño manda: si el backend no lo afirma, no ofrecemos sus acciones.
    const isOwner = playlist?.isOwner === true;

    // `onReorder` dispara durante el arrastre con el array ya reordenado; lo
    // guardamos para que `onDragEnd` lo persista sin depender del estado de React.
    const pendingOrder = useRef(null);
    const handleReorder = (nuevoOrden) => {
        pendingOrder.current = nuevoOrden;
        setSongs(nuevoOrden);
    };
    const persistOrder = () => {
        const orden = pendingOrder.current;
        if (!orden) return; // soltó donde estaba: nada que guardar
        pendingOrder.current = null;
        void reorderPlaylistSongs(id, orden.map(s => s.id));
    };

    const handleRename = async (nombre) => {
        if (!await renamePlaylist(id, nombre)) return;
        setPlaylist(prev => prev ? { ...prev, nombre } : prev);
        setIsRenameOpen(false);
    };

    const handleDeletePlaylist = async () => {
        setIsDeleteOpen(false);
        if (await deletePlaylist(id)) navigate('/library');
    };

    // Like de playlist: actualización optimista + estado real del backend.
    const handleToggleLike = async () => {
        setPlaylist(prev => prev ? {
            ...prev,
            likedByMe: !prev.likedByMe,
            likes: (prev.likes ?? 0) + (prev.likedByMe ? -1 : 1)
        } : prev);
        try {
            const res = await api.post(`/playlists/${id}/like`);
            setPlaylist(prev => prev ? { ...prev, likedByMe: res.data.liked, likes: res.data.likes } : prev);
        } catch (err) {
            console.error('No se pudo actualizar el like de la playlist:', err);
            setPlaylist(prev => prev ? {
                ...prev,
                likedByMe: !prev.likedByMe,
                likes: (prev.likes ?? 0) + (prev.likedByMe ? -1 : 1)
            } : prev);
        }
    };

    useEffect(() => {
        if (!id) return;

        const fetchPlaylist = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await api.get(`/playlists/${id}`);
                setPlaylist(res.data);

                if (res.data.songs) {
                    setSongs(normalizeTrackList(res.data.songs));
                } else {
                    const songsRes = await api.get(`/playlists/${id}/songs`);
                    setSongs(normalizeTrackList(songsRes.data));
                }
            } catch (err) {
                if (err?.response) {
                    // El servidor contestó: es un rechazo real, no falta de red.
                    // Servir una copia local aquí ocultaría un 404 legítimo.
                    setError(err.response.status === 404
                        ? 'Esta playlist no existe o no es tuya.'
                        : 'No se pudo cargar la playlist.');
                } else {
                    const cached = readCachedPlaylist(id);
                    if (cached) {
                        setPlaylist(cached);
                        setSongs(cached.songs || []);
                    } else {
                        setError('Sin conexión y no hay copia local de esta playlist.');
                    }
                }
            } finally {
                setLoading(false);
            }
        };

        fetchPlaylist();
    }, [id]);

    useEffect(() => {
        // Preferir la duración total calculada por el backend; si no viene
        // (fallback local), sumarla de las canciones.
        if (playlist?.totalDuration > 0) {
            setTotalDuration(playlist.totalDuration);
        } else if (songs.length > 0) {
            const total = songs.reduce((acc, curr) => acc + (curr.duracion || curr.duration || 0), 0);
            setTotalDuration(total);
        }
    }, [songs, playlist?.totalDuration]);

    const handleSongClick = (index) => {
        playSongList(songs, index);
    };

    // window.confirm está bloqueado en PWA; se confirma con ConfirmModal.
    const confirmRemoveSong = async () => {
        const song = songToRemove;
        setSongToRemove(null);
        if (!song) return;
        const success = await removeSongFromPlaylist(id, song.id);
        if (success) {
            setSongs(prev => prev.filter(s => s.id !== song.id));
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
        <div className="relative min-h-screen pb-40 bg-[#0a0a0a]">
            {/* Blurred cover glow (mismo patrón que AlbumPage) */}
            <div className="absolute top-0 left-0 w-full h-[60vh] z-0 pointer-events-none overflow-hidden">
                <div
                    className="w-full h-full bg-cover bg-center blur-[100px] opacity-50 scale-150 transition-all duration-1000"
                    style={{ backgroundImage: `url(${getCoverSrc(songs[0], true) || '/default-album.png'})` }}
                />
            </div>
            <div className="absolute top-0 left-0 w-full h-[60vh] z-[1] pointer-events-none bg-gradient-to-b from-black/30 via-[#0a0a0a]/70 to-[#0a0a0a]" />

            <div className="relative z-10 px-4 md:px-8 pt-24 max-w-7xl mx-auto">
                {/* Hero Section */}
                <div className="flex flex-col items-center text-center md:flex-row md:items-end md:text-left gap-6 md:gap-8 mb-8 md:mb-12 animate-fade-in">
                    <PlaylistCover songs={songs} name={playlist?.nombre} />

                    <div className="flex-1 w-full min-w-0">
                        <h5 className="uppercase tracking-widest text-xs font-bold mb-2 text-white/80">Playlist</h5>
                        <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-4 md:mb-6 tracking-tight break-words">{playlist?.nombre}</h1>

                        <div className="flex items-center justify-center md:justify-start flex-wrap gap-2 text-sm text-gray-300 mb-6">
                            <span className="font-medium text-white">
                                {playlist?.owner ? `Creada por ${playlist.owner}` : 'Playlist'}
                            </span>
                            <span>•</span>
                            <span>{playlist?.songCount ?? songs.length} canciones</span>
                            {totalDuration > 0 && (
                                <>
                                    <span>•</span>
                                    <span>{formatTotalDuration(totalDuration)}</span>
                                </>
                            )}
                            {(playlist?.likes ?? 0) > 0 && (
                                <>
                                    <span>•</span>
                                    <span className="inline-flex items-center gap-1">
                                        <IoHeart size={14} className="text-white/70" /> {playlist.likes}
                                    </span>
                                </>
                            )}
                        </div>

                        <div className="flex items-center justify-center md:justify-start gap-4">
                            <button
                                onClick={() => playSongList(songs, 0)}
                                className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={songs.length === 0}
                                aria-label="Reproducir playlist"
                            >
                                <IoPlaySharp size={28} className="ml-1" />
                            </button>
                            <button
                                onClick={handleToggleLike}
                                className={`h-10 px-4 rounded-full border flex items-center gap-2 text-sm font-semibold transition-all active:scale-95 ${
                                    playlist?.likedByMe
                                        ? 'bg-white/15 border-white/30 text-white'
                                        : 'border-white/20 text-white/80 hover:bg-white/10 hover:text-white'
                                }`}
                                aria-label={playlist?.likedByMe ? 'Quitar like' : 'Dar like'}
                            >
                                {playlist?.likedByMe ? <IoHeart size={18} /> : <IoHeartOutline size={18} />}
                                {playlist?.likes ?? 0}
                            </button>
                            <button
                                onClick={() => { if (songs.length) playSongList([...songs].sort(() => Math.random() - 0.5), 0); }}
                                className="w-10 h-10 rounded-full border border-white/20 hover:bg-white/10 flex items-center justify-center text-white transition-all"
                                aria-label="Reproducir en aleatorio"
                            >
                                <IoShuffle size={20} />
                            </button>
                            {playlist?.isOwner !== false && (
                                <div className="relative">
                                    <button
                                        onClick={() => setShowMenu(v => !v)}
                                        className="w-10 h-10 rounded-full border border-white/20 hover:bg-white/10 flex items-center justify-center text-white transition-all"
                                        title="Más opciones"
                                    >
                                        <IoEllipsisHorizontal size={20} />
                                    </button>
                                    {showMenu && (
                                        <>
                                            <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                                            <div className="absolute left-0 mt-2 w-52 z-20 rounded-xl bg-[#282828] border border-white/10 shadow-2xl py-1">
                                                <button
                                                    onClick={() => { setShowMenu(false); setIsRenameOpen(true); }}
                                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-colors"
                                                >
                                                    <IoPencilOutline size={18} /> Cambiar nombre
                                                </button>
                                                <button
                                                    onClick={() => { setShowMenu(false); setIsDeleteOpen(true); }}
                                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-white/10 transition-colors"
                                                >
                                                    <IoTrashOutline size={18} /> Eliminar playlist
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Tracks List */}
                <div className="glass-card rounded-xl overflow-hidden animate-slide-up">
                    {/* Header Row */}
                    <div className="grid grid-cols-[2rem_1fr_auto_auto] gap-4 px-4 md:px-6 py-3 border-b border-white/5 text-sm text-gray-400 font-medium uppercase tracking-wider">
                        <div className="w-8 text-center">#</div>
                        <div>Título</div>
                        <div className="hidden md:block"><IoTimeOutline size={18} /></div>
                        <div className="w-10"></div>
                    </div>

                    {/* Songs */}
                    {songs.length === 0 ? (
                        <div className="flex flex-col items-center text-center py-16 px-6">
                            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-5">
                                <IoMusicalNotesOutline size={36} className="text-white/40" />
                            </div>
                            <p className="text-lg font-semibold text-white mb-1">Esta playlist está vacía</p>
                            <p className="text-sm text-gray-500 mb-6">Busca canciones y agrégalas desde su menú de opciones</p>
                            <button
                                onClick={() => navigate('/search')}
                                className="px-6 py-2.5 rounded-full bg-white text-black text-sm font-semibold hover:scale-105 active:scale-95 transition-transform"
                            >
                                Buscar canciones
                            </button>
                        </div>
                    ) : (
                        <Reorder.Group as="div" axis="y" values={songs} onReorder={handleReorder}>
                            {songs.map((song, index) => (
                                <PlaylistSongRow
                                    key={song.id || song.trackId || index}
                                    song={song}
                                    index={index}
                                    isOwner={isOwner}
                                    isCurrent={currentSong && (currentSong.id === song.id || currentSong.trackId === song.trackId)}
                                    onPlay={() => handleSongClick(index)}
                                    onRequestRemove={setSongToRemove}
                                    onDragEnd={persistOrder}
                                    formatDuration={formatDuration}
                                />
                            ))}
                        </Reorder.Group>
                    )}
                </div>
            </div>

            <PlaylistNameModal
                isOpen={isRenameOpen}
                title="Cambiar nombre"
                initialValue={playlist?.nombre || ''}
                confirmLabel="Guardar"
                onConfirm={handleRename}
                onClose={() => setIsRenameOpen(false)}
            />

            <ConfirmModal
                isOpen={isDeleteOpen}
                title="Eliminar playlist"
                message="Esta acción no se puede deshacer."
                confirmLabel="Eliminar"
                onConfirm={handleDeletePlaylist}
                onClose={() => setIsDeleteOpen(false)}
            />

            <ConfirmModal
                isOpen={!!songToRemove}
                title="Quitar canción"
                message={`¿Quitar “${songToRemove?.trackName || songToRemove?.titulo || songToRemove?.title || 'esta canción'}” de la playlist?`}
                confirmLabel="Quitar"
                onConfirm={confirmRemoveSong}
                onClose={() => setSongToRemove(null)}
            />
        </div>
    );
}
