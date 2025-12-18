import React from 'react';
import { IoPlay } from 'react-icons/io5';
import MiniVisualizer from '../MiniVisualizer';
import { useContextMenu } from '../../context/ContextMenuContext';

// Helper function for robust data binding
const getSubtitle = (item) => {
    if (!item) return 'Desconocido';

    // 1. Direct properties (Standard)
    if (item.artist) return item.artist;
    if (item.artista) return item.artista;
    if (item.autor) return item.autor; // Albums use 'autor' from DB

    // 2. Nested arrays (Spotify/API style)
    if (Array.isArray(item.artists) && item.artists.length > 0) {
        return item.artists[0].name || item.artists[0].titulo || 'Artista';
    }

    // 3. Fallback properties
    if (item.subtitle) return item.subtitle;
    if (item.description) return item.description;
    if (item.owner) return item.owner;

    return 'Desconocido';
};

// ⚡ Bolt Optimization: Wrapped with React.memo
// This prevents the card from re-rendering if its props haven't changed,
// which is common in lists where parent components might re-render.
const ListenAgainCard = ({ item, onClick, onPlay, isActive }) => {
    const { openContextMenu } = useContextMenu();

    // Defensive Data Mapping
    const title = item.title || item.titulo || item.name || 'Sin Título';
    const image = item.image || item.portada || item.cover || item.thumbnail || '/default-album.png';
    const subtitle = getSubtitle(item);

    const handlePlayClick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (onPlay) onPlay();
    };

    const handleContextMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        openContextMenu(e, 'song', item);
    };

    return (
        <div
            onClick={onClick}
            onContextMenu={handleContextMenu}
            className="group/card flex flex-col gap-3 w-[160px] md:w-[200px] cursor-pointer flex-shrink-0 transition-all duration-200"
        >
            {/* Image Container */}
            <div className="relative aspect-square w-full overflow-hidden rounded-lg">
                <img
                    src={image}
                    alt={title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover/card:scale-105"
                />

                {/* Active State (Visualizer) OR Hover State (Play Button) */}
                {isActive ? (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-lg">
                        <MiniVisualizer isPlaying={true} />
                    </div>
                ) : onPlay ? (
                    <div
                        onClick={handlePlayClick}
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover/card:opacity-100 transition-all duration-200 flex items-center justify-center rounded-lg hover:bg-black/50"
                    >
                        <div className="w-12 h-12 md:w-14 md:h-14 bg-primary rounded-full flex items-center justify-center shadow-lg transform transition-transform group-hover/card:scale-110">
                            <IoPlay className="text-black ml-0.5" size={24} />
                        </div>
                    </div>
                ) : null}
            </div>

            {/* Text Info */}
            <div className="flex flex-col">
                <h3 className="text-white font-semibold text-sm md:text-base truncate leading-tight">{title}</h3>
                <p className="text-[#aaa] text-xs md:text-sm truncate mt-1">
                    {subtitle}
                    {item.play_count > 0 && (
                        <span className="ml-2 text-[10px] bg-white/10 px-1.5 py-0.5 rounded-full">
                            {item.play_count} plays
                        </span>
                    )}
                </p>
            </div>
        </div>
    );
};

export default React.memo(ListenAgainCard);
