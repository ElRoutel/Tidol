import React, { useRef } from 'react';
import { IoChevronBack, IoChevronForward } from 'react-icons/io5';

export default function Shelf({ title, subtitle, children }) {
  const scrollRef = useRef(null);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const { current } = scrollRef;
      const scrollAmount = direction === 'left' ? -current.offsetWidth / 2 : current.offsetWidth / 2;
      current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="flex flex-col gap-4 py-4 group relative z-0">
      {/* Header */}
      <div className="flex flex-col px-4 md:px-0 mb-2">
        {subtitle && (
          <span className="text-[#999] text-xs font-semibold uppercase tracking-wider mb-2">
            {subtitle}
          </span>
        )}
        <h2 className="text-white text-2xl md:text-3xl font-bold">{title}</h2>
      </div>

      {/* Container for Scroll + Buttons */}
      <div className="relative">
        {/* Left Button */}
        <button
          onClick={() => scroll('left')}
          className="hidden md:group-hover:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-[#212121] border border-white/10 rounded-full items-center justify-center text-white shadow-xl hover:bg-[#333] transition-all -ml-5"
          aria-label="Scroll left"
        >
          <IoChevronBack size={24} />
        </button>

        {/* Scrollable Content */}
        <div
          ref={scrollRef}
          className="flex overflow-x-auto gap-4 px-4 md:px-0 pb-4 hover-scrollbar snap-x scroll-smooth"
        >
          {children}
        </div>

        {/* Right Button */}
        <button
          onClick={() => scroll('right')}
          className="hidden md:group-hover:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-[#212121] border border-white/10 rounded-full items-center justify-center text-white shadow-xl hover:bg-[#333] transition-all -mr-5"
          aria-label="Scroll right"
        >
          <IoChevronForward size={24} />
        </button>
      </div>
    </div>
  );
}
