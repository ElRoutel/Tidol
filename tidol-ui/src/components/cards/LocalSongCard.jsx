import React from 'react';
import { usePlayer } from '../../context/PlayerContext';

export default function LocalSongCard({ song, onPlay }) {
  const { currentSong } = usePlayer();
  const isPlaying = currentSong?.id === song.id;

  return (
    <div 
      className={`song-card-local ${isPlaying ? 'playing' : ''}`} 
      onClick={onPlay}
    >
      <img src={song.portada || '/default_cover.png'} alt={song.titulo} />
      <div style={{flex: 1}}>
        <h4>{song.titulo}</h4>
        <p>{song.artista} - {song.album}</p>
      </div>
      <span style={{fontSize: 18, color: 'var(--primary)'}}>{isPlaying ? '⏸' : '▶'}</span>
    </div>
  );
}
