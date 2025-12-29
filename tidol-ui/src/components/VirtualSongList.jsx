import React, { useState, useEffect, useRef } from 'react';
import { FixedSizeList as List } from 'react-window';
import LibraryItem from './LibraryItem';
import favImage from '../pages/favImage.jpg';

// The Row component is memoized and defined outside of VirtualSongList
// to prevent it from being recreated on every render.
const Row = React.memo(({ data, index, style }) => {
  const { items, getSubtitle, onClick, currentView } = data;
  const item = items[index];

  // Prepare props for LibraryItem to ensure consistency
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
        viewMode="list"
        item={item}
        type={type}
        // The onClick handler is passed down from the parent component
        onClick={() => onClick(item, index)}
      />
    </div>
  );
});

const VirtualSongList = ({ data, getSubtitle, onClick, currentView, itemSize = 72 }) => {
  const containerRef = useRef(null);
  const [height, setHeight] = useState(0);

  // Set up a ResizeObserver to dynamically adjust the list height.
  // This is crucial for a responsive layout and avoids hardcoded heights,
  // which was the likely cause of the original implementation's failure.
  useEffect(() => {
    const resizeObserver = new ResizeObserver(entries => {
      if (entries[0]) {
        setHeight(entries[0].contentRect.height);
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

  // itemData is used to pass props to the Row component without triggering re-renders
  const itemData = {
    items: data,
    getSubtitle,
    onClick,
    currentView,
  };

  return (
    <div ref={containerRef} style={{ height: '100%', width: '100%' }}>
      {height > 0 && (
        <List
          height={height}
          itemCount={data.length}
          itemSize={itemSize}
          width="100%"
          overscanCount={5}
          itemData={itemData}
        >
          {Row}
        </List>
      )}
    </div>
  );
};

export default VirtualSongList;
