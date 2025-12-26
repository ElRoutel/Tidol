import React, { useRef, useImperativeHandle, forwardRef, useState, useEffect } from 'react';
import UniversalCard from '../cards/UniversalCard';
import { IoChevronBack, IoChevronForward } from 'react-icons/io5';

const MediaCarousel = forwardRef(({ items, type = 'song', onPlay }, ref) => {
    const containerRef = useRef(null);
    const [showLeft, setShowLeft] = useState(false);
    const [showRight, setShowRight] = useState(true);

    const checkScroll = () => {
        if (containerRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = containerRef.current;
            setShowLeft(scrollLeft > 0);
            setShowRight(scrollLeft < scrollWidth - clientWidth - 10);
        }
    };

    useEffect(() => {
        checkScroll();
        window.addEventListener('resize', checkScroll);
        return () => window.removeEventListener('resize', checkScroll);
    }, [items]);

    const scroll = (direction) => {
        if (containerRef.current) {
            const scrollAmount = direction === 'left' ? -300 : 300;
            containerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
    };

    useImperativeHandle(ref, () => ({
        scrollLeft: () => scroll('left'),
        scrollRight: () => scroll('right')
    }));

    if (!items || items.length === 0) return null;

    const isCompact = type === 'compact';

    return (
        <div className="relative group">
            {/* Left Arrow */}
            {showLeft && (
                <button
                    onClick={() => scroll('left')}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 hidden md:flex items-center justify-center w-10 h-10 shadow-lg"
                >
                    <IoChevronBack size={24} />
                </button>
            )}

            {/* Right Arrow */}
            {showRight && (
                <button
                    onClick={() => scroll('right')}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 hidden md:flex items-center justify-center w-10 h-10 shadow-lg"
                >
                    <IoChevronForward size={24} />
                </button>
            )}

            <div
                ref={containerRef}
                onScroll={checkScroll}
                className={`
                    ${isCompact
                        ? 'grid grid-rows-3 grid-flow-col auto-cols-max gap-y-2 gap-x-4 md:flex md:flex-row md:gap-4'
                        : 'flex gap-4'
                    }
                    overflow-x-auto px-4 md:px-0 pb-4 snap-x scrollbar-hide md:scrollbar-default
                `}
                style={{
                    scrollbarWidth: window.innerWidth < 768 ? 'none' : 'auto',
                    msOverflowStyle: window.innerWidth < 768 ? 'none' : 'auto'
                }}
            >
                {items.map((item, index) => (
                    <div key={item.id || index} className="snap-start shrink-0">
                        {isCompact ? (
                            <div className="w-[85vw] md:w-72">
                                <UniversalCard
                                    data={item}
                                    type="song"
                                    variant="grid"
                                    onPlay={() => onPlay && onPlay(item, index)}
                                />
                            </div>
                        ) : (
                            <UniversalCard
                                data={item}
                                type={type === 'album' ? 'album' : 'song'}
                                variant="shelf"
                                onPlay={() => onPlay && onPlay(item, index)}
                            />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
});

export default MediaCarousel;

