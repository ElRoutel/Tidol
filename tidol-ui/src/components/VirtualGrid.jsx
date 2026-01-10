import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import LibraryItem from './LibraryItem';
import favImage from '../pages/favImage.jpg';

// Optimal item width and gap for grid layout
const ITEM_WIDTH = 160;
const GAP = 16;

// Memoized cell renderer to prevent re-renders of individual items
const Cell = React.memo(({ columnIndex, rowIndex, style, data }) => {
    const { items, columnCount, getSubtitle, onClick, currentView } = data;
    const index = rowIndex * columnCount + columnIndex;
    const item = items[index];

    if (!item) return null;

    const title = item.titulo || item.title || item.nombre || "Sin título";
    const subtitle = getSubtitle(item);
    const image = item.portada || item.cover_url || favImage;
    const type = currentView === "playlists" ? "playlist" : "song";

    // Adjust style to create gaps between items
    const newStyle = {
        ...style,
        left: style.left + GAP / 2,
        top: style.top + GAP / 2,
        width: style.width - GAP,
        height: style.height - GAP,
    };

    return (
        <div style={newStyle}>
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

    const { columnCount, columnWidth, rowCount } = useMemo(() => {
        if (size.width === 0) return { columnCount: 0, columnWidth: 0, rowCount: 0 };

        const numColumns = Math.max(1, Math.floor(size.width / (ITEM_WIDTH + GAP)));
        const colWidth = Math.floor(size.width / numColumns);
        const numRows = Math.ceil(data.length / numColumns);

        return {
            columnCount: numColumns,
            columnWidth: colWidth,
            rowCount: numRows,
        };
    }, [size.width, data.length]);

    const itemData = useMemo(() => ({
        items: data,
        columnCount,
        getSubtitle,
        onClick,
        currentView,
    }), [data, columnCount, getSubtitle, onClick, currentView]);

    return (
        <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
            {size.height > 0 && columnCount > 0 && (
                <Grid
                    height={size.height}
                    width={size.width}
                    columnCount={columnCount}
                    columnWidth={columnWidth}
                    rowCount={rowCount}
                    rowHeight={240} // Approximate height for a grid item
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
