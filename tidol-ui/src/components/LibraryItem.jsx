import React, { useState } from "react";
import { usePlaylist } from "../context/PlaylistContext";
import { usePlayer } from "../context/PlayerContext";
import { useNavigate } from "react-router-dom";

export default function LibraryItem({
    title,
    subtitle,
    image,
    onClick,
    viewMode = "list",
    item = null, // Full item object for context menu
    type = "song" // song, playlist, album, artist
}) {
    const [contextMenu, setContextMenu] = useState(null);
    const { openAddToPlaylistModal } = usePlaylist();
    const { addToQueue, playNext, toggleLike, isSongLiked } = usePlayer();
    const navigate = useNavigate();

    const handleContextMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (item && type === 'song') {
            setContextMenu({ x: e.clientX, y: e.clientY });
        }
    };

    const handleAction = (action) => {
        if (!item) return;

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
                if (item.artistId || item.artista_id) {
                    navigate(`/artist/${item.artistId || item.artista_id}`);
                }
                break;
            case 'album':
                if (item.albumId || item.album_id) {
                    navigate(`/album/${item.albumId || item.album_id}`);
                }
                break;
        }
        setContextMenu(null);
    };

    React.useEffect(() => {
        const handleClickOutside = () => setContextMenu(null);
        if (contextMenu) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [contextMenu]);

    const isLiked = item && type === 'song' ? isSongLiked(item.id) : false;

    return (
        <>
            <div
                className={`lib-item ${viewMode}`}
                onClick={onClick}
                onContextMenu={handleContextMenu}
            >
                <img src={image} className="lib-item-img" alt={title} />
                <div className="lib-item-info">
                    <h4>{title}</h4>
                    <p>{subtitle}</p>
                </div>
            </div>

            {contextMenu && type === 'song' && (
                <div
                    className="fixed bg-[#2a2a2a] rounded-lg shadow-2xl border border-white/10 py-2 min-w-[200px] z-[9999]"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        className="w-full px-4 py-2 text-left text-white hover:bg-white/10 transition-colors flex items-center gap-2"
                        onClick={() => handleAction('next')}
                    >
                        Reproducir siguiente
                    </button>
                    <button
                        className="w-full px-4 py-2 text-left text-white hover:bg-white/10 transition-colors flex items-center gap-2"
                        onClick={() => handleAction('queue')}
                    >
                        Agregar a cola
                    </button>
                    <button
                        className="w-full px-4 py-2 text-left text-white hover:bg-white/10 transition-colors flex items-center gap-2"
                        onClick={() => handleAction('like')}
                    >
                        {isLiked ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                    </button>
                    <button
                        className="w-full px-4 py-2 text-left text-white hover:bg-white/10 transition-colors flex items-center gap-2"
                        onClick={() => handleAction('playlist')}
                    >
                        Agregar a playlist
                    </button>
                    <div className="h-px bg-white/10 my-1"></div>
                    {(item?.artistId || item?.artista_id) && (
                        <button
                            className="w-full px-4 py-2 text-left text-white hover:bg-white/10 transition-colors flex items-center gap-2"
                            onClick={() => handleAction('artist')}
                        >
                            Ir al artista
                        </button>
                    )}
                    {(item?.albumId || item?.album_id) && (
                        <button
                            className="w-full px-4 py-2 text-left text-white hover:bg-white/10 transition-colors flex items-center gap-2"
                            onClick={() => handleAction('album')}
                        >
                            Ir al álbum
                        </button>
                    )}
                </div>
            )}
        </>
    );
}
