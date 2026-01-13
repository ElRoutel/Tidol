import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import LibraryItem from './LibraryItem';
import favImage from '../pages/favImage.jpg';

const ROW_TEXT_CONTENT_HEIGHT = 64; // Corresponds to h-16 in Tailwind
const GAP = 16; // Corresponds to gap-4 in Tailwind, or 1rem

// Helper function to get responsive gap
const getResponsiveGap = (width) => {
  if (width < 640) return 8; // sm
  return 16; // md and up
};

// The Cell component is memoized and defined outside of VirtualGrid
// to prevent it from being recreated on every render.
const Cell = React.memo(({ data, rowIndex, columnIndex, style }) => {
  const {
    items,
    getSubtitle,
    onClick,
    currentView,
    columnCount,
    gap,
  } = data;
  const index = rowIndex * columnCount + columnIndex;

  if (index >= items.length) {
    return null;
  }
  const item = items[index];

  // Prepare props for LibraryItem
  const title = item.titulo || item.title || item.nombre || "Sin título";
  const subtitle = getSubtitle(item);
  const image = item.portada || item.cover_url || favImage;
  const type = currentView === "playlists" ? "playlist" : "song";

  // Adjust style to create gap between items
  const newStyle = {
    ...style,
    left: style.left + gap,
    top: style.top + gap,
    width: style.width - gap,
    height: style.height - gap,
  };

  return (
    <div style={newStyle}>
      <LibraryItem
        title={title}
        subtitle={subtitle}
        image={image}
        viewMode="grid"
        item={item}
        type={type}
        onClick={() => onClick(item, index)}
      />
    </div>
  );
});
Cell.displayName = 'GridCell'; // Add display name for better debugging

const VirtualGrid = ({ data, getSubtitle, onClick, currentView }) => {
  const containerRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const resizeObserver = new ResizeObserver(entries => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        setSize({ width, height });
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
  }, []);

  const { width, height } = size;
  const gap = getResponsiveGap(width);

  // Calculate column and item dimensions
  const columnWidth = 150; // A base width for each item
  const columnCount = Math.max(1, Math.floor(width / (columnWidth + gap)));
  const itemWidth = Math.floor((width - (columnCount + 1) * gap) / columnCount);
  const rowHeight = itemWidth + ROW_TEXT_CONTENT_HEIGHT;
  const rowCount = Math.ceil(data.length / columnCount);

  // Memoize itemData to prevent re-renders
  const itemData = useMemo(() => ({
    items: data,
    getSubtitle,
    onClick,
    currentView,
    columnCount,
    gap,
  }), [data, getSubtitle, onClick, currentView, columnCount, gap]);

  return (
    <div ref={containerRef} style={{ height: '100%', width: '100%' }}>
      {width > 0 && height > 0 && (
        <Grid
          height={height}
          width={width}
          columnCount={columnCount}
          columnWidth={itemWidth}
          rowCount={rowCount}
          rowHeight={rowHeight}
          itemData={itemData}
          overscanCount={5}
        >
          {Cell}
        </Grid>
      )}
    </div>
  );
};

export default VirtualGrid;