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

export default function ListenAgainCard({ item, onClick, onPlay, isActive }) {
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
            className="group/card flex flex-col gap-3 w-[150px] md:w-[180px] cursor-pointer flex-shrink-0"
        >
            {/* Image Container */}
            <div className="relative aspect-square w-full">
                <img
                    src={image}
                    alt={title}
                    className="w-full h-full object-cover rounded-md"
                />

                {/* Active State (Visualizer) OR Hover State (Play Button) */}
                {isActive ? (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-md">
                        <MiniVisualizer isPlaying={true} />
                    </div>
                ) : onPlay ? (
                    <div
                        onClick={handlePlayClick}
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover/card:opacity-100 transition-opacity flex items-center justify-center rounded-md hover:bg-black/50"
                    >
                        <IoPlay className="text-white drop-shadow-lg transform hover:scale-110 transition-transform" size={48} />
                    </div>
                ) : null}
            </div>

            {/* Text Info */}
            <div className="flex flex-col mt-2">
                <h3 className="text-white font-bold text-sm truncate">{title}</h3>
                <p className="text-[#aaaaaa] text-xs truncate">
                    {subtitle}
                </p>
            </div>
        </div>
    );
}
