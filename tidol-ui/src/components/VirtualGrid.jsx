import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import LibraryItem from './LibraryItem';
import favImage from '../pages/favImage.jpg';

// =================================================================================================
// PERFORMANCE OPTIMIZATION: VIRTUALIZED GRID
// This component uses `react-window` to render a virtualized grid.
// Why? To efficiently display thousands of items without performance degradation.
// It only mounts and renders the items visible in the viewport, plus a small buffer
// (`overscanCount`), keeping the DOM light and the UI responsive.
// =================================================================================================

// Magic Numbers Explained:
// These constants are derived from the styling of `LibraryItem.jsx` in grid mode.
// Changing the item's CSS may require adjusting these values.
const ROW_TEXT_CONTENT_HEIGHT = 68; // Height of the text content below the image in a grid item.
const ITEM_TARGET_WIDTH = 180;      // The ideal width of a grid item for responsive calculations.

const getResponsiveGap = (width) => {
    if (width < 640) return 8;
    return 16;
};

const Cell = React.memo(({ data, rowIndex, columnIndex, style }) => {
    const { items, getSubtitle, onClick, currentView, columnCount, containerWidth } = data;
    const index = rowIndex * columnCount + columnIndex;

    if (index >= items.length) {
        return null;
    }

    const item = items[index];
    const title = item.titulo || item.title || item.nombre || "Sin título";
    const subtitle = getSubtitle(item);
    const image = item.portada || item.cover_url || favImage;
    const type = currentView === "playlists" ? "playlist" : "song";

    const gap = getResponsiveGap(containerWidth);
    const styleWithGap = {
        ...style,
        left: style.left + gap / 2,
        top: style.top + gap / 2,
        width: style.width - gap,
        height: style.height - gap,
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
Cell.displayName = 'GridCell';

const VirtualGrid = ({ data, getSubtitle, onClick, currentView }) => {
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

    if (!Array.isArray(data)) {
        return null;
    }

    const { width, height } = dimensions;

    const columnCount = width > 0 ? Math.max(1, Math.floor(width / ITEM_TARGET_WIDTH)) : 1;
    const columnWidth = width > 0 ? width / columnCount : 0;
    const rowCount = data.length > 0 ? Math.ceil(data.length / columnCount) : 0;
    const rowHeight = columnWidth + ROW_TEXT_CONTENT_HEIGHT;

    const itemData = useMemo(() => ({
        items: data,
        getSubtitle,
        onClick,
        currentView,
        columnCount,
        containerWidth: width,
    }), [data, getSubtitle, onClick, currentView, columnCount, width]);

    return (
        <div ref={containerRef} style={{ height: '100%', width: '100%' }}>
            {height > 0 && width > 0 && (
                <Grid
                    height={height}
                    width={width}
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
