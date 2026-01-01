import React, { useState, useEffect, useRef } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import LibraryItem from './LibraryItem';
import favImage from '../pages/favImage.jpg';

// The Cell component is memoized and defined outside to prevent re-creation on renders.
const ROW_TEXT_CONTENT_HEIGHT = 60; // Approx height for title and subtitle

const Cell = React.memo(({ data, rowIndex, columnIndex, style }) => {
  const { items, getSubtitle, onClick, currentView, columnCount } = data;
  const index = rowIndex * columnCount + columnIndex;

  // Ensure we don't render an item that doesn't exist
  if (index >= items.length) {
    return null;
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
  const [columnCount, setColumnCount] = useState(3);
  const [itemWidth, setItemWidth] = useState(150);

  // Dynamically adjust grid size and columns based on container size
  useEffect(() => {
    const resizeObserver = new ResizeObserver(entries => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        setSize({ width, height });

        // Simple logic to determine column count based on width
        const newItemWidth = width / Math.max(2, Math.floor(width / 150));
        setItemWidth(newItemWidth);
        setColumnCount(Math.floor(width / newItemWidth));
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

  const rowCount = Math.ceil(data.length / columnCount);

  // Pass necessary props to the Cell component
  const itemData = {
    items: data,
    getSubtitle,
    onClick,
    currentView,
    columnCount,
  };

  return (
    <div ref={containerRef} style={{ height: '100%', width: '100%' }}>
      {size.width > 0 && size.height > 0 && (
        <Grid
          height={size.height}
          width={size.width}
          columnCount={columnCount}
          rowCount={rowCount}
          columnWidth={itemWidth}
          rowHeight={itemWidth + ROW_TEXT_CONTENT_HEIGHT} // Adjust based on LibraryItem's grid height
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
