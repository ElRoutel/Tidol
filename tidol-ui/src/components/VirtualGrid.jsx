import React, { useState, useEffect, useRef } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import LibraryItem from './LibraryItem';
import favImage from '../pages/favImage.jpg';

// The Cell component is memoized and defined outside of VirtualGrid
// to prevent it from being recreated on every render.
const Cell = React.memo(({ data, rowIndex, columnIndex, style }) => {
  const { items, getSubtitle, onClick, currentView, columnCount } = data;
  const index = rowIndex * columnCount + columnIndex;

  // Do not render anything if the index is out of bounds
  if (index >= items.length) {
    return null;
  }

  const item = items[index];
  const title = item.titulo || item.title || item.nombre || "Sin título";
  const subtitle = getSubtitle(item);
  const image = item.portada || item.cover_url || favImage;
  const type = currentView === "playlists" ? "playlist" : "song";

  return (
    <div style={style} className="px-2">
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

  // This effect sets up a ResizeObserver to dynamically update the grid dimensions
  // and column count based on the container's size. This is crucial for creating
  // a responsive grid that adapts to different screen sizes without performance loss.
  useEffect(() => {
    const resizeObserver = new ResizeObserver(entries => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        setSize({ width, height });

        // Responsive column calculation:
        // Adjusts the number of columns based on the container width.
        // This logic ensures the grid looks good on both mobile and desktop.
        if (width < 480) setColumnCount(2);
        else if (width < 768) setColumnCount(3);
        else if (width < 1024) setColumnCount(4);
        else if (width < 1280) setColumnCount(5);
        else setColumnCount(6);
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

  // itemData is passed to the Cell component, containing all necessary props.
  // This avoids re-creating the function on every render.
  const itemData = {
    items: data,
    getSubtitle,
    onClick,
    currentView,
    columnCount,
  };

  const columnWidth = size.width / columnCount;
  // Dynamic row height based on column width to maintain aspect ratio
  const rowHeight = columnWidth * 1.4;
  const rowCount = Math.ceil(data.length / columnCount);

  return (
    <div ref={containerRef} style={{ height: '100%', width: '100%' }}>
      {size.height > 0 && (
        <Grid
          height={size.height}
          width={size.width}
          columnCount={columnCount}
          columnWidth={columnWidth}
          rowCount={rowCount}
          rowHeight={rowHeight}
          itemCount={data.length}
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