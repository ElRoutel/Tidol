import React from 'react';
import { useSwipeable } from 'react-swipeable';
import { motion, AnimatePresence } from 'framer-motion';
import { MdQueueMusic, MdPlaylistPlay, MdFavorite, MdFavoriteBorder, MdAlbum, MdPerson, MdPlaylistAdd } from 'react-icons/md';
import { usePlayer } from '../context/PlayerContext';
import { usePlaylist } from '../context/PlaylistContext';
import { useNavigate } from 'react-router-dom';

export default function MobileMenuSheet({ isOpen, onClose, item }) {
    const { addToQueue, playNext, toggleLike, isSongLiked } = usePlayer();
    const { openAddToPlaylistModal } = usePlaylist();
    const navigate = useNavigate();

    const handlers = useSwipeable({
        onSwipedDown: onClose,
        trackMouse: true
    });

    if (!item) return null;

    const isLiked = item.id ? isSongLiked(item.id) : false;
    const isIa = item.source === 'internet_archive' || (typeof item.id === 'string' && item.id.includes('-'));

    const handleAction = (action) => {
        switch (action) {
            case 'queue':
                addToQueue(item);
                break;
            case 'next':
                playNext(item);
                break;
            case 'like':
                toggleLike(item.id, item);
                break;
            case 'playlist':
                openAddToPlaylistModal(item);
                break;
            case 'artist':
                if (item.artistId) navigate(`/artist/${item.artistId}`);
                // TODO: Handle IA artist navigation if possible
                break;
            case 'album':
                if (item.albumId) navigate(`/album/${item.albumId}`);
                break;
        }
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        className="fixed inset-0 bg-black/60 z-[60]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />
                    <motion.div
                        className="fixed bottom-0 left-0 right-0 bg-[#1e1e1e] rounded-t-2xl z-[70] overflow-hidden"
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        {...handlers}
                    >
                        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mt-3 mb-6" />

                        <div className="px-6 mb-6 flex items-center gap-4">
                            <img
                                src={item.portada || item.cover_url || '/default_cover.png'}
                                alt={item.title}
                                className="w-14 h-14 rounded-md object-cover"
                            />
                            <div className="flex-1 min-w-0">
                                <h3 className="text-white font-medium truncate text-lg">{item.titulo || item.title}</h3>
                                <p className="text-white/60 truncate">{item.artista || item.artist}</p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-1 pb-8">
                            <MenuItem
                                icon={<MdQueueMusic size={24} />}
                                label="Agregar a la cola"
                                onClick={() => handleAction('queue')}
                            />
                            <MenuItem
                                icon={<MdPlaylistPlay size={24} />}
                                label="Reproducir siguiente"
                                onClick={() => handleAction('next')}
                            />
                            <MenuItem
                                icon={isLiked ? <MdFavorite size={24} className="text-green-500" /> : <MdFavoriteBorder size={24} />}
                                label={isLiked ? "Quitar de favoritos" : "Agregar a favoritos"}
                                onClick={() => handleAction('like')}
                            />
                            <MenuItem
                                icon={<MdPlaylistAdd size={24} />}
                                label="Agregar a playlist"
                                onClick={() => handleAction('playlist')}
                            />

                            {!isIa && (
                                <>
                                    <div className="h-px bg-white/10 mx-4 my-2" />
                                    <MenuItem
                                        icon={<MdPerson size={24} />}
                                        label="Ir al artista"
                                        onClick={() => handleAction('artist')}
                                    />
                                    <MenuItem
                                        icon={<MdAlbum size={24} />}
                                        label="Ir al álbum"
                                        onClick={() => handleAction('album')}
                                    />
                                </>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

function MenuItem({ icon, label, onClick }) {
    return (
        <button
            onClick={onClick}
            className="w-full flex items-center gap-4 px-6 py-4 active:bg-white/10 transition-colors text-left"
        >
            <div className="text-white/80">{icon}</div>
            <span className="text-white font-medium">{label}</span>
        </button>
    );
}
