import React from 'react';
import { IoPlay } from 'react-icons/io5';
import MiniVisualizer from '../MiniVisualizer';
import { useContextMenu } from '../../context/ContextMenuContext';

export default function QuickSelectionCard({ item, onClick, isActive }) {
    const { openContextMenu } = useContextMenu();

    const handleContextMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        openContextMenu(e, 'song', item);
    };

    return (
        <div
            onClick={onClick}
            onContextMenu={handleContextMenu}
            className="group/card flex items-center bg-[#212121]/50 hover:bg-[#212121] rounded-md overflow-hidden cursor-pointer transition-colors pr-4 h-16 md:h-20"
        >
            {/* Image - Fixed width/height */}
            <div className="relative h-full aspect-square flex-shrink-0">
                <img
                    src={item.image || item.portada || item.cover || '/default-album.png'}
                    alt={item.title || item.titulo}
                    className="w-full h-full object-cover"
                />
                {/* Active State (Visualizer) OR Hover State (Play Button) */}
                {isActive ? (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <MiniVisualizer isPlaying={true} />
                    </div>
                ) : (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/card:opacity-100 transition-opacity flex items-center justify-center">
                        <IoPlay className="text-white" size={20} />
                    </div>
                )}
            </div>

            {/* Text Info - Flex grow */}
            <div className="flex flex-col justify-center ml-4 min-w-0 flex-1">
                <h3 className="text-white font-bold text-sm md:text-base truncate">{item.title || item.titulo}</h3>
                <p className="text-[#aaaaaa] text-xs md:text-sm truncate">
                    {item.artist || item.artista || 'Desconocido'}
                </p>
            </div>

            {/* Optional: Like/Menu buttons could go here */}
        </div>
    );
}
