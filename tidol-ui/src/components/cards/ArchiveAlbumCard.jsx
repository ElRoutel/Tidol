import React from 'react';

export default function ArchiveAlbumCard({ item, onView, onPlay }) {
  return (
    <div className="card-base">
      <img src={item.thumbnail} alt={item.title} />
      <div 
        className="play-overlay" 
        onClick={(e) => { e.stopPropagation(); onPlay(); }}
      >
        <button className="play-overlay-btn" title="Reproducir ahora">
          <span className="play-icon">▶</span>
        </button>
      </div>
      <div className="result-info" onClick={onView}>
        <h3>{item.title}</h3>
        <p>{item.artist}</p>
        <span className="format-tag">{item.format}</span>
      </div>
    </div>
  );
}