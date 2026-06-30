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
    <div className="flex flex-col gap-4 py-4 group relative z-0">
      {/* Header: título a la izquierda, flechas a la derecha */}
      <div className="flex items-end justify-between px-4 md:px-0 mb-2">
        <div className="flex flex-col">
          {subtitle && (
            <span className="text-[#999] text-xs font-semibold uppercase tracking-wider mb-2">
              {subtitle}
            </span>
          )}
          <h2 className="text-white text-2xl md:text-3xl font-bold">{title}</h2>
        </div>

        {/* Navigation arrows — top right */}
        <div className="flex gap-2">
          <button
            onClick={() => scroll('left')}
            disabled={!showLeft}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-all disabled:opacity-20 disabled:cursor-default"
            aria-label="Scroll left"
          >
            <IoChevronBack size={18} />
          </button>
          <button
            onClick={() => scroll('right')}
            disabled={!showRight}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-all disabled:opacity-20 disabled:cursor-default"
            aria-label="Scroll right"
          >
            <IoChevronForward size={18} />
          </button>
        </div>
      </div>

      {/* Scrollable Content + visible scrollbar */}
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex overflow-x-auto gap-4 px-4 md:px-0 pb-3 snap-x scroll-smooth"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.25) transparent',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {children}
      </div>
    </div>
  );
}
