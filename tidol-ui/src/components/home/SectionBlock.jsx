import React from 'react';
import { IoChevronBack, IoChevronForward } from 'react-icons/io5';

export default function SectionBlock({ title, subtitle, onMore, children, onPrev, onNext, showControls = false }) {
    return (
        <div className="flex flex-col gap-4 mb-8 relative group">
            {/* Header */}
            <div className="flex items-end justify-between px-4 md:px-0">
                <div className="flex flex-col">
                    {subtitle && (
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                            {subtitle}
                        </span>
                    )}
                    <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                        {title}
                    </h2>
                </div>

                <div className="flex items-center gap-2">
                    {onMore && (
                        <button
                            onClick={onMore}
                            className="text-xs font-bold text-gray-400 hover:text-white transition-colors px-3 py-1 rounded-full border border-white/10 hover:border-white/30 uppercase tracking-wide"
                        >
                            Más
                        </button>
                    )}

                    {showControls && (
                        <div className="hidden md:flex items-center gap-2 ml-2">
                            <button
                                onClick={onPrev}
                                className="w-8 h-8 flex items-center justify-center rounded-full border border-white/10 hover:bg-white/10 text-white transition-all disabled:opacity-30"
                                aria-label="Previous"
                            >
                                <IoChevronBack size={16} />
                            </button>
                            <button
                                onClick={onNext}
                                className="w-8 h-8 flex items-center justify-center rounded-full border border-white/10 hover:bg-white/10 text-white transition-all disabled:opacity-30"
                                aria-label="Next"
                            >
                                <IoChevronForward size={16} />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="relative">
                {children}
            </div>
        </div>
    );
}
