import React, { useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import LibraryItem from './LibraryItem';

// Helper para subtítulos (movido fuera para que no se redeclare)
const getSubtitle = (itm, currentView) => {
    if (currentView === "playlists") {
        const count = itm.canciones ? itm.canciones.length : 0;
        return `${count} canciones`;
    }
    return itm.artista || itm.artist || itm.subtitle || "Desconocido";
};

// ⚡ OPTIMIZATION: Row component is memoized and defined outside VirtualSongList.
// This prevents it from being recreated on every render, which is critical for
// react-window's performance. Data is passed via `itemData`.
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


const VirtualSongList = ({ songs, onPlay, height = 600, itemSize = 72, currentView }) => {
    // ⚡ OPTIMIZATION: useMemo ensures itemData is not recreated on every render
    // unless its dependencies change. This is crucial for React.memo in Row to work effectively.
    const itemData = useMemo(() => ({
        songs,
        onPlay,
        currentView,
    }), [songs, onPlay, currentView]);

    return (
        <List
            height={height}
            itemCount={songs.length}
            itemSize={itemSize}
            width={'100%'}
            overscanCount={5}
            itemData={itemData} // Pass data to Row component
        >
            {Row}
        </List>
    );
};

export default VirtualSongList;
