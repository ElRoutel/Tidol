import React, { useRef, useState, useEffect, useMemo, memo } from "react";
import { FixedSizeGrid } from "react-window";
import LibraryItem from "./LibraryItem";
import favImage from "../assets/favImage.jpg";

const GUTTER_SIZE = 12; // Espacio entre items

// ⚡ OPTIMIZACIÓN: El componente Cell se define fuera y se memoiza.
// Esto previene que se re-cree en cada render del componente padre (VirtualGrid),
// lo cual es crucial para el rendimiento de react-window.
const Cell = memo(({ columnIndex, rowIndex, style, data }) => {
  const { columnCount, items, getSubtitle, onClick, currentView } = data;
  const index = rowIndex * columnCount + columnIndex;
  const item = items[index];

  if (!item) {
    return null; // No renderizar si no hay item (en la última fila)
  }

  // ⚡ OPTIMIZACIÓN: Se ajusta el estilo para crear un "gutter" o espacio.
  // Se reduce el tamaño de la celda y se aplica un offset para centrarla,
  // creando un espaciado uniforme sin afectar el layout de la cuadrícula.
  const styleWithGutter = {
    ...style,
    left: style.left + GUTTER_SIZE / 2,
    top: style.top + GUTTER_SIZE / 2,
    width: style.width - GUTTER_SIZE,
    height: style.height - GUTTER_SIZE,
  };

  const uniqueKey = item.id || item.identifier || `idx-${index}`;

  return (
    <div style={styleWithGutter}>
      <LibraryItem
        key={uniqueKey}
        title={item.titulo || item.title || item.nombre || "Sin título"}
        subtitle={getSubtitle(item)}
        image={item.portada || item.cover_url || favImage}
        viewMode="grid"
        item={item}
        type={currentView === "playlists" ? "playlist" : "song"}
        onClick={() => onClick(item, index)}
      />
    </div>
  );
});
Cell.displayName = 'GridCell'; // Añadir displayName para facilitar el debugging

export default function VirtualGrid({ data, getSubtitle, onClick, currentView }) {
  const gridRef = useRef(null);
  const [gridSize, setGridSize] = useState({ width: 0, height: 0, columnCount: 0 });

  useEffect(() => {
    const gridElement = gridRef.current;
    if (!gridElement) return;

    // ⚡ OPTIMIZACIÓN: Usamos ResizeObserver para recalcular el tamaño de la
    // cuadrícula dinámicamente si el contenedor cambia de tamaño.
    // Esto hace la cuadrícula virtualizada totalmente responsiva.
    const resizeObserver = new ResizeObserver(() => {
      const parent = gridElement.parentElement;
      if (parent) {
        const MIN_ITEM_WIDTH = 160;
        const parentWidth = parent.offsetWidth;
        const newColumnCount = Math.max(1, Math.floor(parentWidth / MIN_ITEM_WIDTH));

        setGridSize({
          width: parent.offsetWidth,
          height: parent.offsetHeight,
          columnCount: newColumnCount,
        });
      }
    });

    resizeObserver.observe(gridElement);
    return () => resizeObserver.disconnect();
  }, []);

  const { width, height, columnCount } = gridSize;

  if (columnCount === 0) {
    // Renderiza el div para que el ResizeObserver pueda medirlo
    return <div ref={gridRef} style={{ width: '100%', height: '100%' }} />;
  }

  const rowCount = Math.ceil(data.length / columnCount);
  const columnWidth = width / columnCount;
  const rowHeight = columnWidth * 1.35; // Mantener aspect ratio

  // ⚡ OPTIMIZACIÓN: `itemData` se memoiza con `useMemo`.
  // `react-window` compara superficialmente este objeto. Si no se memoiza,
  // se crea un nuevo objeto en cada render, forzando un re-render de todas
  // las celdas visibles, anulando el beneficio de la virtualización.
  const itemData = useMemo(() => ({
    items: data,
    columnCount,
    getSubtitle,
    onClick,
    currentView,
  }), [data, columnCount, getSubtitle, onClick, currentView]);

  return (
    <div ref={gridRef} style={{ width: '100%', height: '100%' }}>
      {height > 0 && width > 0 && (
        <FixedSizeGrid
          columnCount={columnCount}
          columnWidth={columnWidth}
          height={height}
          rowCount={rowCount}
          rowHeight={rowHeight}
          width={width}
          itemData={itemData}
          overscanCount={5} // ⚡ OPTIMIZACIÓN: Renderiza filas/columnas extra para mejorar la percepción de fluidez al hacer scroll.
        >
          {Cell}
        </FixedSizeGrid>
      )}
    </div>
  );
}