import React, { useState, useEffect, useRef } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import LibraryItem from './LibraryItem';
import favImage from '../pages/favImage.jpg';

const ROW_TEXT_CONTENT_HEIGHT = 64; // Corresponds to Tailwind's h-16
const MIN_ITEM_WIDTH = 180;
const ITEM_GAP = 16; // Corresponds to Tailwind's gap-4 (1rem)

// The Cell component is memoized to prevent re-renders.
// It's defined outside VirtualGrid to avoid being recreated on every render.
const Cell = React.memo(({ data, rowIndex, columnIndex, style }) => {
    const { items, getSubtitle, onClick, currentView, columnCount } = data;
    const index = rowIndex * columnCount + columnIndex;

    // Do not render anything if the index is out of bounds.
    // This can happen if the last row is not completely filled.
    if (index >= items.length) {
        return null;
    }

    const item = items[index];
    const title = item.titulo || item.title || item.nombre || "Sin título";
    const subtitle = getSubtitle(item);
    const image = item.portada || item.cover_url || favImage;
    const type = currentView === "playlists" ? "playlist" : "song";

    // Adjust the style from react-window to implement the gap correctly.
    // This creates space *between* items without adding unwanted padding to the grid's outer edges.
    const cellStyle = {
        ...style,
        left: style.left + ITEM_GAP / 2,
        top: style.top + ITEM_GAP / 2,
        width: style.width - ITEM_GAP,
        height: style.height - ITEM_GAP,
    };

    return (
        <div style={cellStyle}>
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

    // Use a ResizeObserver to dynamically update grid dimensions.
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

    // Guard against rendering with zero dimensions, which causes react-window to crash.
    if (size.width === 0 || size.height === 0) {
        return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
    }

    // Calculate column and row dimensions based on container size.
    const columnCount = Math.max(1, Math.floor(size.width / MIN_ITEM_WIDTH));
    const columnWidth = size.width / columnCount;
    // Calculate row height based on the aspect ratio of the item image (1:1) and text content.
    const rowHeight = (columnWidth - ITEM_GAP) + ROW_TEXT_CONTENT_HEIGHT;
    const rowCount = Math.ceil(data.length / columnCount);

    const itemData = {
        items: data,
        getSubtitle,
        onClick,
        currentView,
        columnCount,
    };

    return (
        <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
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
        </div>
    );
};

export default VirtualGrid;