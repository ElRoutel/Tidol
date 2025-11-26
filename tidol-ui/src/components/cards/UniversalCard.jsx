import React, { useMemo, useCallback } from 'react';
import { usePlayerState, usePlayerActions } from '../../context/PlayerContext';
import { useContextMenu } from '../../context/ContextMenuContext';
import { FaPlay, FaPause, FaEllipsisH } from 'react-icons/fa';
import { IoPlaySharp, IoPauseSharp } from 'react-icons/io5';

/**
 * Normalizes data from various sources (local, archive, etc.) into a standard format.
 */
const normalizeData = (data) => {
    if (!data) return {};
    return {
        id: data.id || data.identifier,
        title: data.titulo || data.title || data.name || 'Unknown',
        subtitle: data.artista || data.artist || data.creator || '',
        image: data.portada || data.cover_url || data.thumbnail || data.image || '/default_cover.png',
        url: data.url || data.file || data.playbackUrl,
        type: data.type || 'song', // Default to song if not specified
        ...data
    };
};

/**
 * UniversalCard Component
 * Replaces SongShelfCard, SongGridCard, LocalSongCard, etc.
 * 
 * @param {Object} props
 * @param {Object} props.data - The data object (song, album, artist, etc.)
 * @param {string} props.type - 'song' | 'album' | 'artist' | 'playlist'
 * @param {string} props.variant - 'shelf' | 'grid' | 'list' | 'compact' | 'hero'
 * @param {Function} props.onPlay - Callback when play is clicked
 * @param {number} props.index - Optional index for list views
 */
const UniversalCard = React.memo(({
    data,
    type = 'song',
    variant = 'shelf',
    onPlay,
    index,
    children
}) => {
    const { currentSong, isPlaying: isGlobalPlaying } = usePlayerState();
    const { openContextMenu } = useContextMenu();

    const item = useMemo(() => normalizeData(data), [data]);

    const isPlaying = useMemo(() => {
        if (type !== 'song') return false;
        return currentSong && (currentSong.id === item.id || currentSong.identifier === item.identifier);
    }, [currentSong, item.id, item.identifier, type]);

    const showPause = isPlaying && isGlobalPlaying;

    const handlePlay = useCallback((e) => {
        e.stopPropagation();
        if (onPlay) {
            onPlay(item);
        }
    }, [onPlay, item]);

    const handleMenu = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        openContextMenu(e, type, item);
    }, [openContextMenu, type, item]);

    // Data attributes for legacy global context menu listener
    const dataAttributes = {
        'data-id': item.id,
        'data-title': item.title,
        'data-artist': item.subtitle,
        'data-cover': item.image,
        'data-url': item.url,
        'data-duration': item.duracion || item.duration,
        'data-album': item.album || item.album_name,
        'data-artist-id': item.artistId || item.artista_id,
        'data-album-id': item.albumId || item.album_id,
    };

    // --- Render Variants ---

    // 1. Shelf Variant (Vertical, for Carousels)
    if (variant === 'shelf') {
        return (
            <div
                className={`group relative flex-shrink-0 w-36 md:w-48 flex flex-col gap-3 cursor-pointer ${type}-item`}
                onClick={handlePlay}
                onContextMenu={handleMenu}
                {...dataAttributes}
            >
                <div className="relative aspect-square w-full overflow-hidden rounded-md glass-card group-hover:bg-white/10 transition-colors">
                    <img
                        src={item.image}
                        alt={item.title}
                        className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${type === 'artist' ? 'rounded-full' : ''}`}
                        loading="lazy"
                    />

                    {/* Hover Overlay with Play Button */}
                    <div className={`absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center ${isPlaying ? 'opacity-100' : ''}`}>
                        <button
                            className="w-12 h-12 rounded-full bg-primary text-black flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform hover:bg-primary-hover"
                            onClick={handlePlay}
                        >
                            {showPause ? <IoPauseSharp size={24} /> : <IoPlaySharp size={24} className="ml-1" />}
                        </button>
                    </div>

                    {/* Menu Button (Top Right) */}
                    <button
                        className="absolute top-2 right-2 p-2 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                        onClick={handleMenu}
                    >
                        <FaEllipsisH size={14} />
                    </button>
                </div>

                <div className="flex flex-col gap-1">
                    <h3 className="text-sm font-bold text-white truncate">{item.title}</h3>
                    <p className="text-xs text-text-secondary truncate">{item.subtitle}</p>
                </div>
            </div>
        );
    }

    // 2. Grid Variant (Horizontal, for Grids)
    if (variant === 'grid') {
        return (
            <div
                className={`group relative flex items-center gap-3 p-2 rounded-md glass-card hover:bg-white/10 transition-colors cursor-pointer ${type}-item ${isPlaying ? 'bg-white/10 border-primary/50' : ''}`}
                onClick={handlePlay}
                onContextMenu={handleMenu}
                {...dataAttributes}
            >
                <div className="relative w-12 h-12 flex-shrink-0">
                    <img
                        src={item.image}
                        alt={item.title}
                        className="w-full h-full object-cover rounded"
                        loading="lazy"
                    />
                    {/* Overlay for playing state */}
                    {isPlaying && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded">
                            <div className="w-3 h-3 bg-primary rounded-full animate-pulse" />
                        </div>
                    )}
                </div>

                <div className="flex-1 min-w-0 overflow-hidden">
                    <h4 className={`text-sm font-semibold truncate ${isPlaying ? 'text-primary' : 'text-white'}`}>{item.title}</h4>
                    <p className="text-xs text-text-secondary truncate">{item.subtitle}</p>
                </div>

                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        className="p-2 text-text-secondary hover:text-white transition-colors"
                        onClick={handleMenu}
                    >
                        <FaEllipsisH />
                    </button>
                    <button
                        className="w-8 h-8 rounded-full bg-primary text-black flex items-center justify-center shadow-sm hover:scale-105 transition-transform"
                        onClick={handlePlay}
                    >
                        {showPause ? <IoPauseSharp size={14} /> : <IoPlaySharp size={14} className="ml-0.5" />}
                    </button>
                </div>
            </div>
        );
    }

    // 3. List Variant (Row, for Playlists/Songs list)
    if (variant === 'list') {
        return (
            <div
                className={`group flex items-center gap-4 p-2 rounded-md hover:bg-white/5 transition-colors cursor-pointer ${type}-item ${isPlaying ? 'bg-white/10' : ''}`}
                onClick={handlePlay}
                onContextMenu={handleMenu}
                {...dataAttributes}
            >
                {index !== undefined && (
                    <span className="w-6 text-center text-sm text-text-secondary group-hover:hidden">
                        {isPlaying ? <span className="text-primary animate-pulse">♫</span> : index + 1}
                    </span>
                )}
                {index !== undefined && (
                    <button className="w-6 hidden group-hover:flex items-center justify-center text-white" onClick={handlePlay}>
                        {showPause ? <IoPauseSharp size={14} /> : <IoPlaySharp size={14} />}
                    </button>
                )}

                <img
                    src={item.image}
                    alt={item.title}
                    className="w-10 h-10 object-cover rounded"
                    loading="lazy"
                />

                <div className="flex-1 min-w-0">
                    <h4 className={`text-sm font-medium truncate ${isPlaying ? 'text-primary' : 'text-white'}`}>{item.title}</h4>
                    <p className="text-xs text-text-secondary truncate">{item.subtitle}</p>
                </div>

                <div className="hidden md:block w-1/4 text-xs text-text-secondary truncate">
                    {item.album || ''}
                </div>

                <div className="flex items-center gap-4">
                    {children}
                    <button
                        className="opacity-0 group-hover:opacity-100 p-2 text-text-secondary hover:text-white transition-opacity"
                        onClick={handleMenu}
                    >
                        <FaEllipsisH />
                    </button>
                    <span className="text-xs text-text-secondary w-10 text-right">
                        {item.duracion ? formatDuration(item.duracion) : ''}
                    </span>
                </div>
            </div>
        );
    }

    return null;
});

// Helper for duration
const formatDuration = (seconds) => {
    if (!seconds) return '';
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
};

UniversalCard.displayName = 'UniversalCard';

export default UniversalCard;
