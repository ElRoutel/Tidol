import React, { useState, useEffect, useRef, memo, useMemo } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import LibraryItem from './LibraryItem';
import favImage from '../pages/favImage.jpg';

// =============================================================================
//  CONFIGURACIÓN Y CONSTANTES
// =============================================================================

// Altura de la fila del elemento, basada en una relación de aspecto 1:1 + espacio para texto.
// Esto debe coincidir con los estilos en Library.css.
const ROW_TEXT_CONTENT_HEIGHT = 60;
const MIN_ITEM_WIDTH = 200; // Ancho mínimo del item para cálculo de columnas.

// Espacio entre los elementos de la cuadrícula, para consistencia con Library.css.
const getResponsiveGap = () => {
    if (window.innerWidth <= 600) return 16; // 1rem
    if (window.innerWidth <= 900) return 24; // 1.5rem
    return 32; // 2rem
};


// =============================================================================
//  CELDA DE LA CUADRÍCULA MEMOIZADA
// =============================================================================

// La celda se renderiza fuera del componente principal y se memoiza
// para prevenir re-renderizados innecesarios en cada scroll.
const Cell = memo(({ columnIndex, rowIndex, style, data }) => {
    const { columnCount, items, getSubtitle, onClick, gap } = data;
    const index = rowIndex * columnCount + columnIndex;
    const item = items[index];

    // No renderizar si el índice está fuera de los límites.
    if (!item) {
        return null;
    }

    // Ajuste del estilo para crear el efecto de "gap" sin que react-window
    // lo soporte nativamente. Se reduce el tamaño de la celda y se centra.
    const adjustedStyle = {
        ...style,
        width: style.width - gap,
        height: style.height - gap,
        top: style.top + gap / 2,
        left: style.left + gap / 2,
    };

    const uniqueKey = item.id || item.identifier || `idx-${index}`;

    return (
        <div style={adjustedStyle}>
            <LibraryItem
                key={uniqueKey}
                title={item.titulo || item.title || item.nombre || "Sin título"}
                subtitle={getSubtitle(item)}
                image={item.portada || item.cover_url || favImage}
                viewMode="grid"
                item={item}
                type={item.canciones ? "playlist" : "song"}
                onClick={() => onClick(item, index)}
            />
        </div>
    );
});
Cell.displayName = 'GridCell';


// =============================================================================
//  COMPONENTE PRINCIPAL: VIRTUAL GRID
// =============================================================================

export default function VirtualGrid({ data, getSubtitle, onClick }) {
    const containerRef = useRef(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0, columnCount: 0, gap: 32 });

    // Efecto para observar cambios de tamaño en el contenedor y recalcular dimensiones.
    useEffect(() => {
        const resizeObserver = new ResizeObserver(entries => {
            const entry = entries[0];
            if (entry) {
                const { width, height } = entry.contentRect;
                if (width === 0) return;

                const newGap = getResponsiveGap();

                // Cálculo del número de columnas basado en el ancho disponible.
                const newColumnCount = Math.floor((width - newGap) / (MIN_ITEM_WIDTH + newGap));

                // Prevenir división por cero.
                if (newColumnCount > 0) {
                    setDimensions({ width, height, columnCount: newColumnCount, gap: newGap });
                }
            }
        });

        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => {
            if (containerRef.current) {
                resizeObserver.unobserve(containerRef.current);
            }
        };
    }, []); // El array vacío asegura que esto solo se ejecute al montar/desmontar.

    const { width, height, columnCount, gap } = dimensions;

    const rowCount = columnCount > 0 ? Math.ceil(data.length / columnCount) : 0;
    const itemWidth = columnCount > 0 ? width / columnCount : 0;
    const itemHeight = itemWidth + ROW_TEXT_CONTENT_HEIGHT;

    // `itemData` se memoiza para prevenir re-renderizados innecesarios de las celdas.
    const itemData = useMemo(() => ({
        items: data,
        columnCount,
        getSubtitle,
        onClick,
        gap,
    }), [data, columnCount, getSubtitle, onClick, gap]);

    // No renderizar el componente Grid si el contenedor no tiene altura.
    if (height === 0) {
        return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
    }

    return (
        <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
            <Grid
                className="lib-grid-virtual"
                columnCount={columnCount}
                columnWidth={itemWidth}
                height={height}
                rowCount={rowCount}
                rowHeight={itemHeight}
                width={width}
                itemData={itemData}
                overscanCount={5} // Renderiza más items para un scroll más suave.
            >
                {Cell}
            </Grid>
        </div>
    );
}