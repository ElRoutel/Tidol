import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import LibraryItem from './LibraryItem';
import favImage from '../pages/favImage.jpg';

const ROW_TEXT_CONTENT_HEIGHT = 60; // Approximate height for title, subtitle
const GAP = 16; // Corresponds to Tailwind's `gap-4`

// Memoized Cell component to prevent re-renders
const Cell = React.memo(({ columnIndex, rowIndex, style, data }) => {
  const { items, getSubtitle, onClick, currentView, columnCount } = data;
  const index = rowIndex * columnCount + columnIndex;
  const item = items[index];

  if (!item) return null;

  const title = item.titulo || item.title || item.nombre || "Sin título";
  const subtitle = getSubtitle(item);
  const image = item.portada || item.cover_url || favImage;
  const type = currentView === "playlists" ? "playlist" : "song";

  // Adjust style to create gap between items
  const newStyle = {
    ...style,
    left: style.left + GAP / 2,
    top: style.top + GAP / 2,
    width: style.width - GAP,
    height: style.height - GAP,
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
Cell.displayName = 'GridCell';

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

// Calculate column count based on container width to mimic Tailwind's breakpoints
  const getColumnCount = (width) => {
    if (width < 640) return 2; // sm
    if (width < 768) return 3; // md
    if (width < 1024) return 4; // lg
    if (width < 1280) return 5; // xl
    return 6; // 2xl
  };

  const columnCount = size.width > 0 ? getColumnCount(size.width) : 0;
  const columnWidth = columnCount > 0 ? size.width / columnCount : 0;
  const rowHeight = columnWidth + ROW_TEXT_CONTENT_HEIGHT;
  const rowCount = columnCount > 0 ? Math.ceil(data.length / columnCount) : 0;

  const itemData = useMemo(() => ({
    items: data,
    getSubtitle,
    onClick,
    currentView,
    columnCount,
  }), [data, getSubtitle, onClick, currentView, columnCount]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      {size.height > 0 && columnCount > 0 && (
        <Grid
          className="virtual-grid"
          height={size.height}
          width={size.width}
          columnCount={columnCount}
          columnWidth={columnWidth}
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
