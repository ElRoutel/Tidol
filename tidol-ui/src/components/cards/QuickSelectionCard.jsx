import React from 'react';
import { IoPlay } from 'react-icons/io5';
import MiniVisualizer from '../MiniVisualizer';
import { useContextMenu } from '../../context/ContextMenuContext';

const QuickSelectionCard = ({ item, onClick, isActive }) => {
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
            className="group/card flex items-center bg-white/5 hover:bg-white/10 rounded-lg overflow-hidden cursor-pointer transition-all duration-200 pr-4 h-20 shadow-sm hover:shadow-md"
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
                        <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center shadow-lg">
                            <IoPlay className="text-black ml-0.5" size={18} />
                        </div>
                    </div>
                )}
            </div>

            {/* Text Info - Flex grow */}
            <div className="flex flex-col justify-center ml-4 min-w-0 flex-1">
                <h3 className="text-white font-semibold text-sm md:text-base truncate leading-tight">{item.title || item.titulo}</h3>
                <p className="text-[#aaa] text-xs md:text-sm truncate mt-0.5">
                    {item.artist || item.artista || 'Desconocido'}
                </p>
            </div>
        </div>
    );
};

export default React.memo(QuickSelectionCard);