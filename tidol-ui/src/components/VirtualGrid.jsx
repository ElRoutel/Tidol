import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import LibraryItem from './LibraryItem';
import favImage from '../pages/favImage.jpg';

// This height is an estimate of the text content below the image in a grid item.
// It's based on the CSS properties of .lib-item-info (padding, font-sizes, margins).
// Using a constant makes it easier to adjust if the styling changes.
const ROW_TEXT_CONTENT_HEIGHT = 72;
const ITEM_MIN_WIDTH = 160;

// This function mirrors the responsive gap defined in Library.css.
// This is better than a single hardcoded value and avoids complex CSS parsing.
const getResponsiveGap = (containerWidth) => {
  if (containerWidth <= 600) return 16; // 1rem for mobile
  if (containerWidth <= 900) return 24; // 1.5rem for tablet
  return 32; // 2rem for desktop
};

const Cell = React.memo(({ columnIndex, rowIndex, style, data }) => {
  const { items, getSubtitle, onClick, currentView, columnCount, gap } = data;
  const index = rowIndex * columnCount + columnIndex;
  const item = items[index];

  if (!item) return null;

  const title = item.titulo || item.title || item.nombre || "Sin título";
  const subtitle = getSubtitle(item);
  const image = item.portada || item.cover_url || favImage;
  const type = currentView === "playlists" ? "playlist" : "song";

  // Adjust style to create gaps between items
  const newStyle = {
    ...style,
    left: style.left + gap / 2,
    top: style.top + gap / 2,
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

  const { columnCount, columnWidth, rowCount, rowHeight, gap } = useMemo(() => {
    if (size.width === 0) return { columnCount: 0, columnWidth: 0, rowCount: 0, rowHeight: 0, gap: 16 };

    const currentGap = getResponsiveGap(size.width);
    const count = Math.floor(size.width / (ITEM_MIN_WIDTH + currentGap));

    // Guard against division by zero
    if (count === 0) return { columnCount: 0, columnWidth: 0, rowCount: 0, rowHeight: 0, gap: currentGap };

    const width = Math.floor(size.width / count);
    const height = width + ROW_TEXT_CONTENT_HEIGHT;
    const numRows = Math.ceil(data.length / count);

    return {
      columnCount: count,
      columnWidth: width,
      rowCount: numRows,
      rowHeight: height,
      gap: currentGap
    };
  }, [size.width, data.length]);

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
      {size.height > 0 && columnCount > 0 && (
        <Grid
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
