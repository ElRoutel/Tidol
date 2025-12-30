import React, { useState, useEffect, useRef } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import LibraryItem from './LibraryItem';
import favImage from '../pages/favImage.jpg';

const Cell = React.memo(({ columnIndex, rowIndex, style, data }) => {
  const { items, getSubtitle, onClick, currentView, columnCount } = data;
  const index = rowIndex * columnCount + columnIndex;

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

const VirtualGrid = ({ data, getSubtitle, onClick, currentView, itemWidth = 180, itemHeight = 240 }) => {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0, columnCount: 0 });

  useEffect(() => {
    const resizeObserver = new ResizeObserver(entries => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        const columnCount = Math.floor(width / itemWidth);
        setDimensions({ width, height, columnCount });
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
  }, [itemWidth]);

  const itemData = {
    items: data,
    getSubtitle,
    onClick,
    currentView,
    columnCount: dimensions.columnCount,
  };

  const rowCount = Math.ceil(data.length / dimensions.columnCount);

  return (
    <div ref={containerRef} style={{ height: '100%', width: '100%' }}>
      {dimensions.height > 0 && dimensions.columnCount > 0 && (
        <Grid
          height={dimensions.height}
          width={dimensions.width}
          columnCount={dimensions.columnCount}
          columnWidth={itemWidth}
          rowCount={rowCount}
          rowHeight={itemHeight}
          itemData={itemData}
          overscanCount={2}
        >
          {Cell}
        </Grid>
      )}
    </div>
  );
};

export default VirtualGrid;