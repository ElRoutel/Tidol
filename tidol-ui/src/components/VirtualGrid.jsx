import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import LibraryItem from './LibraryItem';
import favImage from '../assets/favImage.jpg';

const ROW_TEXT_CONTENT_HEIGHT = 65;
const getResponsiveGap = (width) => (width < 600 ? 8 : 16);

const Cell = React.memo(({ data, rowIndex, columnIndex, style }) => {
  const { items, getSubtitle, onClick, columnCount, containerWidth } = data;
  const index = rowIndex * columnCount + columnIndex;

  if (index >= items.length) {
    return null;
  }

  const item = items[index];
  const title = item.titulo || item.title || item.nombre || "Sin título";
  const subtitle = getSubtitle(item);
  const image = item.portada || item.cover_url || favImage;

  const gap = getResponsiveGap(containerWidth);
  const adjustedStyle = {
    ...style,
    width: style.width - gap,
    height: style.height - gap,
    top: style.top + gap / 2,
    left: style.left + gap / 2,
  };

  return (
    <div style={adjustedStyle}>
      <LibraryItem
        title={title}
        subtitle={subtitle}
        image={image}
        viewMode="grid"
        item={item}
        type={item.type || 'song'}
        onClick={() => onClick(item, index)}
      />
    </div>
  );
});
Cell.displayName = 'GridCell';

const VirtualGrid = ({ data, getSubtitle, onClick }) => {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        setDimensions({ width, height });
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current);
      }
    };
  }, []);

  const { columnCount, columnWidth, rowHeight } = useMemo(() => {
    if (dimensions.width === 0) {
      return { columnCount: 0, columnWidth: 0, rowHeight: 0 };
    }

    const gap = getResponsiveGap(dimensions.width);
    const minWidth = 150;
    const colCount = Math.floor((dimensions.width - gap) / (minWidth + gap)) || 1;
    const colWidth = Math.floor((dimensions.width - gap) / colCount);

    return {
      columnCount: colCount,
      columnWidth: colWidth,
      rowHeight: colWidth + ROW_TEXT_CONTENT_HEIGHT
    };
  }, [dimensions.width]);

  const rowCount = columnCount > 0 ? Math.ceil(data.length / columnCount) : 0;

  const itemData = useMemo(() => ({
    items: data,
    getSubtitle,
    onClick,
    columnCount,
    containerWidth: dimensions.width
  }), [data, getSubtitle, onClick, columnCount, dimensions.width]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      {dimensions.height > 0 && columnCount > 0 && (
        <Grid
          height={dimensions.height}
          width={dimensions.width}
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