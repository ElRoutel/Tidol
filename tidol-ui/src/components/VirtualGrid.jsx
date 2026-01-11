import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import LibraryItem from './LibraryItem';
import favImage from '../pages/favImage.jpg';

// =============================================================================
// Constants and Style Calculations
// =============================================================================

const ITEM_WIDTH = 180;
const ITEM_HEIGHT = 240;
const GAP = 16; // 1rem, consistent with Tailwind's gap-4

// =============================================================================
// Cell Component
// =============================================================================

// The Cell component is memoized and defined outside of VirtualGrid to prevent
// it from being recreated on every render. This is a critical performance optimization.
const Cell = React.memo(({ data, rowIndex, columnIndex, style }) => {
  const { items, getSubtitle, onClick, currentView, columnCount } = data;
  const index = rowIndex * columnCount + columnIndex;

  // If the index is out of bounds, render nothing. This can happen with the last row.
  if (index >= items.length) {
    return null;
  }

  const item = items[index];
  const title = item.titulo || item.title || item.nombre || "Sin título";
  const subtitle = getSubtitle(item);
  const image = item.portada || item.cover_url || favImage;
  const type = currentView === "playlists" ? "playlist" : "song";

  // This style manipulation creates the gap between items without adding
  // padding to the container edges, which would misalign the grid.
  const styleWithGap = {
    ...style,
    left: style.left + GAP / 2,
    top: style.top + GAP / 2,
    width: style.width - GAP,
    height: style.height - GAP,
  };

  return (
    <div style={styleWithGap}>
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
Cell.displayName = 'GridCell'; // For better debugging in React DevTools

// =============================================================================
// VirtualGrid Component
// =============================================================================

const VirtualGrid = ({ data, getSubtitle, onClick, currentView }) => {
  const containerRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  // Set up a ResizeObserver to dynamically adjust the grid size.
  // This is crucial for a responsive layout.
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
  }, []); // Empty dependency array ensures this runs only once on mount.

  // Calculate grid dimensions based on container size
  const columnCount = size.width > 0 ? Math.floor(size.width / (ITEM_WIDTH + GAP / 2)) : 0;
  const rowCount = columnCount > 0 ? Math.ceil(data.length / columnCount) : 0;

  // Memoize itemData to prevent re-renders of the Cell component.
  // This is a key optimization for react-window.
  const itemData = useMemo(() => ({
    items: data,
    getSubtitle,
    onClick,
    currentView,
    columnCount,
  }), [data, getSubtitle, onClick, currentView, columnCount]);

  return (
    <div ref={containerRef} style={{ height: '100%', width: '100%' }}>
      {size.height > 0 && columnCount > 0 && (
        <Grid
          height={size.height}
          width={size.width}
          columnCount={columnCount}
          rowCount={rowCount}
          columnWidth={size.width / columnCount}
          rowHeight={ITEM_HEIGHT}
          itemData={itemData}
          overscanCount={5} // Consistent with VirtualSongList
        >
          {Cell}
        </Grid>
      )}
    </div>
  );
};

export default VirtualGrid;