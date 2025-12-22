import React, { useState, useEffect } from 'react';
import { FixedSizeList as List } from 'react-window';
import LibraryItem from './LibraryItem';
import favImage from '../pages/favImage.jpg';

const Row = React.memo(({ index, style, data }) => {
  const { songs, onPlay, getSubtitle, currentView, layout } = data;
  const item = songs[index];
  const uniqueKey = item.id || item.identifier || `idx-${index}`;

  return (
    <div style={style} className="px-2">
      <LibraryItem
        key={uniqueKey}
        title={item.titulo || item.title || item.nombre || "Sin título"}
        subtitle={getSubtitle(item)}
        image={item.portada || item.cover_url || favImage}
        viewMode={layout}
        item={item}
        type={currentView === "playlists" ? "playlist" : "song"}
        onClick={() => onPlay(songs, index)}
      />
    </div>
  );
});

const VirtualSongList = ({ songs, onPlay, getSubtitle, currentView, layout }) => {
  const [height, setHeight] = useState(window.innerHeight - 220);

  useEffect(() => {
    const handleResize = () => {
      setHeight(window.innerHeight - 220);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const itemData = {
    songs,
    onPlay,
    getSubtitle,
    currentView,
    layout,
  };

  return (
    <List
      height={height}
      itemCount={songs.length}
      itemSize={72}
      width="100%"
      itemData={itemData}
      overscanCount={5}
    >
      {Row}
    </List>
  );
};

export default VirtualSongList;
