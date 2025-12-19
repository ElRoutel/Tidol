import React from 'react';
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

// 1. Mover Row fuera y envolverlo con React.memo
// 💡 Qué: El componente Row se ha movido fuera de VirtualSongList y se ha envuelto en React.memo.
// 🎯 Por qué: Antes, Row se recreaba en cada renderización de VirtualSongList, lo que obligaba a react-window a volver a renderizar cada elemento visible, perdiendo el estado y perjudicando el rendimiento.
// 📊 Impacto: Reduce las re-renderizaciones de los elementos de la lista a solo cuando sus propios datos cambian. Mejora significativa del rendimiento al hacer scroll y al actualizar la lista.
const Row = React.memo(({ index, style, data }) => {
    // 3. Extraer datos de la prop 'data'
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
    // 3. Pasar los datos necesarios a través de itemData
    // 🔬 Medición: El perfilador de React mostrará significativamente menos re-renderizaciones de los componentes Row al interactuar con el componente padre.
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
            itemData={itemData} // Pasar datos aquí
        >
            {Row}
        </List>
    );
};

export default VirtualSongList;
