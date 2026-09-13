import React, { useEffect, useRef, useState } from "react";
import { usePlayerProgress, usePlayer } from "../context/PlayerContext";
import '@uimaxbai/am-lyrics/am-lyrics.js';
import { IoAdd, IoRemove, IoRefresh } from 'react-icons/io5';

// Hook simplificado para el Timing Offset (almacenado en localStorage)
function useLyricsOffset(trackId) {
    const [offset, setOffset] = useState(() => {
        if (!trackId) return 0;
        const saved = localStorage.getItem(`lyrics-offset-${trackId}`);
        return saved ? parseInt(saved, 10) : 0;
    });

    useEffect(() => {
        if (!trackId) return;
        const saved = localStorage.getItem(`lyrics-offset-${trackId}`);
        setOffset(saved ? parseInt(saved, 10) : 0);
    }, [trackId]);

    const updateOffset = (newOffset) => {
        setOffset(newOffset);
        if (trackId) localStorage.setItem(`lyrics-offset-${trackId}`, newOffset.toString());
    };

    return [offset, updateOffset];
}

export default function AmLyricsView({ currentSong, accent = '#ffffff' }) {
    const amLyricsRef = useRef(null);
    const { currentTimeMotion } = usePlayerProgress();
    const { seek, isPlaying } = usePlayer();
    const [offsetMs, setOffsetMs] = useLyricsOffset(currentSong?.id || currentSong?.trackId);

    // Configuración del Web Component cuando cambia la canción
    useEffect(() => {
        const el = amLyricsRef.current;
        if (!el || !currentSong) return;

        const songTitle = currentSong.trackName || currentSong.titulo || currentSong.title || '';
        const songArtist = currentSong.artistName || currentSong.artista || currentSong.artist || '';
        const songAlbum = currentSong.album || '';
        const isrc = currentSong.isrc || currentSong.identifier || '';
        const durationSec = currentSong.durationInSeconds || currentSong.duracion || currentSong.duration || 0;

        el.setAttribute('song-title', songTitle);
        el.setAttribute('song-artist', songArtist);
        if (songAlbum) el.setAttribute('song-album', songAlbum);
        if (durationSec > 0) el.setAttribute('song-duration', (durationSec * 1000).toString());
        if (isrc) el.setAttribute('isrc', isrc);
        
        el.setAttribute('query', `${songTitle} ${songArtist}`.trim());
        el.setAttribute('highlight-color', '#fff');
        el.setAttribute('hover-background-color', 'rgba(255, 255, 255, 0.1)');
        el.setAttribute('autoscroll', '');
        el.setAttribute('interpolate', '');
        
        // El Web Component buscará la letra automáticamente usando LRCLIB / Netease internamente
    }, [currentSong]);

    // Loop a 60fps para sincronizar el tiempo (con offset)
    useEffect(() => {
        const el = amLyricsRef.current;
        if (!el) return;

        let animationFrameId;
        const updateTime = () => {
            const currentMs = (currentTimeMotion.get() || 0) * 1000;
            // offsetMs positivo = retrasar la letra (restarlo al tiempo)
            // offsetMs negativo = adelantar la letra (sumarlo al tiempo)
            el.currentTime = currentMs - offsetMs;
            
            if (isPlaying) {
                animationFrameId = requestAnimationFrame(updateTime);
            }
        };

        if (isPlaying) {
            animationFrameId = requestAnimationFrame(updateTime);
        } else {
            // Actualizar una vez estando pausado
            updateTime();
        }

        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
    }, [currentTimeMotion, isPlaying, offsetMs]);

    // Listener para clic en una línea (seek)
    useEffect(() => {
        const el = amLyricsRef.current;
        if (!el) return;

        const handleLineClick = (e) => {
            if (e.detail && e.detail.timestamp !== undefined) {
                seek(e.detail.timestamp / 1000);
            }
        };

        el.addEventListener('line-click', handleLineClick);
        return () => el.removeEventListener('line-click', handleLineClick);
    }, [seek]);

    return (
        <div className="relative w-full h-full flex flex-col pt-8 lg:pt-0">
            {/* Controles de timing integrados y minimalistas */}
            <div className="flex items-center justify-end gap-1 pr-4 pb-2 z-10 opacity-30 hover:opacity-100 transition-opacity">
                <button 
                    onClick={() => setOffsetMs(offsetMs - 500)} 
                    className="p-1.5 rounded-full hover:bg-white/10 text-white transition-colors"
                    title="Adelantar Letra (-0.5s)"
                >
                    <IoRemove size={16} />
                </button>
                <span className="text-white text-[11px] font-medium w-9 text-center" style={{ fontFeatureSettings: "'tnum'" }}>
                    {offsetMs > 0 ? '+' : ''}{(offsetMs / 1000).toFixed(1)}s
                </span>
                <button 
                    onClick={() => setOffsetMs(offsetMs + 500)} 
                    className="p-1.5 rounded-full hover:bg-white/10 text-white transition-colors"
                    title="Retrasar Letra (+0.5s)"
                >
                    <IoAdd size={16} />
                </button>
                <button 
                    onClick={() => setOffsetMs(0)} 
                    className="p-1.5 rounded-full hover:bg-white/10 text-white transition-colors ml-1"
                    title="Resetear Timing"
                >
                    <IoRefresh size={14} />
                </button>
            </div>
            
            {/* Contenedor del Web Component */}
            <div 
                className="flex-1 w-full overflow-hidden" 
                style={{ 
                    maskImage: "linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)", 
                    WebkitMaskImage: "linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)" 
                }}
            >
                {/* CSS para personalizar partes del Shadow DOM y eliminar scrollbar */}
                <style>{`
                    am-lyrics {
                        --am-lyrics-highlight-color: ${accent};
                    }
                    am-lyrics::part(lyrics-container) {
                        scrollbar-width: none !important;
                        -ms-overflow-style: none !important;
                        padding-bottom: 30vh !important;
                    }
                    am-lyrics::part(lyrics-container)::-webkit-scrollbar {
                        display: none !important;
                    }
                `}</style>
                <am-lyrics 
                    ref={amLyricsRef} 
                    style={{ width: '100%', height: '100%', display: 'block' }}
                />
            </div>
        </div>
    );
}
