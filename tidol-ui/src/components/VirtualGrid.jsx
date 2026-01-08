import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import LibraryItem from './LibraryItem';
import favImage from '../pages/favImage.jpg';

const ROW_TEXT_CONTENT_HEIGHT = 60; // 60px allocated for text content
const getResponsiveGap = (width) => (width < 600 ? 8 : 16);

// Memoized cell component to prevent re-renders
const Cell = React.memo(({ columnIndex, rowIndex, style, data }) => {
  const { items, getSubtitle, onClick, currentView, columnCount, containerWidth } = data;
  const index = rowIndex * columnCount + columnIndex;

  if (index >= items.length) {
    return null; // Do not render anything if the index is out of bounds
  }
  const item = items[index];

  // Prepare props for LibraryItem
  const title = item.titulo || item.title || item.nombre || "Sin título";
  const subtitle = getSubtitle(item);
  const image = item.portada || item.cover_url || favImage;
  const type = currentView === "playlists" ? "playlist" : "song";

  // Adjust style to create gaps between items
  const gap = getResponsiveGap(containerWidth);
  const adjustedStyle = {
    ...style,
    left: style.left + gap,
    top: style.top + gap,
    width: style.width - gap,
    height: style.height - gap,
  };

  return (
    <div style={adjustedStyle}>
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
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const resizeObserver = new ResizeObserver(entries => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        setDimensions({ width, height });
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

  const { columnCount, columnWidth, rowCount, rowHeight } = useMemo(() => {
    if (dimensions.width === 0) {
      return { columnCount: 0, columnWidth: 0, rowCount: 0, rowHeight: 0 };
    }
    const gap = getResponsiveGap(dimensions.width);
    const calculatedColumnCount = Math.floor((dimensions.width - gap) / (150 + gap));
    const safeColumnCount = Math.max(1, calculatedColumnCount); // Ensure at least one column
    const calculatedColumnWidth = (dimensions.width - gap) / safeColumnCount;

    const calculatedRowHeight = calculatedColumnWidth + ROW_TEXT_CONTENT_HEIGHT;
    const calculatedRowCount = Math.ceil(data.length / safeColumnCount);

    return {
      columnCount: safeColumnCount,
      columnWidth: calculatedColumnWidth,
      rowCount: calculatedRowCount,
      rowHeight: calculatedRowHeight,
    };
  }, [dimensions.width, data.length]);

  const itemData = useMemo(() => ({
    items: data,
    getSubtitle,
    onClick,
    currentView,
    columnCount,
    containerWidth: dimensions.width,
  }), [data, getSubtitle, onClick, currentView, columnCount, dimensions.width]);

  return (
    <div ref={containerRef} style={{ height: '100%', width: '100%' }}>
      {dimensions.height > 0 && dimensions.width > 0 && (
        <Grid
          className="virtual-grid"
          columnCount={columnCount}
          columnWidth={columnWidth}
          height={dimensions.height}
          rowCount={rowCount}
          rowHeight={rowHeight}
          width={dimensions.width}
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
