import React, { useState, useEffect, useRef } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import LibraryItem from './LibraryItem';
import favImage from '../pages/favImage.jpg';

const ROW_TEXT_CONTENT_HEIGHT = 64;
const GRID_GAP = 16;

// The Cell component is memoized to prevent re-renders.
const Cell = React.memo(({ data, rowIndex, columnIndex, style }) => {
  const { items, getSubtitle, onClick, currentView, columnCount } = data;
  const index = rowIndex * columnCount + columnIndex;

  if (index >= items.length) {
    return null; // Don't render anything if the index is out of bounds
  }

  const item = items[index];
  const title = item.titulo || item.title || item.nombre || "Sin título";
  const subtitle = getSubtitle(item);
  const image = item.portada || item.cover_url || favImage;
  const type = currentView === "playlists" ? "playlist" : "song";

  return (
    <div style={style} className="p-2">
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

const VirtualGrid = ({ data, getSubtitle, onClick, currentView }) => {
  const containerRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [columnCount, setColumnCount] = useState(1);
  const [rowHeight, setRowHeight] = useState(200);

  // Dynamically adjust the grid dimensions on container resize.
  useEffect(() => {
    const resizeObserver = new ResizeObserver(entries => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        setSize({ width, height });

        // Ensure newColumnCount is at least 1 to avoid division by zero
        const newColumnCount = Math.max(1, Math.floor(width / 160));
        setColumnCount(newColumnCount);

        const imageHeight = (width / newColumnCount) - GRID_GAP;
        setRowHeight(imageHeight + ROW_TEXT_CONTENT_HEIGHT);
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
  }, []); // Empty dependency array ensures this runs only once on mount

  const rowCount = Math.ceil(data.length / columnCount);
  const itemData = {
    items: data,
    getSubtitle,
    onClick,
    currentView,
    columnCount,
  };

  return (
    <div ref={containerRef} style={{ height: '100%', width: '100%' }}>
      {size.height > 0 && size.width > 0 && (
        <Grid
          height={size.height}
          width={size.width}
          columnCount={columnCount}
          rowCount={rowCount}
          columnWidth={size.width / columnCount}
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
