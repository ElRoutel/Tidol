import React from 'react';
import { FixedSizeList as List } from 'react-window';
import LibraryItem from './LibraryItem';

const VirtualSongList = ({ songs, onPlay, height = 600, itemSize = 72, currentView }) => {

    const Row = ({ index, style }) => {
        const item = songs[index];
        const uniqueKey = item.id || item.identifier || `idx-${index}`;

        // Helper para subtítulos (copiado de LibraryPage)
        const getSubtitle = (itm) => {
            if (currentView === "playlists") {
                const count = itm.canciones ? itm.canciones.length : 0;
                return `${count} canciones`;
            }
            return itm.artista || itm.artist || itm.subtitle || "Desconocido";
        };

        return (
            <div style={style} className="px-2">
                <LibraryItem
                    key={uniqueKey}
                    title={item.titulo || item.title || item.nombre || "Sin título"}
                    subtitle={getSubtitle(item)}
                    image={item.portada || item.cover_url || "default-cover.jpg"} // Fallback handled in component usually
                    viewMode="list" // Virtual list forces list view usually, or we can adapt
                    item={item}
                    type={currentView === "playlists" ? "playlist" : "song"}
                    onClick={() => onPlay(songs, index)}
                />
            </div>
        );
    };

    return (
        <List
            height={height}
            itemCount={songs.length}
            itemSize={itemSize}
            width={'100%'}
            overscanCount={5}
        >
            {Row}
        </List>
    );
};

export default VirtualSongList;
