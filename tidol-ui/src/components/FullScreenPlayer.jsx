
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayerState, usePlayerActions, usePlayerProgress, usePlayer } from '../context/PlayerContext';
import {
    IoChevronDown, IoPlaySharp, IoPauseSharp, IoPlaySkipBackSharp,
    IoPlaySkipForwardSharp, IoEllipsisHorizontal, IoVolumeHigh,
    IoShuffle, IoRepeat, IoText, IoList, IoHeart, IoHeartOutline, IoDisc, IoMic, IoPersonSharp
} from 'react-icons/io5';
import LikeButton from './LikeButton';
import { LyricsView } from './LyricsView';
import AmbientBackground from './AmbientBackground';
import { motion, useDragControls, useAnimation, AnimatePresence } from 'framer-motion';
import './FullScreenPlayer.css';

export default function FullScreenPlayer({ isEmbedded = false }) {
    const { currentSong, isPlaying, isFullScreenOpen, isMuted, volume, isShuffle, repeatMode, voxMode, voxType, originalQueue, currentIndex } = usePlayerState();
    const {
        toggleFullScreenPlayer, togglePlayPause, nextSong, previousSong,
        seek, changeVolume, toggleShuffle, toggleRepeat,
        closeFullScreenPlayer, toggleLike, isSongLiked, toggleVox, toggleVoxType, playAt
    } = usePlayer();

    const { currentTime, duration } = usePlayerProgress();

    const [showLyrics, setShowLyrics] = useState(false); // Default: Art View
    const [showQueue, setShowQueue] = useState(false);
    const [showOptions, setShowOptions] = useState(false);
    const [isScrubbing, setIsScrubbing] = useState(false);
    const [localProgress, setLocalProgress] = useState(0);
    const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
    const [mounted, setMounted] = useState(false);
    const navigate = useNavigate();

    const dragControls = useDragControls();
    const controls = useAnimation();

    // Mobile Queue Gesture
    const handleDragEnd = (event, info) => {
        // Swipe Down -> Close
        if (info.offset.y > 150) {
            toggleFullScreenPlayer();
        }
        // Swipe Up -> Open Queue (if not already open and not showing lyrics)
        else if (info.offset.y < -100 && !showLyrics && !showQueue) {
            setShowQueue(true);
        }
    };

    useEffect(() => {
        const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (currentSong?.id) {
            setShowLyrics(false);
            setShowQueue(false);
        }
    }, [currentSong?.id]);

    useEffect(() => {
        if (isEmbedded) {
            setMounted(isFullScreenOpen);
            if (!isFullScreenOpen) {
                setShowLyrics(false);
                setShowQueue(false);
            }
        } else {
            setMounted(true);
        }
    }, [isEmbedded, isFullScreenOpen]);

    const dominantColor = currentSong?.extractedColors?.dominant || '#555';
    const secondaryColor = currentSong?.extractedColors?.secondary || '#222';

    const formatTime = (time) => {
        if (isNaN(time)) return '0:00';
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')} `;
    };

    const currentProgress = isScrubbing ? localProgress : currentTime;
    const isLiked = currentSong ? isSongLiked(currentSong.id) : false;

    // Like Toggle Wrapper for component
    const handleLikeToggle = () => {
        if (currentSong) toggleLike(currentSong.id || currentSong.identifier, currentSong);
    };

    const ContainerTag = isEmbedded ? 'div' : motion.div;

    // Drag Logic:
    // - Desktop: None
    // - Mobile: Drag Y enabled BUT if lyrics/queue open, we might restrict it or handle it carefully.
    // - PROMPT: "If Lyrics are open, DO NOT allow dragging...".
    // We apply this to Queue as well to prevent conflict.
    const canDrag = !isDesktop && !showLyrics && !showQueue;

    const dragProps = isEmbedded ? {} : {
        drag: canDrag ? "y" : false,
        dragConstraints: { top: 0, bottom: 0 },
        dragElastic: 0.2,
        onDragEnd: handleDragEnd
    };

    const handleGoToArtist = () => {
        if (!currentSong) return;
        setShowOptions(false);
        const artist = currentSong.artista || currentSong.artist;

        if (currentSong.source === 'internet_archive' || !!currentSong.identifier) {
            // IA Search for artist
            navigate(`/search?q=${encodeURIComponent(artist)}&source=ia`);
        } else if (currentSong.artistId) {
            navigate(`/artist/${currentSong.artistId}`);
        } else {
            // Fallback to search
            navigate(`/search?q=${encodeURIComponent(artist)}`);
        }
        closeFullScreenPlayer();
    };

    const handleGoToAlbum = () => {
        if (!currentSong) return;
        setShowOptions(false);
        const album = currentSong.album;

        if (currentSong.source === 'internet_archive' || !!currentSong.identifier) {
            // IA Search for album
            navigate(`/search?q=${encodeURIComponent(album)}&source=ia`);
        } else if (currentSong.albumId) {
            navigate(`/album/${currentSong.albumId}`);
        } else {
            navigate(`/search?q=${encodeURIComponent(album)}`);
        }
        closeFullScreenPlayer();
    };

    if (!isFullScreenOpen && isEmbedded && !mounted) return null;
    if (!isFullScreenOpen && !isEmbedded) return null;

    return (
        <ContainerTag
            {...dragProps}
            className={`fixed inset-0 z-[99999] flex flex-col overflow-hidden animate-slide-up bg-black font-sans ${isEmbedded ? 'pointer-events-auto' : ''}`}
        >

            {/* 🌌 Background Atmosphere */}
            <div
                className="absolute inset-0 z-0 opacity-60 transition-colors duration-1000 ease-in-out pointer-events-none"
                style={{
                    background: `radial - gradient(circle at 20 % 30 %, ${dominantColor}, transparent 70 %),
    radial - gradient(circle at 80 % 80 %, ${secondaryColor}, transparent 70 %)`
                }}
            />
            <div className="absolute inset-0 z-0 opacity-40 mix-blend-screen pointer-events-none">
                <AmbientBackground songId={currentSong?.id} colors={currentSong?.extractedColors} intensity={0.5} />
            </div>
            {/* FIXED GRADIENT: Lowered start point to transparent 75% */}
            <div className="absolute inset-0 z-0 pointer-events-none"
                style={{ background: 'linear-gradient(to bottom, transparent 75%, #000 100%)' }}
            />
            <div className="absolute inset-0 z-0 backdrop-blur-[60px] pointer-events-none" />


            {/* --- CONTENT SWITCHER --- */}
            {isDesktop ? (
                // ================= DESKTOP LAYOUT (>1024px) =================
                <div className="relative z-10 w-full h-full grid grid-cols-[45%_55%]">

                    {/* LEFT COLUMN: The Stage */}
                    <div className="h-full flex flex-col items-center justify-center relative px-[4vw]">
                        {/* Drag Handle */}
                        <button onClick={toggleFullScreenPlayer} className="absolute top-8 left-8 p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
                            <IoChevronDown size={24} className="text-white" />
                        </button>

                        {/* Sticky Wrapper */}
                        <div className="flex flex-col items-start w-full max-w-[500px]">
                            {/* Art */}
                            <div
                                className="w-full aspect-square rounded-[24px] shadow-2xl relative mb-12 transform transition-transform duration-500 hover:scale-[1.01]"
                                style={{
                                    width: 'min(35vw, 500px)',
                                    height: 'min(35vw, 500px)',
                                    boxShadow: `0 30px 60px - 15px rgba(0, 0, 0, 0.7)`
                                }}
                            >
                                <div className="absolute inset-0 rounded-[24px] opacity-40 blur-3xl -z-10" style={{ background: dominantColor }} />
                                <img
                                    src={currentSong?.coverFull || currentSong?.portada || '/default_cover.png'}
                                    alt={currentSong?.titulo}
                                    className="w-full h-full object-cover rounded-[24px]"
                                />
                            </div>

                            {/* Metadata */}
                            <div className="w-full text-left">
                                <h1 className="text-[42px] font-[800] text-white leading-[1.1] tracking-tight line-clamp-2 mb-2">
                                    {currentSong?.titulo || "Unknown Title"}
                                </h1>
                                <h2 className="text-[24px] font-[500] text-white/60">
                                    {currentSong?.artista || "Unknown Artist"}
                                </h2>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Stream */}
                    <div className="h-full overflow-y-auto no-scrollbar pt-[15vh] pb-[150px] px-[4vw]">
                        {showQueue ? (
                            <div className="w-full max-w-2xl mx-auto">
                                <h2 className="text-3xl font-bold mb-6">Cola de Reproducción</h2>
                                <div className="space-y-4">
                                    {originalQueue && originalQueue.length > 0 ? (
                                        originalQueue.map((s, idx) => (
                                            <div key={s.id || idx} className={`flex items-center justify-between p-3 rounded-md ${idx === currentIndex ? 'bg-white/6 border border-white/10' : 'bg-white/2'} `}>
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <button onClick={() => { playAt(idx); setShowQueue(false); }} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white/90 hover:bg-white/20">
                                                        <IoPlaySharp size={16} />
                                                    </button>
                                                    <div className="min-w-0">
                                                        <div className="font-semibold text-white truncate">{s.titulo || s.title || 'Untitled'}</div>
                                                        <div className="text-sm text-white/60 truncate">{s.artista || s.artist || ''}</div>
                                                    </div>
                                                </div>
                                                <div className="text-xs text-white/40 font-mono">{s.duracion ? new Date((s.duracion || 0) * 1000).toISOString().substr(14, 5) : ''}</div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-white/50">La cola está vacía</p>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="w-full">
                                <LyricsView desktopMode={true} />
                            </div>
                        )}
                    </div>

                    {/* Desktop Controls */}
                    <div className="desktop-glass-bar fixed bottom-0 left-0 w-full h-[90px] z-50 flex items-center justify-between px-12">
                        <div className="flex items-center gap-4 w-[25%]">
                            <LikeButton song={currentSong} isLiked={isLiked} onLikeToggle={handleLikeToggle} isArchive={currentSong?.source === 'internet_archive' || !!currentSong?.identifier} />
                            <div className="text-xs text-white/40 font-mono">
                                {formatTime(currentTime)} / {formatTime(duration)}
                            </div>
                        </div>

                        <div className="flex flex-col items-center justify-center flex-1 max-w-[600px] gap-2">
                            <div className="flex items-center gap-8">
                                <button onClick={toggleShuffle} className={`transition-all ${isShuffle ? 'text-white scale-110' : 'text-white/60 hover:text-white'}`}>
                                    <IoShuffle size={20} />
                                </button>
                                <button onClick={previousSong} className="text-white hover:scale-110 transition-transform"><IoPlaySkipBackSharp size={28} /></button>
                                <button onClick={togglePlayPause} className="w-12 h-12 bg-white rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-transform text-black shadow-lg">
                                    {isPlaying ? <IoPauseSharp size={24} /> : <IoPlaySharp size={24} className="ml-1" />}
                                </button>
                                <button onClick={nextSong} className="text-white hover:scale-110 transition-transform"><IoPlaySkipForwardSharp size={28} /></button>
                                <button onClick={toggleRepeat} className={`transition-all relative ${repeatMode !== 'off' ? 'text-white scale-110' : 'text-white/60 hover:text-white'}`}>
                                    <IoRepeat size={20} />
                                    {repeatMode === 'one' && (
                                        <span className="absolute -top-1 -right-1 text-[8px] font-bold bg-white text-black rounded-full w-3 h-3 flex items-center justify-center">1</span>
                                    )}
                                </button>
                            </div>
                            {/* Scrubber */}
                            <div className="w-full flex items-center gap-3 group">
                                <span className="text-xs text-white/40 w-10 text-right">{formatTime(currentTime)}</span>
                                <div className="relative flex-1 h-1 bg-white/20 rounded-full cursor-pointer group-hover:h-1.5 transition-all">
                                    <div className="absolute h-full bg-white rounded-full" style={{ width: `${(currentProgress / duration) * 100}% ` }} />
                                    <input type="range" min="0" max={duration || 100} value={currentProgress} onChange={(e) => { setIsScrubbing(true); setLocalProgress(parseFloat(e.target.value)); seek(parseFloat(e.target.value)); }} onMouseUp={() => setIsScrubbing(false)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                </div>
                                <span className="text-xs text-white/40 w-10">{formatTime(duration)}</span>
                            </div>
                        </div>

                        {/* Right Tools - ADDED MIC */}
                        <div className="flex items-center justify-end gap-6 w-[25%]">
                            {/* Mic Button -> Toggle VOX On/Off */}
                            <div className="flex items-center gap-2">
                                <button onClick={toggleVox} className={`text-white/60 hover:text-white ${voxMode ? 'text-[#1db954]' : ''}`} title={voxMode ? `VOX On (${voxType})` : 'Toggle VOX'}>
                                    <IoMic size={22} />
                                </button>
                                {/* VOX Type Toggle (Vocals <-> Accompaniment) */}
                                <button onClick={() => toggleVoxType()} className={`text-white/50 hover:text-white text-[13px] px-2 py-1 rounded-md ${voxType === 'vocals' ? 'bg-white/6' : ''}`} title={`Switch VOX track (${voxType})`}>
                                    {voxType === 'vocals' ? 'V' : 'K'}
                                </button>
                            </div>

                            {/* Queue Button -> Toggle Queue View */}
                            <button onClick={() => setShowQueue(true)} className={`text-white/60 hover:text-white ${showQueue ? 'text-[#1db954]' : ''}`}>
                                <IoList size={22} />
                            </button>

                            <div className="flex items-center gap-2 w-32 group">
                                <IoVolumeHigh size={20} className="text-white/60" />
                                <div className="h-1 flex-1 bg-white/20 rounded-full cursor-pointer relative">
                                    <div className="absolute h-full bg-white rounded-full" style={{ width: `${volume * 100}% ` }} />
                                    <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => changeVolume(parseFloat(e.target.value))} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            ) : (
                // ================= MOBILE LAYOUT (<1024px) =================
                <div className="relative z-10 flex flex-col h-full w-full mx-auto px-6 pt-12 pb-8">
                    {/* Header */}
                    <div className="flex items-center justify-center mb-6 shrink-0 relative z-50">
                        <button
                            onClick={toggleFullScreenPlayer}
                            className="w-12 h-1.5 bg-white/20 rounded-full hover:bg-white/40 transition-colors cursor-pointer"
                        />
                    </div>

                    {/* Art */}
                    <div className="w-full flex justify-center mb-8 shrink-0 relative">
                        <div
                            className="relative w-[85vw] max-w-[350px] aspect-square rounded-[24px] shadow-2xl transition-transform duration-500 ease-out z-10"
                            style={{
                                transform: isPlaying ? 'scale(1)' : 'scale(0.85)',
                                boxShadow: `0 30px 60px - 15px rgba(0, 0, 0, 0.7)`
                            }}
                        >
                            <div className="absolute inset-0 rounded-[24px] opacity-50 blur-3xl -z-10 transform scale-95 translate-y-4" style={{ background: dominantColor }} />
                            <img src={currentSong?.portada || currentSong?.coverFull || currentSong?.cover || '/default_cover.png'} alt={currentSong?.titulo} className="w-full h-full object-cover rounded-[24px]" />
                        </div>
                    </div>

                    {/* Metadata & Actions */}
                    <div className="flex justify-between items-start mb-6 shrink-0 w-[90%] mx-auto relative z-20">
                        <div className="flex-1 min-w-0 pr-4 text-left overflow-hidden">
                            <div className="w-full overflow-hidden mask-image-gradient">
                                <div className={`${currentSong?.titulo?.length > 20 ? 'animate-marquee flex' : ''} `}>
                                    <h1 className="text-[22px] font-[800] text-white leading-[1.2] tracking-tight whitespace-nowrap pr-8">
                                        {currentSong?.titulo || "Unknown Title"}
                                    </h1>
                                    {currentSong?.titulo?.length > 20 && (
                                        <h1 className="text-[22px] font-[800] text-white leading-[1.2] tracking-tight whitespace-nowrap pr-8">
                                            {currentSong?.titulo || "Unknown Title"}
                                        </h1>
                                    )}
                                </div>
                            </div>
                            <h2 className="text-[18px] font-[500] text-white/60 mt-0.5 truncate">
                                {currentSong?.artista || "Unknown Artist"}
                            </h2>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 pt-1">
                            {/* FIXED LIKE BUTTON */}
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 backdrop-blur-md text-white/80 transition-transform active:scale-95">
                                <LikeButton song={currentSong} isLiked={isLiked} onLikeToggle={handleLikeToggle} iconSize={18} isArchive={currentSong?.source === 'internet_archive' || !!currentSong?.identifier} />
                            </div>
                            <button
                                onClick={() => setShowOptions(!showOptions)}
                                className={`flex items-center justify-center w-8 h-8 rounded-full bg-white/10 backdrop-blur-md text-white/80 hover:bg-white/20 transition-all active:scale-95 ${showOptions ? 'bg-white/30 text-white' : ''}`}
                            >
                                <IoEllipsisHorizontal size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Scrubber */}
                    <div className="mb-8 w-[90%] mx-auto group shrink-0 relative z-20">
                        <div className="relative w-full h-6 flex items-center cursor-pointer">
                            <input type="range" min="0" max={duration || 100} value={currentProgress} onChange={(e) => { setIsScrubbing(true); setLocalProgress(parseFloat(e.target.value)); seek(parseFloat(e.target.value)); }} onMouseUp={() => setIsScrubbing(false)} onTouchEnd={() => setIsScrubbing(false)} className="absolute z-20 opacity-0 w-full h-full cursor-pointer" />
                            <div className="absolute w-full h-[4px] bg-white/20 rounded-full overflow-hidden pointer-events-none backdrop-blur-sm">
                                <div className="h-full bg-white/90 rounded-full" style={{ width: `${(currentProgress / duration) * 100}% ` }} />
                            </div>
                            <div className="absolute h-3 w-3 bg-white rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.2)] pointer-events-none transition-transform duration-200" style={{ left: `${(currentProgress / duration) * 100}% `, transform: 'translateX(-50%)' }} />
                        </div>
                        <div className="flex justify-between text-[11px] font-bold text-white/40 font-mono -mt-1 tracking-wider">
                            <span>{formatTime(currentProgress)}</span>
                            <span>-{formatTime(duration - currentProgress)}</span>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="mt-auto flex flex-col items-center w-full pb-6 relative z-20">
                        <div className="flex items-center justify-center gap-10 mb-8 w-full">
                            <button onClick={toggleShuffle} className={`transition-all ${isShuffle ? 'text-white scale-110' : 'text-white/50 hover:text-white'}`}>
                                <IoShuffle size={26} />
                            </button>
                            <button onClick={previousSong} className="text-white hover:text-white/80 active:scale-90 transition-all"><IoPlaySkipBackSharp size={42} /></button>
                            <button onClick={togglePlayPause} className="w-[72px] h-[72px] rounded-full bg-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all text-black">
                                {isPlaying ? <IoPauseSharp size={32} /> : <IoPlaySharp size={32} className="ml-1" />}
                            </button>
                            <button onClick={nextSong} className="text-white hover:text-white/80 active:scale-90 transition-all"><IoPlaySkipForwardSharp size={42} /></button>
                            <button onClick={toggleRepeat} className={`transition-all relative ${repeatMode !== 'off' ? 'text-white scale-110' : 'text-white/50 hover:text-white'}`}>
                                <IoRepeat size={26} />
                                {repeatMode === 'one' && (
                                    <span className="absolute -top-1 -right-1 text-[10px] font-bold bg-white text-black rounded-full w-4 h-4 flex items-center justify-center">1</span>
                                )}
                            </button>
                        </div>
                        <div className="w-full max-w-[80%] flex items-center justify-between px-4 text-white/50">
                            {/* Lyrics Button - Wired */}
                            <button onClick={() => setShowLyrics(!showLyrics)} className={`transition-colors ${showLyrics ? 'text-[#1db954]' : 'hover:text-white'}`}>
                                <IoText size={24} />
                            </button>

                            {/* Placeholder Disc */}
                            <button className="hover:text-white transition-colors"><IoDisc size={24} /></button>

                            {/* Mic Button - Wired to Spectra (Vocals/Karaoke) */}
                            <div className="flex items-center gap-3">
                                <button onClick={toggleVox} className={`transition-colors ${voxMode ? 'text-[#1db954] scale-110 shadow-[0_0_15px_rgba(29,185,84,0.5)] rounded-full' : 'hover:text-white'}`}>
                                    <IoMic size={24} />
                                </button>
                                <button onClick={() => toggleVoxType()} className={`text-white/50 hover:text-white text-[13px] px-2 py-1 rounded-md ${voxType === 'vocals' ? 'bg-white/6' : ''}`} title={`Switch VOX track (${voxType})`}>
                                    {voxType === 'vocals' ? 'V' : 'K'}
                                </button>
                            </div>

                            {/* Queue Button - Wired */}
                            <button onClick={() => setShowQueue(!showQueue)} className={`transition-colors ${showQueue ? 'text-[#1db954]' : 'hover:text-white'}`}>
                                <IoList size={24} />
                            </button>
                        </div>
                    </div>

                    {/* Lyrics Overlay Mobile */}
                    {showLyrics && (
                        <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-2xl animate-fade-in pt-20 px-6 touch-auto" onPointerDown={(e) => e.stopPropagation()}>
                            <button onClick={() => setShowLyrics(false)} className="absolute top-6 right-6 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white z-[60]">
                                <IoChevronDown size={24} />
                            </button>
                            <h2 className="absolute top-7 left-6 text-2xl font-bold text-white z-[60]">Letras</h2>
                            <div className="h-full w-full overflow-y-auto no-scrollbar">
                                <LyricsView />
                            </div>
                        </div>
                    )}

                    {/* Queue Overlay Mobile */}
                    {showQueue && (
                        <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-2xl animate-fade-in pt-20 px-6 touch-auto" onPointerDown={(e) => e.stopPropagation()}>
                            <button onClick={() => setShowQueue(false)} className="absolute top-6 right-6 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white z-[60]">
                                <IoChevronDown size={24} />
                            </button>
                            <h2 className="absolute top-7 left-6 text-2xl font-bold text-white z-[60]">Cola</h2>
                            <div className="h-full w-full overflow-y-auto no-scrollbar text-white/60">
                                {originalQueue && originalQueue.length > 0 ? (
                                    <div className="py-6 space-y-2">
                                        {originalQueue.map((s, idx) => (
                                            <div key={s.id || idx} className={`flex items-center justify-between p-4 rounded-md ${idx === currentIndex ? 'bg-white/6' : 'bg-transparent'}`}>
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <button onClick={() => { playAt(idx); setShowQueue(false); }} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/90 hover:bg-white/20">
                                                        <IoPlaySharp size={16} />
                                                    </button>
                                                    <div className="min-w-0">
                                                        <div className="font-semibold text-white truncate">{s.titulo || s.title || 'Untitled'}</div>
                                                        <div className="text-sm text-white/60 truncate">{s.artista || s.artist || ''}</div>
                                                    </div>
                                                </div>
                                                <div className="text-xs text-white/40 font-mono">{s.duracion ? new Date((s.duracion || 0) * 1000).toISOString().substr(14, 5) : ''}</div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <p className="text-white/50">La cola está vacía</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Options Menu Overlay (Dropdown style) */}
            <AnimatePresence>
                {showOptions && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="absolute bottom-24 right-6 z-[100] bg-[#1a1a1a]/95 border border-white/10 rounded-2xl p-2 w-[220px] shadow-2xl backdrop-blur-3xl"
                    >
                        <button onClick={handleGoToArtist} className="flex items-center gap-3 w-full p-4 hover:bg-white/10 rounded-xl transition-colors text-white/90 text-[16px]">
                            <IoPersonSharp className="text-white/40" />
                            Ir al Artista
                        </button>
                        <button onClick={handleGoToAlbum} className="flex items-center gap-3 w-full p-4 hover:bg-white/10 rounded-xl transition-colors text-white/90 text-[16px]">
                            <IoDisc className="text-white/40" />
                            Ir al Álbum
                        </button>
                        <div className="h-[1px] bg-white/5 my-1" />
                        <button onClick={() => setShowOptions(false)} className="flex items-center justify-center w-full p-4 text-red-400 font-semibold text-[15px]">
                            Cerrar
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

        </ContainerTag>
    );
}