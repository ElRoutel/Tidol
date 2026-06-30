// src/components/common/SmartArtwork.tsx
import React, { useState, useMemo } from 'react';
import { IoMusicalNotes } from 'react-icons/io5';
import { resolveArtworkUrl } from '../../utils/artwork';
import { Artwork } from '../../types/music';

interface SmartArtworkProps {
    artwork?: Artwork;
    size: number;
    alt?: string;
    className?: string;
}

/**
 * SmartArtwork Component
 * 
 * Un componente de alto rendimiento para portadas de álbumes y artistas.
 * - Resolución Responsiva: Usa resolveArtworkUrl para pedir solo lo necesario.
 * - UX Fluida: Shimmer effect durante la carga y fallback elegante en errores.
 * - Layout Estable: Ratio 1:1 estricto para evitar saltos (CLS).
 */
export const SmartArtwork: React.FC<SmartArtworkProps> = ({
    artwork,
    size,
    alt = "Artwork",
    className = ""
}) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);

    // Resolvemos la URL inyectando el tamaño solicitado
    const resolvedUrl = useMemo(() =>
        resolveArtworkUrl(artwork?.url, size),
        [artwork?.url, size]);

    return (
        <div className={`relative aspect-square w-full overflow-hidden bg-white/5 ${className}`}>
            {/* 1. SHIMMER EFFECT (Esqueleto animado) */}
            {!isLoaded && !hasError && (
                <div className="absolute inset-0 z-10 animate-pulse bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            )}

            {/* 2. FALLBACK ICON (En caso de error) */}
            {hasError ? (
                <div className="absolute inset-0 flex items-center justify-center bg-white/5 text-white/20">
                    <IoMusicalNotes size={size / 4} />
                </div>
            ) : (
                <img
                    src={resolvedUrl}
                    alt={alt}
                    loading="lazy"
                    className={`
            w-full h-full object-cover transition-all duration-700
            ${isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}
          `}
                    onLoad={() => setIsLoaded(true)}
                    onError={() => setHasError(true)}
                />
            )}

            {/* Overlay opcional para efecto de profundidad (Apple Style) */}
            <div className="absolute inset-0 pointer-events-none ring-1 ring-inset ring-white/10 rounded-inherit" />
        </div>
    );
};
