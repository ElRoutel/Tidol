import React, { useState, useEffect, useRef } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import LibraryItem from './LibraryItem';
import favImage from '../pages/favImage.jpg';

const Cell = React.memo(({ data, columnIndex, rowIndex, style }) => {
  const { items, getSubtitle, onClick, currentView, columnCount } = data;
  const index = rowIndex * columnCount + columnIndex;
  const item = items[index];

  if (!item) return null;

  const title = item.titulo || item.title || item.nombre || "Sin título";
  const subtitle = getSubtitle(item);
  const image = item.portada || item.cover_url || favImage;
  const type = currentView === "playlists" ? "playlist" : "song";

  return (
    <div style={{ ...style, padding: '0.5rem' }}>
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

const VirtualGrid = ({ data, getSubtitle, onClick, currentView, itemWidth = 180, itemHeight = 240 }) => {
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

  const columnCount = Math.floor(dimensions.width / itemWidth) || 1;
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
      {dimensions.height > 0 && (
        <Grid
          height={dimensions.height}
          width={dimensions.width}
          columnCount={columnCount}
          rowCount={rowCount}
          columnWidth={itemWidth}
          rowHeight={itemHeight}
          overscanCount={5}
          itemData={itemData}
        >
          {Cell}
        </Grid>
      )}
    </div>
  );
};

export default VirtualGrid;
