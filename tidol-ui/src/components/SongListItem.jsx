import React from "react";

const formatDuration = (s) => {
    if (!s || isNaN(s)) return '--:--';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
};

function SongListItem({ song, onPlay, isActive }) {
    const title = song.titulo || song.title || 'Sin título';
    const artist = song.artista || (song.artist && (song.artist.name || song.artist)) || 'Desconocido';
    const cover = song.portada || song.cover_url || '/default_cover.png';
    const duration = song.duration || song.duracion;

    return (
        <button className={`song-row ${isActive ? 'active' : ''}`} onClick={onPlay}>
            <img className="song-cover" src={cover} loading="lazy" alt={title} />
            <div className="song-meta">
                <div className="song-title">{title}</div>
                <div className="song-artist">{artist}</div>
            </div>
            <div className="song-duration">{formatDuration(duration)}</div>
        </button>
    );
}

export default React.memo(SongListItem);
