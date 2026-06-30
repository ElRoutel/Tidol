import { useEffect, useRef, useState } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { Minimize2, Play, Pause, SkipBack, SkipForward, Repeat, Shuffle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/axiosConfig';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/axiosConfig';

export default function TvFullScreenPlayer() {
    const { 
        currentTrack, 
        isPlaying, 
        togglePlayPause, 
        nextSong, 
        previousSong, 
        isFullScreenOpen, 
        setIsFullScreenOpen,
        toggleShuffle,
        toggleRepeat,
        currentTimeMotion,
        progressMotion,
        duration
    } = usePlayer();

    const [lyricsPayload, setLyricsPayload] = useState<any>(null);
    const [lyricsLoading, setLyricsLoading] = useState(false);
    const [lyricsError, setLyricsError] = useState(false);
    const [activeLyricIndex, setActiveLyricIndex] = useState(-1);
    const lyricsContainerRef = useRef<HTMLDivElement>(null);

    const type = lyricsPayload?.type;
    const lyrics = lyricsPayload?.lines || [];
    const isPlainMode = type === 'plain' || type === 'plain_only';
    const isSyncedMode = type === 'whisper_synced' || type === 'lrclib_synced';

    useEffect(() => {
        if (!currentTrack || !isFullScreenOpen) return;
        
        const mbid = currentTrack.id || currentTrack.trackId || currentTrack.identifier;
        if (!mbid) return;

        setLyricsLoading(true);
        setLyricsError(false);
        setLyricsPayload(null);

        api.get(`/lyrics/${mbid}`)
            .then(res => {
                if (res.data && res.data.type && res.data.lines) {
                    setLyricsPayload(res.data);
                } else {
                    setLyricsPayload(null);
                }
            })
            .catch(err => {
                if (err.response && err.response.status === 404) {
                    setLyricsPayload(null);
                } else {
                    setLyricsError(true);
                    setLyricsPayload(null);
                }
            })
            .finally(() => setLyricsLoading(false));
    }, [currentTrack, isFullScreenOpen]);

    // Fast sync loop for synced lyrics
    useEffect(() => {
        if (!lyrics.length || !isSyncedMode || !isFullScreenOpen) return;

        let animationFrameId: number;
        const checkTime = () => {
            const time = currentTimeMotion.get() || 0;
            const currentCs = time * 100;

            let newIndex = -1;
            for (let i = 0; i < lyrics.length; i++) {
                if (currentCs >= lyrics[i].start_cs) {
                    newIndex = i;
                } else {
                    break;
                }
            }

            if (newIndex !== activeLyricIndex) {
                setActiveLyricIndex(newIndex);
                if (lyricsContainerRef.current) {
                    const activeElement = lyricsContainerRef.current.children[newIndex] as HTMLElement;
                    if (activeElement) {
                        activeElement.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                }
            }
            animationFrameId = requestAnimationFrame(checkTime);
        };

        animationFrameId = requestAnimationFrame(checkTime);
        return () => cancelAnimationFrame(animationFrameId);
    }, [lyrics, activeLyricIndex, currentTimeMotion, isSyncedMode, isFullScreenOpen]);

    const handleKeyDown = (e: KeyboardEvent) => {
        if (!isFullScreenOpen) return;
        
        switch (e.key) {
            case 'Escape':
            case 'Backspace':
                e.preventDefault();
                setIsFullScreenOpen(false);
                break;
            case 'ArrowLeft':
                e.preventDefault();
                previousSong();
                break;
            case 'ArrowRight':
                e.preventDefault();
                nextSong();
                break;
            case ' ':
            case 'Enter':
            case 'MediaPlayPause':
                e.preventDefault();
                togglePlayPause();
                break;
        }
    };

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isFullScreenOpen, handleKeyDown]);

    const formatTime = (seconds: number) => {
        if (!seconds || isNaN(seconds)) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const [currentTime, setCurrentTime] = useState(0);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        if (!isFullScreenOpen) return;
        const unsubTime = currentTimeMotion.on('change', v => setCurrentTime(v));
        const unsubProg = progressMotion.on('change', v => setProgress(v));
        return () => { unsubTime(); unsubProg(); };
    }, [currentTimeMotion, progressMotion, isFullScreenOpen]);

    if (!isFullScreenOpen || !currentTrack) return null;

    return (
        <AnimatePresence>
            <motion.div 
                initial={{ opacity: 0, y: 100 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 100 }}
                className="fixed inset-0 bg-neutral-950 z-50 flex flex-row overflow-hidden"
            >
                {/* Background blur */}
                <div 
                    className="absolute inset-0 opacity-30 blur-[100px] transform scale-150"
                    style={{
                        backgroundImage: `url(${currentTrack.coverArtUrl || currentTrack.artworkUrl || currentTrack.attributes?.artwork?.url || '/default-album.png'})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                    }}
                />

                {/* Left side: Cover art & Controls */}
                <div className="w-1/2 p-16 flex flex-col justify-center items-center z-10">
                    <img 
                        src={currentTrack.coverArtUrl || currentTrack.artworkUrl || currentTrack.attributes?.artwork?.url || '/default-album.png'} 
                        className="w-[500px] h-[500px] object-cover rounded-[48px] shadow-2xl mb-12"
                        alt="Cover"
                    />
                    
                    <div className="w-[500px] text-center mb-8">
                        <h2 className="text-5xl font-extrabold truncate text-white mb-4">{currentTrack.trackName || currentTrack.title || currentTrack.attributes?.name || 'Unknown'}</h2>
                        <p className="text-3xl text-neutral-400 truncate">{currentTrack.artistName || currentTrack.artist || currentTrack.attributes?.artistName || 'Unknown'}</p>
                    </div>

                    <div className="w-[600px] mb-8">
                        <div className="h-3 bg-neutral-800 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full transition-all duration-100 ease-linear" style={{ width: `${progress}%` }} />
                        </div>
                        <div className="flex justify-between text-2xl text-neutral-400 mt-4 font-mono">
                            <span>{formatTime(currentTime)}</span>
                            <span>{formatTime(duration)}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-10">
                        <button onClick={toggleShuffle} className="p-4 text-neutral-400 hover:text-white transition-colors focus:outline-none focus:ring-4 focus:ring-white rounded-full">
                            <Shuffle size={40} />
                        </button>
                        <button onClick={previousSong} className="p-6 rounded-full bg-neutral-800 hover:bg-neutral-700 focus:outline-none focus:ring-4 focus:ring-white transition-all">
                            <SkipBack size={48} />
                        </button>
                        <button onClick={togglePlayPause} className="p-8 rounded-full bg-white text-black hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-500 transition-all shadow-xl">
                            {isPlaying ? <Pause size={64} /> : <Play size={64} className="ml-2" />}
                        </button>
                        <button onClick={() => nextSong()} className="p-6 rounded-full bg-neutral-800 hover:bg-neutral-700 focus:outline-none focus:ring-4 focus:ring-white transition-all">
                            <SkipForward size={48} />
                        </button>
                        <button onClick={toggleRepeat} className="p-4 text-neutral-400 hover:text-white transition-colors focus:outline-none focus:ring-4 focus:ring-white rounded-full">
                            <Repeat size={40} />
                        </button>
                    </div>

                    <button 
                        onClick={() => setIsFullScreenOpen(false)}
                        className="absolute top-12 left-12 p-6 rounded-full bg-neutral-900/50 backdrop-blur-md hover:bg-neutral-800 focus:outline-none focus:ring-4 focus:ring-white transition-all"
                    >
                        <Minimize2 size={40} />
                    </button>
                </div>

                {/* Right side: Lyrics */}
                <div className="w-1/2 p-16 flex flex-col z-10 relative">
                    <div 
                        ref={lyricsContainerRef}
                        className="flex-1 overflow-y-auto no-scrollbar scroll-smooth space-y-8 pb-64 pt-32"
                        style={{ maskImage: 'linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)' }}
                    >
                        {lyricsLoading ? (
                            <div className="text-4xl text-neutral-500/50 font-bold mt-64 text-center animate-pulse">
                                Cargando letras...
                            </div>
                        ) : lyricsError ? (
                            <div className="text-4xl text-neutral-500/50 font-bold mt-64 text-center">
                                Error al cargar letras
                            </div>
                        ) : isPlainMode && lyrics.length > 0 ? (
                            lyrics.map((line: string, i: number) => (
                                <div key={i} className="text-5xl font-bold leading-tight text-white/50">
                                    {line}
                                </div>
                            ))
                        ) : isSyncedMode && lyrics.length > 0 ? (
                            <div className="flex flex-wrap gap-x-4 gap-y-8 leading-loose content-start">
                                {lyrics.map((l: any, i: number) => {
                                    const isActive = i === activeLyricIndex;
                                    const isPast = i < activeLyricIndex;
                                    return (
                                        <span 
                                            key={i} 
                                            className={`text-5xl font-bold transition-all duration-300 ease-out inline-block ${
                                                isActive 
                                                    ? 'text-white scale-110 origin-bottom-left opacity-100' 
                                                    : isPast
                                                    ? 'text-neutral-300 opacity-60'
                                                    : 'text-neutral-500 opacity-40'
                                            }`}
                                            style={{ lineHeight: '1.5' }}
                                        >
                                            {l.word}
                                        </span>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-4xl text-neutral-500/50 font-bold mt-64 text-center">
                                No hay letras disponibles
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
