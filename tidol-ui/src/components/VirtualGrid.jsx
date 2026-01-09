import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import LibraryItem from './LibraryItem';
import favImage from '../assets/favImage.jpg';

// =================================================================================================
// RESPONSIVE LOGIC & CONSTANTS
// =================================================================================================

// We define constants for item dimensions to avoid "magic numbers"
// and make the component easier to maintain.
const ITEM_MIN_WIDTH = 160; // Minimum width for a grid item in pixels
const ITEM_ASPECT_RATIO = 1.25; // Aspect ratio for height calculation (height = width * ratio)
const ROW_TEXT_CONTENT_HEIGHT = 64; // Estimated height for title and subtitle

// This function calculates the gap between grid items based on the container width.
// It mirrors CSS logic (e.g., Tailwind's responsive breakpoints) in JavaScript,
// ensuring the virtualized layout remains consistent with the rest of the app's design.
const getResponsiveGap = (containerWidth) => {
  if (containerWidth < 640) return 8; // Corresponds to Tailwind's 'sm' breakpoint, gap-2
  if (containerWidth < 1024) return 12; // Corresponds to 'md' breakpoint, gap-3
  return 16; // Corresponds to 'lg' and larger, gap-4
};

// =================================================================================================
// MEMOIZED CELL COMPONENT
// =================================================================================================

// The Cell component is memoized and defined outside VirtualGrid.
// This is a critical performance optimization that prevents the cell from
// re-rendering every time the parent component (VirtualGrid) re-renders.
// Without React.memo, virtualization would offer little to no benefit.
const Cell = ({ data, columnIndex, rowIndex, style }) => {
  const { items, columnCount, getSubtitle, onClick, currentView } = data;

  // Calculate the index of the item in the 1D data array based on its 2D grid position.
  const index = rowIndex * columnCount + columnIndex;
  if (index >= items.length) {
    return null; // Don't render anything if the index is out of bounds.
  }

  const item = items[index];

  // Prepare props for LibraryItem to ensure consistency between grid and list views.
  const title = item.titulo || item.title || item.nombre || "Sin título";
  const subtitle = getSubtitle(item);
  const image = item.portada || item.cover_url || favImage;
  const type = currentView === "playlists" ? "playlist" : "song";

  // To create a gap between items, we adjust the style properties passed by react-window.
  // We reduce the item's width and height by the gap size and offset its position.
  // This is a standard technique for adding gaps to virtualized grids.
  const gap = getResponsiveGap(data.containerWidth);
  const adjustedStyle = {
    ...style,
    width: style.width - gap,
    height: style.height - gap,
    left: style.left + gap / 2,
    top: style.top + gap / 2,
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
};
Cell.displayName = 'GridCell'; // Adding a displayName is good practice for debugging with React DevTools.

// =================================================================================================
// VIRTUAL GRID COMPONENT
// =================================================================================================

const VirtualGrid = ({ data, getSubtitle, onClick, currentView }) => {
  const containerRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  // A ResizeObserver is used to dynamically update the grid's dimensions
  // whenever the container element changes size. This ensures the grid is
  // fully responsive. The effect runs only once on mount.
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

  // Calculate grid layout properties based on the container's current size.
  const { columnCount, columnWidth, rowCount, rowHeight } = useMemo(() => {
    const width = size.width;
    if (width === 0) {
      return { columnCount: 0, columnWidth: 0, rowCount: 0, rowHeight: 0 };
    }

    const gap = getResponsiveGap(width);
    const numColumns = Math.max(1, Math.floor((width - gap) / (ITEM_MIN_WIDTH + gap)));
    const colWidth = Math.floor((width - gap) / numColumns);
    const numRows = Math.ceil(data.length / numColumns);
    const rHeight = colWidth * ITEM_ASPECT_RATIO + ROW_TEXT_CONTENT_HEIGHT;

    return {
      columnCount: numColumns,
      columnWidth: colWidth,
      rowCount: numRows,
      rowHeight: rHeight
    };
  }, [size.width, data.length]);

  // The 'itemData' prop is memoized with useMemo. This is another critical optimization.
  // It ensures that the object containing the props for the Cell component is not
  // recreated on every render, which would otherwise cause all visible cells to re-render.
  const itemData = useMemo(() => ({
    items: data,
    columnCount,
    getSubtitle,
    onClick,
    currentView,
    containerWidth: size.width
  }), [data, columnCount, getSubtitle, onClick, currentView, size.width]);

  return (
    <div ref={containerRef} style={{ height: '100%', width: '100%' }}>
      {/* We only render the Grid when we have valid dimensions to avoid errors. */}
      {size.width > 0 && size.height > 0 && columnCount > 0 && (
        <Grid
          className="virtual-grid"
          height={size.height}
          width={size.width}
          columnCount={columnCount}
          columnWidth={columnWidth}
          rowCount={rowCount}
          rowHeight={rowHeight}
          itemData={itemData}
          overscanCount={5} // Overscan improves perceived scrolling performance.
        >
          {Cell}
        </Grid>
      )}
    </div>
  );
};

export default VirtualGrid;
