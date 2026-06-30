import React, { useState, memo, useEffect } from 'react';
import { getOptimizedImageUrl } from '../utils/imageUtils';

/**
 * Componente de Imagen Optimizado con Skeleton y Lazy Loading.
 * @param {string} src - URL de la imagen.
 * @param {string} alt - Texto alternativo.
 * @param {string} className - Clases CSS adicionales.
 * @param {number} width - Ancho objetivo para optimización en servidor.
 * @param {boolean} priority - Si es true, usa loading="eager" (para LCP).
 * @param {object} style - Estilos inline.
 */
const OptimizedImage = memo(({
    src,
    alt,
    className = '',
    width,
    priority = false,
    style = {},
    ...props
}) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState(false);

    // Generar URL optimizada
    const optimizedSrc = React.useMemo(() => {
        return getOptimizedImageUrl(src, width);
    }, [src, width]);

    useEffect(() => {
        // Si cambia el src, reseteamos estado
        setIsLoaded(false);
        setError(false);
    }, [src]);

    return (
        <div
            className={`relative overflow-hidden ${className}`}
            style={{ ...style, isolation: 'isolate' }}
            {...props}
        >
            {/* Skeleton Loading State */}
            {!isLoaded && (
                <div
                    className="absolute inset-0 bg-white/10 animate-pulse z-0"
                    style={{ willChange: 'opacity' }}
                />
            )}

            <img
                src={optimizedSrc}
                alt={alt}
                loading={priority ? "eager" : "lazy"}
                decoding="async" // CRÍTICO: Decodificación fuera del main thread
                onLoad={() => setIsLoaded(true)}
                onError={() => {
                    setIsLoaded(true);
                    setError(true);
                }}
                className={`w-full h-full object-cover transition-opacity duration-500 ease-in-out ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
                style={{
                    // Si hay error, mostrar un fallback o mantener transparente? 
                    // Por ahora, si hay error, mostramos un placeholder o gris.
                    // La transición de opacidad maneja la entrada suave.
                }}
            />

            {/* Fallback visual si falla la carga (opcional) */}
            {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-neutral-800 text-neutral-600">
                    <span className="text-xs">IMG Error</span>
                </div>
            )}
        </div>
    );
});

OptimizedImage.displayName = 'OptimizedImage';

export default OptimizedImage;
