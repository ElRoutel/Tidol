import React, { useState } from "react";
import { usePlaylist } from "../context/PlaylistContext";
import { usePlayer } from "../context/PlayerContext";
import { useNavigate } from "react-router-dom";
import Portal from "./Portal";

const formatDuration = (s) => {
    if (!s || isNaN(s)) return '--:--';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
};

function SongListItem({ song, onPlay, isActive }) {
    const [contextMenu, setContextMenu] = useState(null);
    const { openAddToPlaylistModal } = usePlaylist();
    const { addToQueue, playNext, toggleLike, isSongLiked } = usePlayer();
    const navigate = useNavigate();

    const title = song.titulo || song.title || 'Sin título';
    const artist = song.artista || (song.artist && (song.artist.name || song.artist)) || 'Desconocido';
    const cover = song.portada || song.cover_url || '/default_cover.png';
    const duration = song.duration || song.duracion;
    const isLiked = isSongLiked(song.id);

    const handleContextMenu = (e) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY });
    };

    const handleAction = (action) => {
        switch (action) {
            case 'queue':
                addToQueue(song);
                break;
            case 'next':
                playNext(song);
                break;
            case 'like':
                toggleLike(song.id, song);
                break;
            case 'playlist':
                openAddToPlaylistModal(song);
                break;
            case 'artist':
                if (song.artistId || song.artista_id) {
                    navigate(`/artist/${song.artistId || song.artista_id}`);
                }
                break;
            case 'album':
                if (song.albumId || song.album_id) {
                    navigate(`/album/${song.albumId || song.album_id}`);
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

    return (
        <>
            <button
                className={`song-row ${isActive ? 'active' : ''}`}
                onClick={onPlay}
                onContextMenu={handleContextMenu}
            >
                <img className="song-cover" src={cover} loading="lazy" alt={title} />
                <div className="song-meta">
                    <div className="song-title">{title}</div>
                    <div className="song-artist">{artist}</div>
                </div>
                <div className="song-duration">{formatDuration(duration)}</div>
            </button>

            {contextMenu && (
                <Portal>
                    <div
                        className="absolute bg-[#2a2a2a] rounded-lg shadow-2xl border border-white/10 py-2 min-w-[200px]"
                        style={{
                            top: `${contextMenu.y}px`,
                            left: `${contextMenu.x}px`,
                            pointerEvents: 'auto',
                            zIndex: 9999
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            className="w-full px-4 py-2 text-left text-white hover:bg-white/10 transition-colors"
                            onClick={() => handleAction('next')}
                        >
                            Reproducir siguiente
                        </button>
                        <button
                            className="w-full px-4 py-2 text-left text-white hover:bg-white/10 transition-colors"
                            onClick={() => handleAction('queue')}
                        >
                            Agregar a cola
                        </button>
                        <button
                            className="w-full px-4 py-2 text-left text-white hover:bg-white/10 transition-colors"
                            onClick={() => handleAction('like')}
                        >
                            {isLiked ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                        </button>
                        <button
                            className="w-full px-4 py-2 text-left text-white hover:bg-white/10 transition-colors"
                            onClick={() => handleAction('playlist')}
                        >
                            Agregar a playlist
                        </button>
                        <div className="h-px bg-white/10 my-1"></div>
                        {(song.artistId || song.artista_id) && (
                            <button
                                className="w-full px-4 py-2 text-left text-white hover:bg-white/10 transition-colors"
                                onClick={() => handleAction('artist')}
                            >
                                Ir al artista
                            </button>
                        )}
                        {(song.albumId || song.album_id) && (
                            <button
                                className="w-full px-4 py-2 text-left text-white hover:bg-white/10 transition-colors"
                                onClick={() => handleAction('album')}
                            >
                                Ir al álbum
                            </button>
                        )}
                    </div>
                </Portal>
            )}
        </>
    );
}

export default React.memo(SongListItem);
