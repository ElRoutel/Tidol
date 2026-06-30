// src/components/LyricsView.jsx
import React, { useRef } from 'react';
import KaraokeView from './KaraokeView';
import { usePlayer } from '../context/PlayerContext';
import { useSpectraSync } from '../hooks/useSpectraSync';

export function LyricsView({ desktopMode = false }) {
    const { engine } = usePlayer();
    const { spectraData } = useSpectraSync();

    const audioRef = useRef(null);
    if (engine && !audioRef.current) {
        audioRef.current = engine.getActiveAudio();
    }

    return (
        <KaraokeView 
            desktopMode={desktopMode} 
            lyricsJSON={spectraData?.lyrics} 
            audioRef={audioRef} 
        />
    );
}
