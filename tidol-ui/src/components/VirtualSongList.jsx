import React from 'react';
import { FixedSizeList as List } from 'react-window';
import LibraryItem from './LibraryItem';

// Helper para subtítulos
const getSubtitle = (item, currentView) => {
    if (currentView === "playlists") {
        const count = item.canciones ? item.canciones.length : 0;
        return `${count} canciones`;
    }
    return item.artista || item.artist || item.subtitle || "Desconocido";
};

// ⚡ Optimization:
// 1. Moved Row outside of VirtualSongList to prevent re-creation on every render.
// 2. Wrapped Row with React.memo to prevent re-renders of rows that haven't changed.
// 3. Used the `itemData` prop to pass context to `Row`, which is the standard
//    react-window pattern for performance.
const Row = React.memo(({ index, style, data }) => {
    const { songs, onPlay, currentView } = data;
    const item = songs[index];
    const uniqueKey = item.id || item.identifier || `idx-${index}`;

    return (
        <div style={style} className="px-2">
            <LibraryItem
                key={uniqueKey}
                title={item.titulo || item.title || item.nombre || "Sin título"}
                subtitle={getSubtitle(item, currentView)}
                image={item.portada || item.cover_url || "default-cover.jpg"}
                viewMode="list"
                item={item}
                type={currentView === "playlists" ? "playlist" : "song"}
                onClick={() => onPlay(songs, index)}
            />
        </div>
    );
});

const VirtualSongList = ({ songs, onPlay, height, itemSize = 72, currentView }) => {
    // The `itemData` prop is the recommended way to pass data to list items.
    // This object is passed to the `Row` component as the `data` prop.
    const itemData = {
        songs,
        onPlay,
        currentView
    };

    return (
        <List
            height={height}
            itemCount={songs.length}
            itemSize={itemSize}
            width={'100%'}
            overscanCount={5}
            itemData={itemData}
        >
            {Row}
        </List>
    );
};

export default VirtualSongList;
