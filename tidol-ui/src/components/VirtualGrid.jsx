import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import LibraryItem from './LibraryItem';
import favImage from '../assets/favImage.jpg';

const ROW_TEXT_CONTENT_HEIGHT = 48; // Corresponds to h-12 in TailwindCSS

const getResponsiveGap = (width) => {
    if (width < 640) return 8; // p-2
    return 16; // p-4
};

const Cell = React.memo(({ columnIndex, rowIndex, style, data }) => {
    const { items, columnCount, getSubtitle, onClick, currentView, itemWidth, itemHeight, gap } = data;
    const index = rowIndex * columnCount + columnIndex;

    if (index >= items.length) {
        return null;
    }

    const item = items[index];

    // Prepare props for LibraryItem
    const title = item.titulo || item.title || item.nombre || "Sin título";
    const subtitle = getSubtitle(item);
    const image = item.portada || item.cover_url || favImage;
    const type = currentView === "playlists" ? "playlist" : "song";

    // Adjust style to create a gap between items
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

    const { columnCount, columnWidth, rowHeight, gap } = useMemo(() => {
        if (size.width === 0) {
            return { columnCount: 0, columnWidth: 0, rowHeight: 0, gap: 0 };
        }

        const responsiveGap = getResponsiveGap(size.width);
        const minColumnWidth = 160; // Approximate width for a grid item
        const calculatedColumnCount = Math.floor(size.width / (minColumnWidth + responsiveGap));
        const safeColumnCount = Math.max(1, calculatedColumnCount); // Ensure at least one column
        const calculatedColumnWidth = size.width / safeColumnCount;
        const calculatedRowHeight = calculatedColumnWidth + ROW_TEXT_CONTENT_HEIGHT;

        return {
            columnCount: safeColumnCount,
            columnWidth: calculatedColumnWidth,
            rowHeight: calculatedRowHeight,
            gap: responsiveGap
        };
    }, [size.width]);

    const rowCount = Math.ceil(data.length / columnCount);

    const itemData = useMemo(() => ({
        items: data,
        columnCount,
        getSubtitle,
        onClick,
        currentView,
        itemWidth: columnWidth,
        itemHeight: rowHeight,
        gap,
    }), [data, columnCount, getSubtitle, onClick, currentView, columnWidth, rowHeight, gap]);


    return (
        <div ref={containerRef} style={{ height: '100%', width: '100%' }}>
            {size.height > 0 && columnCount > 0 && (
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
            )}
        </div>
    );
};

export default VirtualGrid;
