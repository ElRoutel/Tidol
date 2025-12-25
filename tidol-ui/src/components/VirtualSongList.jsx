import React, { memo, useRef, useState, useEffect } from 'react';
import { FixedSizeList as List } from 'react-window';
import LibraryItem from './LibraryItem';

// Sub-componente optimizado para cada fila.
// React.memo evita que se vuelva a renderizar si sus props no cambian.
const Row = memo(({ index, style, data }) => {
    const { items, onPlay, currentView, getSubtitle } = data;
    const item = items[index];
    const uniqueKey = item.id || item.identifier || `idx-${index}`;

    return (
        <div style={style} className="px-2"> {/* Padding horizontal para cada elemento */}
            <LibraryItem
                key={uniqueKey}
                title={item.titulo || item.title || item.nombre || "Sin título"}
                subtitle={getSubtitle(item)}
                image={item.portada || item.cover_url || "default-cover.jpg"}
                viewMode="list"
                item={item}
                type={currentView === "playlists" ? "playlist" : "song"}
                onClick={() => onPlay(items, index)}
            />
        </div>
    );
});

// Componente de lista virtualizada principal.
const VirtualSongList = ({ songs, onPlay, currentView }) => {
    const listRef = useRef(null);
    const [size, setSize] = useState({ width: 0, height: 0 });

    // Hook para hacer la lista responsiva, ajustándose a su contenedor.
    useEffect(() => {
        if (listRef.current) {
            const resizeObserver = new ResizeObserver(entries => {
                for (let entry of entries) {
                    const { width, height } = entry.contentRect;
                    setSize({ width, height });
                }
            });
            resizeObserver.observe(listRef.current);
            return () => resizeObserver.disconnect();
        }
    }, []);

    // Helper para subtítulos, ahora fuera del Row para no redefinirse.
    const getSubtitle = (itm) => {
        if (currentView === "playlists") {
            const count = itm.canciones ? itm.canciones.length : 0;
            return `${count} canciones`;
        }
        return itm.artista || itm.artist || itm.subtitle || "Desconocido";
    };

    // `itemData` es la forma correcta en react-window de pasar datos adicionales a cada Row.
    const itemData = {
        items: songs,
        onPlay,
        currentView,
        getSubtitle,
    };

    return (
        <div ref={listRef} style={{ height: '100%', width: '100%' }}>
            {size.height > 0 && (
                <List
                    height={size.height}
                    width={size.width}
                    itemCount={songs.length}
                    itemSize={72} // Altura fija de cada elemento
                    itemData={itemData} // Pasamos los datos a los Rows
                    overscanCount={5} // Renderiza elementos extra para un scroll más suave
                >
                    {Row}
                </List>
            )}
        </div>
    );
};

export default VirtualSongList;
