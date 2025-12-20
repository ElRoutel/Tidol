import React from 'react';
import { FixedSizeList as List } from 'react-window';
import LibraryItem from './LibraryItem';

// Helper para subtítulos, movido fuera para no recrearse en cada render
const getSubtitle = (itm, currentView) => {
    if (currentView === "playlists") {
        const count = itm.canciones ? itm.canciones.length : 0;
        return `${count} canciones`;
    }
    return itm.artista || itm.artist || itm.subtitle || "Desconocido";
};

// Componente de fila memoizado para evitar re-renders innecesarios
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
    // 💡 Optimización: `itemData` pasa datos a `Row` sin necesidad de recrear el componente en cada render.
    // Usamos `useMemo` para asegurar que el objeto `itemData` no se recree en cada render,
    // permitiendo que `React.memo` en `Row` funcione correctamente.
    const itemData = React.useMemo(() => ({
        songs, onPlay, currentView
    }), [songs, onPlay, currentView]);

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
