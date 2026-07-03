import React from 'react';
import LibraryItem from './LibraryItem';
import favImage from '../pages/favImage.jpg';

// Lista simple (no virtualizada) para la vista "lista" de la Biblioteca.
// Antes usaba `react-window` con la API v1 (itemCount/itemSize/children), pero el
// paquete instalado es v2 (API distinta: rowComponent/rowCount/rowHeight), por lo
// que `<List>` recibía props undefined y crasheaba con
// "Cannot convert undefined or null to object" (Object.values). Para una biblioteca
// de decenas/cientos de ítems la virtualización no aporta y añadía este riesgo, así
// que renderizamos un scroll normal. Se mantiene la misma interfaz de props.
const VirtualSongList = ({ data, getSubtitle, onClick, currentView }) => {
  const items = Array.isArray(data) ? data : [];
  const type = currentView === 'playlists' ? 'playlist' : 'song';

  return (
    <div style={{ height: '100%', width: '100%', overflowY: 'auto' }} className="no-scrollbar">
      {items.map((item, index) => {
        const title = item.titulo || item.title || item.nombre || 'Sin título';
        const subtitle = getSubtitle ? getSubtitle(item) : '';
        const image = item.portada || item.cover_url || item.coverUrl || favImage;
        const uniqueKey = item.id || item.identifier || `idx-${index}`;
        return (
          <div key={uniqueKey} className="px-2">
            <LibraryItem
              title={title}
              subtitle={subtitle}
              image={image}
              viewMode="list"
              item={item}
              type={type}
              onClick={() => onClick(item, index)}
            />
          </div>
        );
      })}
    </div>
  );
};

export default VirtualSongList;
