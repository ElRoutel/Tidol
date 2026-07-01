import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import { usePlayerState, usePlayerActions, usePlayerProgress, usePlayer } from '../context/PlayerContext';
import {
    IoChevronDown, IoPlaySharp, IoPauseSharp, IoPlaySkipBackSharp,
    IoPlaySkipForwardSharp, IoEllipsisHorizontal, IoVolumeHigh,
    IoShuffle, IoRepeat, IoText, IoList, IoDisc, IoMic, IoPersonSharp
} from 'react-icons/io5';
import LikeButton from './LikeButton';
import { LyricsView } from './LyricsView';
import KaraokeView from './KaraokeView';
import DynamicBackground from './DynamicBackground';
import { motion, useTransform, useDragControls, AnimatePresence } from 'framer-motion';
import { getCoverSrc } from '../utils/coverArt';
import './FullScreenPlayer.css';

export default function FullScreenPlayer({ isEmbedded = false }) {
    const { currentSong, isPlaying, isFullScreenOpen, volume, isShuffle, repeatMode, voxMode, voxType, originalQueue, currentIndex, isVoxLoading: contextVoxLoading } = usePlayerState();

    const {
        togglePlayPause, nextSong, previousSong,
        seek, changeVolume, toggleShuffle, toggleRepeat,
        closeFullScreenPlayer, toggleLike, isSongLiked, toggleVox, toggleVoxType, playAt
    } = usePlayer();

    // Extraído correctamente de las acciones
    const { toggleFullScreenPlayer } = usePlayerActions();
    const { currentTimeMotion, progressMotion, duration } = usePlayerProgress();

    const [viewMode, setViewMode] = useState('cover'); // 'cover' | 'lyrics' | 'queue'
    const [showOptions, setShowOptions] = useState(false);
    const [isScrubbing, setIsScrubbing] = useState(false);
    const [localProgress, setLocalProgress] = useState(0);
    const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
    const [mounted, setMounted] = useState(false);
    const [voxLoading, setVoxLoading] = useState(false);
    const navigate = useNavigate();

    // Físicas de arrastre nivel Senior: Detecta movimiento intencional o rápido
    const handleDragEnd = (event, info) => {
        // Si desliza hacia abajo más de 80px o con velocidad
        if (info.offset.y > 80 || info.velocity.y > 300) {
            closeFullScreenPlayer();
        }
        // Si desliza hacia arriba, abre la cola
        else if (info.offset.y < -80 && viewMode === 'cover') {
            setViewMode('queue');
        }
    };

    useEffect(() => {
        const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const [lyricsData, setLyricsData] = useState(null);
    const [lyricsLoading, setLyricsLoading] = useState(false);
    const [lyricsError, setLyricsError] = useState(false);

    useEffect(() => {
        // El id canónico puede venir en `id` (álbum/normalizeTrackList) o solo en
        // `trackId` (Home "Volver a escuchar"/normalizeToUnifiedTrack). Antes solo se
        // usaba `id`, por lo que las canciones fuera del álbum no cargaban letras.
        const mbid = currentSong?.id || currentSong?.trackId;
        if (mbid) {
            setViewMode('cover');
            if (isFullScreenOpen) {
                // Fetch Lyrics from API using Axios
                setLyricsLoading(true);
                setLyricsError(false);
                api.get(`/lyrics/${mbid}`)
                    .then(res => {
                        const data = res.data;
                        if (data && data.type && data.lines) {
                            console.log(`[Debug] Payload de letras recibido: type="${data.type}", lines=${Array.isArray(data.lines) ? data.lines.length : '?'} items`);
                            setLyricsData(data); // Pass the whole payload { type, lines }
                        } else {
                            console.log("[Debug] Payload de letras vacío o malformado");
                            setLyricsData(null);
                        }
                    })
                    .catch(error => {
                        if (error.response && error.response.status === 404) {
                            // Es normal, la letra aún no existe o está procesándose
                            console.log("[Debug] Letras no encontradas (404) — caché negativo o pending");
                            setLyricsData(null);
                        } else if (error.response && error.response.status === 401) {
                            // Sin autorización, probablemente sesión expirada o sin login
                            console.warn("[FullScreenPlayer] No autorizado para obtener letras (401).");
                            setLyricsData(null);
                        } else {
                            // Un error real (500, red caída, etc.)
                            console.error("[FullScreenPlayer] Error real en letras:", error.message);
                            setLyricsError(true);
                            setLyricsData(null);
                        }
                    })
                    .finally(() => {
                        setLyricsLoading(false);
                    });
            }
        }
    }, [currentSong?.id, currentSong?.trackId, isFullScreenOpen]);

    useEffect(() => {
        if (isEmbedded) {
            setMounted(isFullScreenOpen);
            if (!isFullScreenOpen) {
                setViewMode('cover');
            }
        } else {
            setMounted(true);
        }
    }, [isEmbedded, isFullScreenOpen]);

    // Colores por defecto más oscuros para mayor elegancia
    const dominantColor = currentSong?.extractedColors?.dominant || '#344966';
    const secondaryColor = currentSong?.extractedColors?.secondary || '#0a0a0a';

    const formatTime = (time) => {
        if (!time || isNaN(time)) return '00:00';
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const formattedTime = useTransform(currentTimeMotion, t => formatTime(t));
    const formattedRemaining = useTransform(currentTimeMotion, t => `-${formatTime(duration - t)}`);
    const progressPercent = useTransform(progressMotion, p => `${p || 0}%`);

    const displayTimeText = isScrubbing ? formatTime(localProgress) : formattedTime;
    const displayRemainingText = isScrubbing ? `-${formatTime(duration - localProgress)}` : formattedRemaining;
    const displayWidth = isScrubbing ? `${(localProgress / duration) * 100}%` : progressPercent;

    const currentProgress = isScrubbing ? localProgress : (currentTimeMotion.get() || 0);
    const isLiked = currentSong ? isSongLiked(currentSong.id) : false;

    const handleLikeToggle = () => {
        if (currentSong) toggleLike(currentSong.id || currentSong.identifier, currentSong);
    };

    const ContainerTag = isEmbedded ? 'div' : motion.div;
    const canDrag = !isDesktop && viewMode === 'cover';

    const dragProps = isEmbedded ? {} : {
        drag: canDrag ? "y" : false,
        dragConstraints: { top: 0, bottom: 0 },
        dragElastic: { top: 0.025, bottom: 0.8 }, // Rebote natural
        onDragEnd: handleDragEnd
    };

    const handleNavigation = (type) => {
        if (!currentSong) return;
        setShowOptions(false);
        const query = type === 'artist' ? (currentSong.artistName || currentSong.artista || currentSong.artist) : currentSong.album;
        const isIA = currentSong.source === 'internet_archive' || !!currentSong.identifier;

        if (isIA) {
            navigate(`/search?q=${encodeURIComponent(query)}&source=ia`);
        } else if (type === 'artist' && currentSong.artistId) {
            navigate(`/artist/${currentSong.artistId}`);
        } else if (type === 'album' && currentSong.albumId) {
            navigate(`/album/${currentSong.albumId}`);
        } else {
            navigate(`/search?q=${encodeURIComponent(query)}`);
        }
        closeFullScreenPlayer();
    };

    // Vox toggle with loading state logic
    const handleToggleVox = (e) => {
        e?.stopPropagation?.();
        e?.preventDefault?.();
        // Guard: don't fire if already processing or loading
        if (voxLoading || contextVoxLoading) {
            console.log('[FullScreenPlayer] handleToggleVox BLOCKED (already loading)');
            return;
        }
        console.log('[FullScreenPlayer] handleToggleVox clicked!');
        console.log('[FullScreenPlayer] currentSong:', currentSong ? {
            id: currentSong.trackId || currentSong.id,
            trackName: currentSong.trackName || currentSong.titulo,
            archivo: currentSong.archivo,
            playbackUrl: currentSong.playbackUrl,
            sourceType: currentSong.sourceType,
        } : 'NULL');
        setVoxLoading(true);
        toggleVox();
        setTimeout(() => setVoxLoading(false), 600);
    };

    const handleToggleVoxType = (e) => {
        e?.stopPropagation?.();
        e?.preventDefault?.();
        if (voxLoading) return;
        setVoxLoading(true);
        toggleVoxType();
        setTimeout(() => setVoxLoading(false), 600);
    };

    if (!isFullScreenOpen && isEmbedded && !mounted) return null;
    if (!isFullScreenOpen && !isEmbedded) return null;

    return (
        <ContainerTag
            {...dragProps}
            className={`fixed inset-0 z-[99999] flex flex-col overflow-hidden animate-slide-up bg-[#050505] font-sans select-none ${isEmbedded ? 'pointer-events-auto' : ''}`}
        >
            {/* yo no le pedi a cluade este emoji pero lo voy a dejar 🌌 Background Premium (CSS Radial Gradient for Apple Music Style) */}
            <div 
                className="absolute inset-0 z-0 opacity-80" 
                style={{ 
                    background: `radial-gradient(120% 120% at 20% 20%, ${dominantColor} 0%, transparent 60%), radial-gradient(120% 120% at 80% 80%, ${secondaryColor} 0%, #050505 80%)`,
                    backgroundColor: '#050505'
                }} 
            />
            {/* Oscurecimiento sutil hacia los controles para mejor contraste del texto */}
            <div className="absolute inset-0 z-0 pointer-events-none" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0) 50%, rgba(0,0,0,0.85) 100%)' }} />

            {isDesktop ? (
                // ================= DESKTOP LAYOUT (>1024px) =================
                <div className="relative z-10 w-full h-full grid grid-cols-[40%_60%]">
                    <div className="h-full flex flex-col items-center justify-center relative px-[4vw]">
                        <button onClick={closeFullScreenPlayer} className="absolute top-8 left-8 p-3 bg-white/10 rounded-full hover:bg-white/20 transition-all active:scale-90">
                            <IoChevronDown size={24} className="text-white" />
                        </button>

                        <div className="flex flex-col items-start w-full max-w-[500px]">
                            <div className="w-full aspect-square relative shadow-[0_30px_60px_rgba(0,0,0,0.6)] transform transition-transform duration-500 hover:scale-[1.02]">
                                <div className="absolute inset-0 opacity-40 blur-3xl -z-10" style={{ background: dominantColor }} />
                                <img
                                    src={getCoverSrc(currentSong, true)}
                                    alt={currentSong?.trackName || currentSong?.titulo}
                                    className="w-full h-full object-cover"
                                    onError={(e) => { e.currentTarget.src = '/default-album.png'; }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="h-full overflow-y-auto no-scrollbar pt-[15vh] pb-[150px] px-[4vw]">
                        {viewMode === 'queue' ? (
                            <div className="w-full max-w-2xl mx-auto">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-3xl font-bold text-white tracking-tight">Cola de Reproducción</h2>
                                    <button onClick={() => setViewMode('cover')} className="text-white/50 hover:text-white text-sm font-medium">Cerrar</button>
                                </div>
                                <div className="space-y-3">
                                    {originalQueue?.map((s, idx) => (
                                        <div key={s.id || idx} className={`flex items-center justify-between p-3 rounded-xl transition-colors ${idx === currentIndex ? 'bg-white/10 shadow-lg' : 'hover:bg-white/5'}`}>
                                            <div className="flex items-center gap-4 min-w-0">
                                                <button onClick={() => { playAt(idx); setViewMode('cover'); }} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 active:scale-95 transition-all shrink-0">
                                                    <IoPlaySharp size={18} />
                                                </button>
                                                <div className="min-w-0">
                                                    <div className="font-semibold text-white truncate text-[15px]">{s.trackName || s.titulo || s.title || 'Untitled'}</div>
                                                    <div className="text-[13px] text-white/50 truncate">{s.artistName || s.artista || s.artist || ''}</div>
                                                </div>
                                            </div>
                                            <div className="text-xs text-white/40 font-mono ml-4">{(s.durationInSeconds || s.duracion) ? new Date(((s.durationInSeconds || s.duracion) || 0) * 1000).toISOString().substr(14, 5) : ''}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : lyricsLoading ? (
                            <div className="flex items-center justify-center h-full w-full text-white/50">Cargando letras sincronizadas...</div>
                        ) : lyricsError ? (
                            <div className="flex items-center justify-center h-full w-full text-white/50">Letras no disponibles aún</div>
                        ) : (
                            <KaraokeView lyricsPayload={lyricsData} />
                        )}
                    </div>

                    <div className="fixed bottom-0 left-0 w-full h-[auto] z-50 flex items-center justify-between px-11 bg-gradient-to-t from-black/80 to-transparent backdrop-blur-md">
                        <div className="flex items-center gap-6 w-[30%]">
                            <div className="flex flex-col min-w-0 mr-4">
                                {/* Contenedor con máscara de desvanecimiento para Desktop */}
                                <div className="w-full overflow-hidden" style={{ maskImage: 'linear-gradient(to right, black 80%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to right, black 80%, transparent 100%)' }}>
                                    <div className={`flex w-max ${currentSong?.trackName?.length > 20 || currentSong?.titulo?.length > 20 ? 'animate-marquee' : ''}`}>
                                        <span className="text-white font-bold text-lg leading-tight tracking-tight whitespace-nowrap pr-10">
                                            {currentSong?.trackName || currentSong?.titulo || "Untitled"}
                                        </span>
                                        {(currentSong?.trackName?.length > 20 || currentSong?.titulo?.length > 20) && (
                                            <span className="text-white font-bold text-lg leading-tight tracking-tight whitespace-nowrap pr-10">
                                                {currentSong?.trackName || currentSong?.titulo || "Untitled"}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <span className="text-white/60 font-medium text-sm truncate">
                                    {currentSong?.artistName || currentSong?.artista || "Unknown Artist"}
                                </span>
                            </div>
                            <LikeButton song={currentSong} isLiked={isLiked} onLikeToggle={handleLikeToggle} isArchive={currentSong?.source === 'internet_archive' || !!currentSong?.identifier} />
                            <div className="text-sm text-white/50 font-mono font-medium tracking-wide whitespace-nowrap">
                                <motion.span>{displayTimeText}</motion.span> <span className="mx-1 opacity-50">/</span> {formatTime(duration)}
                            </div>
                        </div>

                        <div className="flex flex-col items-center justify-center flex-1 max-w-[600px] gap-3">
                            <div className="flex items-center gap-10">
              { /*  <button onClick={toggleShuffle} className={`transition-all active:scale-90 ${isShuffle ? 'text-[#1db954]' : 'text-white/50 hover:text-white'}`}><IoShuffle size={22} /></button> */} 
                                <button onClick={previousSong} className="text-white hover:text-white/80 active:scale-90 transition-transform"><IoPlaySkipBackSharp size={32} /></button>
                                <button onClick={togglePlayPause} className="w-14 h-14 bg-white rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-transform text-black shadow-lg">
                                    {isPlaying ? <IoPauseSharp size={28} /> : <IoPlaySharp size={28} className="ml-1" />}
                                </button>
                                <button onClick={nextSong} className="text-white hover:text-white/80 active:scale-90 transition-transform"><IoPlaySkipForwardSharp size={32} /></button>
                                


                               {/* <button onClick={toggleRepeat} className={`transition-all relative active:scale-90 ${repeatMode !== 'off' ? 'text-[#1db954]' : 'text-white/50 hover:text-white'}`}>
                                    <IoRepeat size={22} />
                                   {repeatMode === 'one' && <span className="absolute -top-1 -right-1 text-[9px] font-bold bg-[#1db954] text-black rounded-full w-3.5 h-3.5 flex items-center justify-center">1</span>}
                                </button> */}
                            </div>




                            <div className="w-full flex items-center gap-4 group">
                                <motion.span className="text-xs text-white/40 w-10 text-right font-mono">{displayTimeText}</motion.span>
                                <div className="relative flex-1 h-1.5 bg-white/20 rounded-full cursor-pointer group-hover:h-2 transition-all">
                                    <motion.div className="absolute h-full bg-white rounded-full" style={{ width: displayWidth, willChange: 'width' }} />
                                    <motion.input type="range" min="0" max={duration || 100} step="0.01" value={isScrubbing ? localProgress : currentTimeMotion} onChange={(e) => { setIsScrubbing(true); setLocalProgress(parseFloat(e.target.value)); seek(parseFloat(e.target.value)); }} onMouseUp={() => setIsScrubbing(false)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                </div>
                                <span className="text-xs text-white/40 w-10 font-mono">{formatTime(duration)}</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-6 w-[25%]">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleToggleVox}
                                    disabled={voxLoading}
                                    className={`text-white/60 hover:text-white transition-all active:scale-90 ${voxLoading ? 'opacity-30 animate-pulse' : voxMode ? 'text-[#1db954]' : ''}`}
                                >
                                    <IoMic size={24} />
                                </button>
                                <button
                                    onClick={handleToggleVoxType}
                                    disabled={voxLoading}
                                    className={`text-white/50 hover:text-white text-[13px] font-bold px-2 py-1 rounded-md active:scale-95 transition-all ${voxLoading ? 'opacity-30' : voxType === 'vocals' ? 'bg-white/10 text-white' : ''}`}
                                >
                                    {voxLoading ? '...' : voxType === 'vocals' ? 'V' : 'K'}
                                </button>
                            </div>
                            <button onClick={() => setViewMode(viewMode === 'queue' ? 'cover' : 'queue')} className={`text-white/60 hover:text-white transition-colors active:scale-90 ${viewMode === 'queue' ? 'text-[#1db954]' : ''}`}><IoList size={24} /></button>
                            <div className="flex items-center gap-3 w-32 group">
                                <IoVolumeHigh size={20} className="text-white/60" />
                                <div className="h-1.5 flex-1 bg-white/20 rounded-full cursor-pointer relative transition-all group-hover:h-2">
                                    <div className="absolute h-full bg-white rounded-full" style={{ width: `${volume * 100}%` }} />
                                    <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => changeVolume(parseFloat(e.target.value))} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (


                // ================= MOBILE LAYOUT (<1024px) - NIVEL SENIOR ================= por lo menos eso lo dice cluade
                
                <div
                    className="relative z-10 flex flex-col h-full w-full mx-auto px-6 pt-10 pb-6"
                >


                    {/* Header (Cerrar) */}
<div className="flex items-center justify-center mb-8 shrink-0 relative z-50">
    <button
        onClick={closeFullScreenPlayer}
        className="group flex flex-col items-center justify-center w-20 h-16 transition-all active:scale-95 cursor-pointer gap-0"
    >
        {/* Flecha Superior */}
        <div className="w-6 h-6 border-b-[6px] border-r-[6px] border-white/40 rotate-45 rounded-sm group-hover:border-white/80 transition-all duration-200 mb-0" />
        
 
              </button>
</div>
                {/* Portada del Álbum (Arte) */}
<div className="w-full flex justify-center items-center mb-10 mt-0 shrink-0 relative px-6">
    {/* w-full (móvil) 
       md:w-[400px] (tablet - tamaño fijo elegante)
       md:h-[400px] 
    */}
    <div className="relative w-full aspect-square max-w-[500px] md:max-w-[500px] mb-10 shadow-2xl">
        <div className="absolute inset-0 opacity-60 blur-2xl -z-10 transform scale-95 translate-y-6" style={{ background: dominantColor }} />
        
        <img
            src={getCoverSrc(currentSong, true)}
            alt={currentSong?.trackName}
            className="w-full h-full object-cover"
            onError={(e) => { e.currentTarget.src = '/default-album.png'; }}
        />
    </div>
</div>

                    {/* Metadatos (Títulos) y Acciones Primarias */}
                    <div className="flex justify-between items-center mb-8 shrink-0 w-full  relative z-20">
                        <div className="flex-1 min-w-0 pr-4 text-left overflow-hidden">
                            {/* Corrección del efecto fantasma (Marquee) */}
                            <div className="w-full overflow-hidden" style={{ maskImage: 'linear-gradient(to right, black 80%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to right, black 80%, transparent 100%)' }}>
                                <div className={`flex w-max font-[800] ${currentSong?.trackName?.length > 17 || currentSong?.titulo?.length > 17 ? 'animate-marquee' : ''}`}>
                                    
          {/* Titulo duplicado para el efecto de scroll infinito */}

              <h1 className="text-[24px] font-[800] text-white leading-tight tracking-tight whitespace-nowrap pr-10 shrink-0">
                                        {currentSong?.trackName || currentSong?.titulo || "Unknown Title"}
                                    </h1>
                                    {(currentSong?.trackName?.length > 17 || currentSong?.titulo?.length > 17) && (
                                        <h1 className="text-[26px] font-[800] text-white leading-tight tracking-tight whitespace-nowrap pr-10 shrink-0">
                                            {currentSong?.trackName || currentSong?.titulo || "Unknown Title"}
                                        </h1>
                                    )}
                                </div>
                            </div>
                            <h2 className="text-[18px] font-[400] text-white/60 mt-0.5 truncate tracking-wide">
                                {currentSong?.artistName || currentSong?.artista || "Unknown Artist"}
                            </h2>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/5 backdrop-blur-md text-white/80 active:scale-90 transition-transform">
                                <LikeButton song={currentSong} isLiked={isLiked} onLikeToggle={handleLikeToggle} iconSize={20} isArchive={currentSong?.source === 'internet_archive' || !!currentSong?.identifier} />
                            </div>
                            <button
                                onClick={() => setShowOptions(!showOptions)}
                                className={`flex items-center justify-center w-10 h-10 rounded-full bg-white/5 backdrop-blur-md text-white/80 active:scale-90 transition-all ${showOptions ? 'bg-white/20 text-white' : ''}`}
                            >
                                <IoEllipsisHorizontal size={22} />
                            </button>
                        </div>
                    </div>

                    {/* Barra de Progreso (Scrubber) - ¡SOLUCIÓN DE ARRASTRE AQUÍ! */}
                    <div
                        className="mb-8 w-full group shrink-0 relative z-20"
                        onPointerDown={(e) => e.stopPropagation()} // Aísla el toque para que no mueva la pantalla
                    >
                        <div className="relative w-full h-8 flex items-center cursor-pointer">
                            <motion.input type="range" min="0" max={duration || 100} step="0.01" value={isScrubbing ? localProgress : currentTimeMotion} onChange={(e) => { setIsScrubbing(true); setLocalProgress(parseFloat(e.target.value)); seek(parseFloat(e.target.value)); }} onMouseUp={() => setIsScrubbing(false)} onTouchEnd={() => setIsScrubbing(false)} className="absolute z-20 opacity-0 w-full h-full cursor-pointer" />
                            <div className="absolute w-full h-[4px] bg-white/20 rounded-full overflow-hidden pointer-events-none">
                                <motion.div className="h-full bg-white rounded-full" style={{ width: displayWidth, willChange: 'width' }} />
                            </div>

                           { /* {/* PLAYER BAR y el circuluto*/}
                           
                           <motion.div className=" shadow-md pointer-events-none transition-transform duration-100" style={{ left: displayWidth, transform: 'translateX(-50%)', willChange: 'left' }} />
                       
                       </div>  


                        <div className="flex justify-between text-[12px] font-medium text-white/50 font-mono -mt-1 tracking-widest opacity-80">
                            <motion.span>{displayTimeText}</motion.span>
                            <motion.span>{displayRemainingText}</motion.span>
                        </div>
                    </div>

                    {/* Controles de Reproducción Principales */}
                    <div className="mt-0 flex flex-col items-center w-full pb-2 relative z-20">
                        <div className="flex items-center justify-between gap-2 mb-0 w-[90%] max-w-[320px]">
                          
                         {/* <button onClick={toggleShuffle} className={`transition-all active:scale-90 p-2 ${isShuffle ? 'text-[#1db954]' : 'text-white/50 hover:text-white'}`}>
                                <IoShuffle size={26} />
                            </button> REFACTORIZAR  PARA DAR UN ESTILO PREMIUM*/}

                            <button onClick={previousSong} className="text-white hover:text-white/80 active:scale-75 transition-all p-2"><IoPlaySkipBackSharp size={40} /></button>
                            <button onClick={togglePlayPause} className="w-[72px] h-[72px] rounded-full bg-white flex items-center justify-center shadow-lg active:scale-90 transition-all text-black">

                                {isPlaying ? <IoPauseSharp size={34} /> : <IoPlaySharp size={34} className="ml-1.5" />}
                            </button>
                            <button onClick={nextSong} className="text-white hover:text-white/80 active:scale-75 transition-all p-2"><IoPlaySkipForwardSharp size={40} /></button>
                           

                         {/*  <button onClick={toggleRepeat} className={`transition-all relative active:scale-90 p-2 ${repeatMode !== 'off' ? 'text-[#1db954]' : 'text-white/50 hover:text-white'}`}>
                                <IoRepeat size={26} />
                                {repeatMode === 'one' && <span className="absolute top-1 right-1 text-[9px] font-bold bg-[#1db954] text-black rounded-full w-3.5 h-3.5 flex items-center justify-center">1</span>}
                           
                           </button> IMPLEMENTARLOS ABAJO DE LA PLAYER BAR SIGUIENDO PROPORCIONES CORRECTAMENTE PARA EL HUMANO*/}
                        

                        </div>

                        {/* Controles Secundarios (Barra Inferior) */}
                        
                        <div className="w-full flex items-center justify-between px-4  mt-3 text-white/50">
                            <button onClick={() => setViewMode(viewMode === 'lyrics' ? 'cover' : 'lyrics')} className={`transition-colors active:scale-90 p-2 ${viewMode === 'lyrics' ? 'text-[#1db954]' : 'hover:text-white'}`}>
                                <IoText size={24} />
                            </button>  


                                <p className="w-full flex items-center justify-center px-4"> BETA </p>


                            <button onClick={() => setViewMode(viewMode === 'queue' ? 'cover' : 'queue')} className={`transition-colors active:scale-90 p-2 ${viewMode === 'queue' ? 'text-[#1db954]' : 'hover:text-white'}`}>
                                <IoList size={24} />
                            </button>
                        </div>
                    </div>





                    {/* Modales Overlay (Lyrics/Queue) */}
                    {viewMode === 'lyrics' && (
                        <div className="absolute inset-0 z-50 bg-[#050505]/95 backdrop-blur-3xl animate-fade-in pt-16 px-6 touch-auto" onPointerDown={(e) => e.stopPropagation()}>
                            <button onClick={() => setViewMode('cover')} className="absolute top-6 right-6 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white active:scale-90 z-[60]">
                                <IoChevronDown size={24} />
                            </button>
                            <h2 className="absolute top-8 left-6 text-2xl font-bold text-white z-[60]">Letras</h2>
                            <div className="h-full w-full overflow-y-auto no-scrollbar pt-10">
                                {lyricsLoading ? (
                                    <div className="flex items-center justify-center h-full w-full text-white/50">Cargando letras sincronizadas...</div>
                                ) : lyricsError ? (
                                    <div className="flex items-center justify-center h-full w-full text-white/50">Letras no disponibles aún</div>
                                ) : (
                                    <KaraokeView lyricsPayload={lyricsData} />
                                )}
                            </div>
                        </div>
                    )}

                    {viewMode === 'queue' && (
                        <div className="absolute inset-0 z-50 bg-[#050505]/95 backdrop-blur-3xl animate-fade-in pt-16 px-6 touch-auto" onPointerDown={(e) => e.stopPropagation()}>
                            <button onClick={() => setViewMode('cover')} className="absolute top-6 right-6 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white active:scale-90 z-[60]">
                                <IoChevronDown size={24} />
                            </button>
                            <h2 className="absolute top-8 left-6 text-2xl font-bold text-white tracking-tight z-[60]">Cola</h2>
                            <div className="h-full w-full overflow-y-auto no-scrollbar text-white/60 pt-4">
                                {originalQueue && originalQueue.length > 0 ? (
                                    <div className="py-2 space-y-3.1">
                                        {originalQueue.map((s, idx) => (
                                            <div key={s.id || idx} className={`flex items-center justify-between p-3 rounded-xl transition-all ${idx === currentIndex ? 'bg-white/10' : 'bg-transparent'}`}>
                                             <div className="flex items-center gap-3 min-w-0">
  {idx === currentIndex && isPlaying ? (
    <div
      className="flex items-end justify-center gap-[3px] w-5 h-5 shrink-0"
      aria-label="Reproduciendo ahora"
    >
      <span className="audio-bar audio-bar-1" />
      <span className="audio-bar audio-bar-2" />
      <span className="audio-bar audio-bar-3" />
      <span className="audio-bar audio-bar-4" />
    </div>
  ) : (
    <button
      onClick={() => { playAt(idx); setViewMode('cover'); }}
      className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 active:scale-90 shrink-0 transition-all"
    >
      <IoPlaySharp size={13} />
    </button>
  )}

                                                    <div className="min-w-0">
                                                        <div className={`font-semibold truncate text-[16px] ${idx === currentIndex ? 'text-[#1db954]' : 'text-white'}`}>{s.trackName || s.titulo || s.title || 'Como diste con esto?'}</div>
                                                        <div className="text-[14px] text-white/50 truncate">{s.artistName || s.artista || s.artist || ''}</div>
                                                    </div>
                                                </div>
                                                <div className="text-xs text-white/30 font-mono ml-2 shrink-0">{(s.durationInSeconds || s.duracion) ? new Date(((s.durationInSeconds || s.duracion) || 0) * 1000).toISOString().substr(14, 5) : ''}</div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <p className="text-white/40">La cola está vacía</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Options Menu Overlay — z-[200] to float above lyrics/queue modals */}
            <AnimatePresence>
                {showOptions && (
                    <>
                        {/* Backdrop to close on outside tap */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-[199]"
                            onClick={() => setShowOptions(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            transition={{ duration: 0.15, ease: "easeOut" }}
                            className="absolute bottom-24 right-6 z-[200] bg-[#1a1a1a]/95 border border-white/10 rounded-2xl p-2 w-[220px] shadow-[0_20px_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl"
                        >
                            <button onClick={() => handleNavigation('artist')} className="flex items-center gap-3 w-full p-3 hover:bg-white/10 active:bg-white/20 rounded-xl transition-colors text-white/90 text-[16px] font-medium">
                                <IoPersonSharp className="text-white/40" /> Ir al Artista
                            </button>
                            <button onClick={() => handleNavigation('album')} className="flex items-center gap-3 w-full p-3 hover:bg-white/10 active:bg-white/20 rounded-xl transition-colors text-white/90 text-[16px] font-medium">
                                <IoDisc className="text-white/40" /> Ir al Álbum
                            </button>
                            <div className="h-[1px] bg-white/10 my-1" />
                            <button onClick={() => setShowOptions(false)} className="flex items-center justify-center w-full p-3 text-red-400 font-semibold text-[16px] hover:bg-white/5 active:bg-white/10 rounded-xl transition-colors">
                                Cerrar
                            </button>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </ContainerTag>
    );
}
