import React, { useRef } from 'react';
import SongShelfCard from '../cards/SongShelfCard';
import AlbumCard from '../AlbumCard';

export default function MediaCarousel({ items, type = 'song', onPlay }) {
    const containerRef = useRef(null);

    // Exponer métodos de scroll al padre si fuera necesario, 
    // pero por ahora el control lo tiene el usuario con scroll nativo
    // o los botones del SectionBlock si se conectaran.

    if (!items || items.length === 0) return null;

    return (
        <div
            ref={containerRef}
            className="flex overflow-x-auto gap-4 px-4 md:px-0 pb-4 scrollbar-hide snap-x"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
            {items.map((item, index) => (
                <div key={item.id || index} className="snap-start shrink-0">
                    {type === 'song' ? (
                        <SongShelfCard
                            song={item}
                            onPlay={() => onPlay && onPlay(item, index)}
                        />
                    ) : (
                        <AlbumCard album={item} />
                    )}
                </div>
            ))}
        </div>
    );
}
