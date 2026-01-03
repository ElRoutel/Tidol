import React, { useState, useEffect, useRef } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import LibraryItem from './LibraryItem';
import favImage from '../assets/favImage.jpg';

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

const VirtualGrid = ({ data, getSubtitle, onClick, currentView, columnWidth = 180, rowHeight = 240 }) => {
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

  const columnCount = Math.max(1, Math.floor(size.width / columnWidth));
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
      {size.width > 0 && size.height > 0 && (
        <Grid
          height={size.height}
          width={size.width}
          columnCount={columnCount}
          columnWidth={columnWidth}
          rowCount={rowCount}
          rowHeight={rowHeight}
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
