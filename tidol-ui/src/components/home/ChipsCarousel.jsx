import React, { useRef, useState, useEffect } from 'react';
import { IoChevronBack, IoChevronForward } from 'react-icons/io5';
import '../../styles/glass.css'; // Asegurar estilos base

const CHIPS = [
    { id: 'all', label: 'Todo' },
    { id: 'podcasts', label: 'Podcasts' },
    { id: 'relax', label: 'Relax' },
    { id: 'workout', label: 'Entrenamiento' },
    { id: 'party', label: 'Fiesta' },
    { id: 'focus', label: 'Concentración' }
];

export default function ChipsCarousel({ selectedChip, onSelectChip }) {
    const containerRef = useRef(null);
    const [showLeftArrow, setShowLeftArrow] = useState(false);
    const [showRightArrow, setShowRightArrow] = useState(true);

    const checkScroll = () => {
        if (!containerRef.current) return;
        const { scrollLeft, scrollWidth, clientWidth } = containerRef.current;
        setShowLeftArrow(scrollLeft > 0);
        setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 5); // 5px buffer
    };

    useEffect(() => {
        checkScroll();
        window.addEventListener('resize', checkScroll);
        return () => window.removeEventListener('resize', checkScroll);
    }, []);

    const scroll = (direction) => {
        if (!containerRef.current) return;
        const scrollAmount = 300;
        containerRef.current.scrollBy({
            left: direction === 'left' ? -scrollAmount : scrollAmount,
            behavior: 'smooth'
        });
    };

    return (
        <div className="relative group w-full mb-6">
            {/* Botón Izquierda - Oculto en móvil */}
            <button
                onClick={() => scroll('left')}
                className={`hidden md:block absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white hover:bg-white/20 transition-all ${showLeftArrow ? 'opacity-100 visible' : 'opacity-0 invisible'
                    }`}
                aria-label="Scroll left"
            >
                <IoChevronBack size={20} />
            </button>

            {/* Contenedor de Chips */}
            <div
                ref={containerRef}
                onScroll={checkScroll}
                className="flex overflow-x-auto gap-3 px-4 py-2 scrollbar-hide snap-x"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {CHIPS.map((chip) => (
                    <button
                        key={chip.id}
                        onClick={() => onSelectChip(chip.id)}
                        className={`
              whitespace-nowrap px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 snap-start
              ${selectedChip === chip.id
                                ? 'bg-white text-black shadow-lg scale-105'
                                : 'bg-white/10 text-white hover:bg-white/20 border border-white/5'
                            }
            `}
                    >
                        {chip.label}
                    </button>
                ))}
            </div>

            {/* Botón Derecha - Oculto en móvil */}
            <button
                onClick={() => scroll('right')}
                className={`hidden md:block absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white hover:bg-white/20 transition-all ${showRightArrow ? 'opacity-100 visible' : 'opacity-0 invisible'
                    }`}
                aria-label="Scroll right"
            >
                <IoChevronForward size={20} />
            </button>
        </div>
    );
}
