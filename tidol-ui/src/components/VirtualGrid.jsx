import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import LibraryItem from './LibraryItem';
import favImage from '../assets/favImage.jpg';

// Cell component is memoized to prevent re-renders
const Cell = React.memo(({ data, columnIndex, rowIndex, style }) => {
    const { items, getSubtitle, onClick, currentView, columnCount } = data;
    const index = rowIndex * columnCount + columnIndex;
    const item = items[index];

    // Ensure we don't render an item that doesn't exist
    if (!item) return null;

    const title = item.titulo || item.title || item.nombre || "Sin título";
    const subtitle = getSubtitle(item);
    const image = item.portada || item.cover_url || favImage;
    const type = currentView === "playlists" ? "playlist" : "song";

    // Adjust the style to create gaps between grid items
    const styleWithGap = {
        ...style,
        left: style.left + 8,
        top: style.top + 8,
        width: style.width - 16,
        height: style.height - 16,
    };

    return (
        <div style={styleWithGap}>
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
Cell.displayName = 'GridCell'; // For better debugging in React DevTools

const VirtualGrid = ({ data, getSubtitle, onClick, currentView }) => {
    const containerRef = useRef(null);
    const [size, setSize] = useState({ width: 0, height: 0 });
    const [columnCount, setColumnCount] = useState(1);

    // Using a ResizeObserver to make the grid responsive
    useEffect(() => {
        const resizeObserver = new ResizeObserver(entries => {
            if (entries[0]) {
                const { width, height } = entries[0].contentRect;
                setSize({ width, height });

                // Simple logic to determine column count based on width
                // This can be adjusted based on desired item size
                const newColumnCount = Math.floor(width / 180); // Assuming ~180px item width
                setColumnCount(newColumnCount > 0 ? newColumnCount : 1);
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
    const itemWidth = columnCount > 0 ? size.width / columnCount : 0;
    const itemHeight = itemWidth * 1.35; // Maintain aspect ratio

    const itemData = useMemo(() => ({
        items: data,
        getSubtitle,
        onClick,
        currentView,
        columnCount,
    }), [data, getSubtitle, onClick, currentView, columnCount]);

    return (
        <div ref={containerRef} style={{ height: '100%', width: '100%' }}>
            {size.height > 0 && size.width > 0 && (
                <Grid
                    height={size.height}
                    width={size.width}
                    columnCount={columnCount}
                    rowCount={rowCount}
                    columnWidth={itemWidth}
                    rowHeight={itemHeight}
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
