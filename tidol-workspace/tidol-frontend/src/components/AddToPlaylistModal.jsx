import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MdClose, MdAdd, MdMusicNote, MdPlaylistAdd } from 'react-icons/md';
import { usePlaylist } from '../context/PlaylistContext';

export default function AddToPlaylistModal() {
    const {
        isModalOpen,
        songToAdd,
        playlists,
        loading,
        addSongToPlaylist,
        createPlaylist,
        closeAddToPlaylistModal
    } = usePlaylist();

    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [showCreateInput, setShowCreateInput] = useState(false);
    // Feedback en el propio modal: "Añadida" cierra solo; "Ya estaba" avisa
    // sin cerrar (antes un duplicado cerraba en silencio y parecía añadido).
    const [feedback, setFeedback] = useState(null); // { type: 'ok'|'dup', text }

    const handleAddToPlaylist = async (playlistId, playlistName) => {
        const res = await addSongToPlaylist(playlistId, songToAdd);
        if (res && res.already) {
            setFeedback({ type: 'dup', text: `Ya está en "${playlistName}"` });
            setTimeout(() => setFeedback(null), 2200);
        } else if (res) {
            setFeedback({ type: 'ok', text: `Añadida a "${playlistName}"` });
            setTimeout(() => {
                setFeedback(null);
                closeAddToPlaylistModal();
            }, 700);
        }
    };

    const handleCreateAndAdd = async () => {
        if (!newPlaylistName.trim()) return;

        const newPlaylist = await createPlaylist(newPlaylistName);
        if (newPlaylist) {
            await addSongToPlaylist(newPlaylist.id, songToAdd);
            setNewPlaylistName('');
            setShowCreateInput(false);
            closeAddToPlaylistModal();
        }
    };

    if (!songToAdd) return null;

    const songTitle = songToAdd.trackName || songToAdd.titulo || songToAdd.title || 'Sin título';
    const songArtist = songToAdd.artistName || songToAdd.artista || songToAdd.artist || '';
    const songCover = songToAdd.coverArtUrl || songToAdd.portada || songToAdd.cover_url ||
        songToAdd.coverUrl || songToAdd.image || '/default_cover.png';

    return (
        <AnimatePresence>
            {isModalOpen && (
                <>
                    {/* Overlay */}
                    <motion.div
                        className="fixed inset-0 bg-black/70 z-[100]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={closeAddToPlaylistModal}
                    />

                    {/* Modal */}
                    <motion.div
                        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#1e1e1e] rounded-xl z-[101] w-[90%] max-w-md shadow-2xl overflow-hidden"
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-white/10">
                            <div className="flex items-center gap-3">
                                <MdPlaylistAdd size={24} className="text-green-500" />
                                <h2 className="text-lg font-semibold text-white">Agregar a playlist</h2>
                            </div>
                            <button
                                onClick={closeAddToPlaylistModal}
                                className="text-white/60 hover:text-white transition-colors"
                            >
                                <MdClose size={24} />
                            </button>
                        </div>

                        {/* Song Info */}
                        <div className="p-4 flex items-center gap-3 bg-white/5">
                            <img
                                src={songCover}
                                alt={songTitle}
                                onError={(e) => { e.currentTarget.src = '/default_cover.png'; }}
                                className="w-12 h-12 rounded object-cover"
                            />
                            <div className="flex-1 min-w-0">
                                <p className="text-white font-medium truncate">{songTitle}</p>
                                <p className="text-white/60 text-sm truncate">{songArtist}</p>
                            </div>
                        </div>

                        {/* Feedback (añadida / duplicada) */}
                        <AnimatePresence>
                            {feedback && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className={`px-4 py-2 text-sm font-medium ${feedback.type === 'dup' ? 'bg-yellow-500/15 text-yellow-300' : 'bg-green-600/15 text-green-400'}`}
                                >
                                    {feedback.text}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Playlists List */}
                        <div className="max-h-[300px] overflow-y-auto">
                            {playlists.length === 0 && !showCreateInput && (
                                <div className="p-8 text-center text-white/50">
                                    <MdMusicNote size={48} className="mx-auto mb-2 opacity-50" />
                                    <p>No tienes playlists aún</p>
                                    <p className="text-sm mt-1">Crea una nueva para comenzar</p>
                                </div>
                            )}

                            {playlists.map((playlist) => (
                                <button
                                    key={playlist.id}
                                    onClick={() => handleAddToPlaylist(playlist.id, playlist.nombre)}
                                    disabled={loading}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/10 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <div className="w-10 h-10 bg-white/10 rounded overflow-hidden flex items-center justify-center shrink-0">
                                        {playlist.coverUrl ? (
                                            <img
                                                src={playlist.coverUrl}
                                                alt=""
                                                loading="lazy"
                                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <MdMusicNote size={20} className="text-white/80" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white font-medium truncate">{playlist.nombre}</p>
                                        <p className="text-white/60 text-sm">
                                            {/* songCount llega del backend enriquecido; `canciones` es el fallback local */}
                                            {playlist.songCount ?? playlist.canciones?.length ?? playlist.songs?.length ?? 0} canciones
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Create New Playlist */}
                        <div className="p-4 border-t border-white/10">
                            {!showCreateInput ? (
                                <button
                                    onClick={() => setShowCreateInput(true)}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                                >
                                    <MdAdd size={20} />
                                    <span>Crear nueva playlist</span>
                                </button>
                            ) : (
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newPlaylistName}
                                        onChange={(e) => setNewPlaylistName(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleCreateAndAdd()}
                                        placeholder="Nombre de la playlist"
                                        className="flex-1 px-3 py-2 bg-white/10 text-white rounded-lg border border-white/20 focus:border-green-500 focus:outline-none"
                                        autoFocus
                                    />
                                    <button
                                        onClick={handleCreateAndAdd}
                                        disabled={!newPlaylistName.trim() || loading}
                                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <MdAdd size={20} />
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowCreateInput(false);
                                            setNewPlaylistName('');
                                        }}
                                        className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                                    >
                                        <MdClose size={20} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
