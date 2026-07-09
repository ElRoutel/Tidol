import React from 'react';
import { IoPlay } from 'react-icons/io5';
import MiniVisualizer from '../MiniVisualizer';
import { useContextMenuTrigger } from '../../hooks/useContextMenuTrigger';
import { getCoverSrc } from '../../utils/coverArt';

export default function QuickSelectionCard({ item, onClick, isActive, isPlaying }) {
    const { triggerProps } = useContextMenuTrigger('song', item);

    const title = item.title || 'Sin título';
    const artist = item.artist || item.artista || item.artistName || 'Artista desconocido';
    const artwork = getCoverSrc(item, true);

    return (
        <div
            onClick={onClick}
            {...triggerProps}
            className="ctx-longpress group/card flex items-center h-20 pr-4 rounded-xl overflow-hidden cursor-pointer
                       bg-white/[0.04] border border-white/[0.06]
                       hover:bg-white/[0.09] hover:border-white/[0.14] hover:scale-[1.015]
                       active:scale-[0.99] transition-all duration-300"
        >
            {/* Portada */}
            <div className="relative h-full aspect-square flex-shrink-0">
                <img
                    src={artwork}
                    alt={title}
                    loading="lazy"
                    decoding="async"
                    onError={(e) => { e.currentTarget.src = '/default-album.png'; }}
                    className="w-full h-full object-cover"
                />
                {isActive ? (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <MiniVisualizer isPlaying={isPlaying} />
                    </div>
                ) : (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/card:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg">
                            <IoPlay className="text-black ml-0.5" size={18} />
                        </div>
                    </div>
                )}
            </div>

            {/* Texto */}
            <div className="flex flex-col justify-center ml-4 min-w-0 flex-1">
                <h3 className="text-white font-semibold text-sm md:text-base truncate leading-tight">{title}</h3>
                <p className="text-white/50 text-xs md:text-sm truncate mt-0.5">{artist}</p>
            </div>
        </div>
    );
}
