import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import SongShelfCard from '../cards/SongShelfCard';
import AlbumCard from '../AlbumCard';

const MediaCarousel = forwardRef(({ items, type = 'song', onPlay }, ref) => {
    const containerRef = useRef(null);

    useImperativeHandle(ref, () => ({
        scrollLeft: () => {
            if (containerRef.current) {
                containerRef.current.scrollBy({ left: -300, behavior: 'smooth' });
            }
        },
        scrollRight: () => {
            if (containerRef.current) {
                containerRef.current.scrollBy({ left: 300, behavior: 'smooth' });
            }
        }
    }));

    if (!items || items.length === 0) return null;

    return (
        <div
            ref={containerRef}
            className="flex overflow-x-auto gap-4 px-4 md:px-0 pb-4 snap-x scrollbar-hide md:scrollbar-default"
            style={{
                // Mobile: hide scrollbar
                // Desktop: let CSS handle it (or remove inline styles if class handles it)
                scrollbarWidth: window.innerWidth < 768 ? 'none' : 'auto',
                msOverflowStyle: window.innerWidth < 768 ? 'none' : 'auto'
            }}
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
});

export default MediaCarousel;
