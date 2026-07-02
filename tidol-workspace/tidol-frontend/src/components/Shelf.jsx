import React, { useRef, useState, useEffect } from 'react';
import { IoChevronBack, IoChevronForward } from 'react-icons/io5';

export default function Shelf({ title, subtitle, children }) {
  const scrollRef = useRef(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(true);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeft(scrollLeft > 0);
      setShowRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [children]);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left'
        ? -scrollRef.current.offsetWidth / 2
        : scrollRef.current.offsetWidth / 2;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="flex flex-col gap-3 py-2 group relative z-0">
      {/* Header: eyebrow + título; flechas discretas que aparecen al pasar el ratón */}
      <div className="flex items-end justify-between px-4 md:px-0 mb-2">
        <div className="flex flex-col">
          {subtitle && (
            <span className="text-white/40 text-[11px] font-bold uppercase tracking-[1.4px] mb-1.5">
              {subtitle}
            </span>
          )}
          <h2 className="text-white text-2xl md:text-3xl font-bold tracking-tight">{title}</h2>
        </div>

        <div className="hidden md:flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button
            onClick={() => scroll('left')}
            disabled={!showLeft}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.08] hover:bg-white/[0.16] text-white transition-colors disabled:opacity-20 disabled:cursor-default"
            aria-label="Desplazar a la izquierda"
          >
            <IoChevronBack size={18} />
          </button>
          <button
            onClick={() => scroll('right')}
            disabled={!showRight}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.08] hover:bg-white/[0.16] text-white transition-colors disabled:opacity-20 disabled:cursor-default"
            aria-label="Desplazar a la derecha"
          >
            <IoChevronForward size={18} />
          </button>
        </div>
      </div>

      {/* Contenido desplazable */}
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex overflow-x-auto gap-4 px-4 md:px-0 pb-3 snap-x scroll-smooth"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {children}
      </div>
    </div>
  );
}
