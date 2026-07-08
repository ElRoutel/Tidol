import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import { usePlayerState, usePlayerProgress, usePlayer } from '../context/PlayerContext';
import {
    IoChevronDown, IoPlaySharp, IoPauseSharp, IoPlaySkipBackSharp,
    IoPlaySkipForwardSharp, IoEllipsisHorizontal, IoVolumeHigh, IoVolumeLow,
    IoText, IoList, IoDisc, IoPersonSharp, IoHeart, IoHeartOutline
} from 'react-icons/io5';
import KaraokeView from './KaraokeView';
import { motion, useTransform, AnimatePresence } from 'framer-motion';
import { getCoverSrc } from '../utils/coverArt';
import './FullScreenPlayer.css';

// Acento por pista: versión aclarada del color dominante de la portada.
// El chrome de la app es acromático; solo la música lo colorea.
const lighten = (hex, amt = 0.5) => {
    if (!hex || !/^#([0-9a-fA-F]{6})$/.test(hex)) return '#cfcfda';
    const n = parseInt(hex.slice(1), 16);
    const mix = (c) => Math.round(c + (255 - c) * amt);
    return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
};

const formatTime = (time) => {
    if (!time || isNaN(time) || time < 0) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const trackDuration = (s) =>
    s?.durationInSeconds || s?.duracion || s?.duration || 0;

// Barras de ecualizador de la fila "sonando ahora" (color de acento por pista).
function EqBars({ accent, paused }) {
    return (
        <div className="flex items-end gap-[2.5px] h-4 shrink-0" aria-label="Reproduciendo ahora">
            {[0, 1, 2, 3].map(i => (
                <span key={i} className={`fsp-eq ${paused ? 'fsp-eq--paused' : ''}`} style={{ background: accent }} />
            ))}
        </div>
    );
}

// Fila de la cola (compartida móvil/desktop).
function QueueRow({ song, isCurrent, isPlaying, accent, onPlay }) {
    return (
        <button
            onClick={onPlay}
            className={`flex items-center gap-3.5 w-full p-2.5 rounded-xl text-left transition-colors ${isCurrent ? 'bg-white/[0.08]' : 'hover:bg-white/[0.05] active:bg-white/[0.08]'}`}
        >
            <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0 relative bg-white/5">
                <img
                    src={getCoverSrc(song, true)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    onError={(e) => { e.currentTarget.src = '/default-album.png'; }}
                    className="w-full h-full object-cover"
                />
                <div className="fsp-art-gloss" />
            </div>
            <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold truncate" style={{ color: isCurrent ? accent : '#fff' }}>
                    {song.trackName || song.titulo || song.title || 'Sin título'}
                </div>
                <div className="text-[13px] text-white/50 truncate">
                    {song.artistName || song.artista || song.artist || ''}
                </div>
            </div>
            {isCurrent ? (
                <EqBars accent={accent} paused={!isPlaying} />
            ) : (
                trackDuration(song) > 0 && (
                    <span className="text-xs text-white/35 shrink-0" style={{ fontFeatureSettings: "'tnum'" }}>
                        {formatTime(trackDuration(song))}
                    </span>
                )
            )}
        </button>
    );
}

export default function FullScreenPlayer({ isEmbedded = false }) {
    const { currentSong, isPlaying, isFullScreenOpen, volume, originalQueue, currentIndex } = usePlayerState();

    const {
        togglePlayPause, nextSong, previousSong,
        seek, changeVolume,
        closeFullScreenPlayer, toggleLike, isSongLiked, playAt
    } = usePlayer();

    const { currentTimeMotion, progressMotion, duration } = usePlayerProgress();

    const [viewMode, setViewMode] = useState('cover'); // 'cover' | 'lyrics' | 'queue'
    const [showOptions, setShowOptions] = useState(false);
    const [isScrubbing, setIsScrubbing] = useState(false);
    const [localProgress, setLocalProgress] = useState(0);
    const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
    const [mounted, setMounted] = useState(false);
    const navigate = useNavigate();

    // Físicas de arrastre: desliza hacia abajo para cerrar, hacia arriba abre la cola.
    const handleDragEnd = (event, info) => {
        if (info.offset.y > 80 || info.velocity.y > 300) {
            closeFullScreenPlayer();
        } else if (info.offset.y < -80 && viewMode === 'cover') {
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
        // Flag de cancelación: al cambiar rápido de pista quedaban dos requests en
        // vuelo y la respuesta MÁS LENTA (letra de la canción anterior) podía
        // pisar a la correcta.
        let cancelled = false;
        // El id canónico puede venir en `id` (álbum/normalizeTrackList) o solo en
        // `trackId` (Home "Volver a escuchar"/normalizeToUnifiedTrack).
        const mbid = currentSong?.id || currentSong?.trackId;
        if (mbid) {
            setViewMode('cover');
            // Limpiar SIEMPRE la letra anterior al cambiar de pista: si el fetch
            // nuevo falla o se retrasa, la letra de la canción previa no debe
            // quedarse en pantalla (bug: A terminaba, sonaba B, seguía la letra de A).
            setLyricsData(null);
            setLyricsError(false);
            if (isFullScreenOpen) {
                setLyricsLoading(true);
                api.get(`/lyrics/${mbid}`)
                    .then(res => {
                        if (cancelled) return;
                        const data = res.data;
                        if (data && data.type && data.lines) {
                            setLyricsData(data);
                        } else {
                            setLyricsData(null);
                        }
                    })
                    .catch(error => {
                        if (cancelled) return;
                        if (error.response && (error.response.status === 404 || error.response.status === 401)) {
                            // 404: la letra no existe o está procesándose. 401: sesión expirada.
                            setLyricsData(null);
                        } else {
                            console.error('[FullScreenPlayer] Error real en letras:', error.message);
                            setLyricsError(true);
                            setLyricsData(null);
                        }
                    })
                    .finally(() => {
                        if (!cancelled) setLyricsLoading(false);
                    });
            }
        }
        return () => { cancelled = true; };
    }, [currentSong?.id, currentSong?.trackId, isFullScreenOpen]);

    useEffect(() => {
        if (isEmbedded) {
            setMounted(isFullScreenOpen);
            if (!isFullScreenOpen) setViewMode('cover');
        } else {
            setMounted(true);
        }
    }, [isEmbedded, isFullScreenOpen]);

    // Duotono por pista + acento derivado.
    const dominantColor = currentSong?.extractedColors?.dominant || '#3b3b4f';
    const secondaryColor = currentSong?.extractedColors?.secondary || '#101014';
    const accent = lighten(dominantColor, 0.5);

    const formattedTime = useTransform(currentTimeMotion, t => formatTime(t));
    const formattedRemaining = useTransform(currentTimeMotion, t => `-${formatTime(duration - t)}`);
    const progressPercent = useTransform(progressMotion, p => `${p || 0}%`);

    const displayTimeText = isScrubbing ? formatTime(localProgress) : formattedTime;
    const displayRemainingText = isScrubbing ? `-${formatTime(duration - localProgress)}` : formattedRemaining;
    const displayWidth = isScrubbing ? `${duration > 0 ? (localProgress / duration) * 100 : 0}%` : progressPercent;

    const songTitle = currentSong?.trackName || currentSong?.titulo || currentSong?.title || 'Sin título';
    const songArtist = currentSong?.artistName || currentSong?.artista || currentSong?.artist || 'Artista desconocido';
    const longTitle = songTitle.length > (isDesktop ? 26 : 17);

    const isLiked = currentSong ? isSongLiked(currentSong.id) : false;
    const handleLikeToggle = () => {
        if (currentSong) toggleLike(currentSong.id || currentSong.identifier, currentSong);
    };

    const ContainerTag = isEmbedded ? 'div' : motion.div;
    const canDrag = !isDesktop && viewMode === 'cover';

    const dragProps = isEmbedded ? {} : {
        drag: canDrag ? 'y' : false,
        dragConstraints: { top: 0, bottom: 0 },
        dragElastic: { top: 0.025, bottom: 0.8 },
        dragSnapToOrigin: true, 
        animate: { y: 0 }, 
        onDragEnd: handleDragEnd
    
    };

    const handleNavigation = (type) => {
        if (!currentSong) return;
        setShowOptions(false);
        const query = type === 'artist' ? songArtist : currentSong.album;
        const isIA = currentSong.source === 'internet_archive' || !!currentSong.identifier;

        if (isIA) {
            navigate(`/search?q=${encodeURIComponent(query)}&source=ia`);
        } else if (type === 'artist' && currentSong.artistId) {
            navigate(`/artist/${currentSong.artistId}`);
        } else if (type === 'album' && currentSong.albumId) {
            navigate(`/album/${currentSong.albumId}`);
        } else {
            navigate(`/search?q=${encodeURIComponent(query || songArtist)}`);
        }
        closeFullScreenPlayer();
    };

    if (!isFullScreenOpen && isEmbedded && !mounted) return null;
    if (!isFullScreenOpen && !isEmbedded) return null;

    // ── piezas compartidas ──────────────────────────────────────────────────

  const scrubberProps = {
    type: 'range', 
    min: 0, 
    max: duration || 100, 
    step: 0.01,
    value: isScrubbing ? localProgress : (currentTimeMotion.get() || 0),
    onPointerDown: (e) => {
        // Bloqueo absoluto: detiene la burbuja en React y los listeners nativos de Framer
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation(); 

        setLocalProgress(currentTimeMotion.get() || 0);
        setIsScrubbing(true);
    },
    onChange: (e) => setLocalProgress(parseFloat(e.target.value)),
    onPointerUp: (e) => { seek(parseFloat(e.target.value)); setIsScrubbing(false); },
    onPointerCancel: () => setIsScrubbing(false),
    'aria-label': 'Posición de la canción',
};

    const HeartIcon = isLiked ? IoHeart : IoHeartOutline;

    const queuePanel = (
        <div className="flex flex-col gap-0.5">
            {originalQueue && originalQueue.length > 0 ? (
                originalQueue.map((s, idx) => (
                    <QueueRow
                        key={s.id || s.trackId || idx}
                        song={s}
                        isCurrent={idx === currentIndex}
                        isPlaying={isPlaying}
                        accent={accent}
                        onPlay={() => { playAt(idx); setViewMode('cover'); }}
                    />
                ))
            ) : (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                    <p className="text-white/45 text-[15px]">La cola está vacía</p>
                    <p className="text-white/30 text-[13px] mt-1">Reproduce algo desde Inicio o Buscar</p>
                </div>
            )}
        </div>
    );

    const lyricsPanel = lyricsLoading ? (
        <div className="flex items-center justify-center h-full w-full text-white/50 text-[15px]">Cargando letra…</div>
    ) : lyricsError ? (
        <div className="flex flex-col items-center justify-center h-full w-full text-center">
            <p className="text-white/50 text-[15px]">La letra no está disponible ahora</p>
            <p className="text-white/30 text-[13px] mt-1">Vuelve a intentarlo en un momento</p>
        </div>
    ) : (
        <KaraokeView lyricsPayload={lyricsData} accent={accent} />
    );

    const optionsMenu = (
        <AnimatePresence>
            {showOptions && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="absolute inset-0 z-[199]"
                        onClick={() => setShowOptions(false)}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className="absolute bottom-28 right-6 z-[200] w-[232px] rounded-2xl p-1.5 border border-white/10 shadow-[0_24px_50px_rgba(0,0,0,.5)]"
                        style={{ background: 'rgba(28,28,30,.86)', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)' }}
                    >
                        <button onClick={() => handleNavigation('artist')} className="flex items-center gap-3.5 w-full px-3.5 py-3 rounded-xl text-white text-[15px] font-medium hover:bg-white/10 active:bg-white/15 transition-colors">
                            <IoPersonSharp className="text-white/50" size={18} /> Ir al artista
                        </button>
                        <button onClick={() => handleNavigation('album')} className="flex items-center gap-3.5 w-full px-3.5 py-3 rounded-xl text-white text-[15px] font-medium hover:bg-white/10 active:bg-white/15 transition-colors">
                            <IoDisc className="text-white/50" size={18} /> Ir al álbum
                        </button>
                        <div className="h-px bg-white/10 my-1 mx-2" />
                        <button onClick={() => setShowOptions(false)} className="flex items-center justify-center w-full px-3.5 py-3 rounded-xl text-red-400 text-[15px] font-semibold hover:bg-white/5 transition-colors">
                            Cerrar
                        </button>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );

    return (
        <ContainerTag
            {...dragProps}
            className={`fsp-container fixed inset-0 z-[99999] flex flex-col overflow-hidden bg-[#050505] font-sans select-none ${isEmbedded ? 'pointer-events-auto' : ''}`}
        >
            {/* Fondo: orbes de color que derivan + oscurecimiento hacia los controles */}
            <div className="absolute inset-0 z-0 bg-[#050505]" />
            <div
                className="fsp-orb fsp-orb-1"
                style={{
                    top: '-12%', left: '-14%', width: isDesktop ? '55%' : '78%', height: isDesktop ? '80%' : '58%',
                    filter: `blur(${isDesktop ? 90 : 70}px)`, opacity: 0.8, background: dominantColor
                }}
            />
            <div
                className="fsp-orb fsp-orb-2"
                style={{
                    bottom: isDesktop ? '-15%' : '2%', right: '-16%', width: isDesktop ? '60%' : '82%', height: isDesktop ? '85%' : '62%',
                    filter: `blur(${isDesktop ? 100 : 78}px)`, opacity: 0.75, background: secondaryColor
                }}
            />
            <div
                className="absolute inset-0 z-0 pointer-events-none"
                style={{
                    background: isDesktop
                        ? 'linear-gradient(to bottom, rgba(5,5,5,0) 55%, rgba(5,5,5,.88) 100%)'
                        : 'linear-gradient(to bottom, rgba(5,5,5,.35) 0%, rgba(5,5,5,0) 22%, rgba(5,5,5,0) 55%, rgba(5,5,5,.82) 100%)'
                }}
            />

            {isDesktop ? (
                // ═══════════════ DESKTOP (≥1024px) ═══════════════
                <div className="relative z-10 w-full h-full grid grid-cols-[44%_56%]">
                    {/* Izquierda: portada + identidad */}
                    <div className="h-full flex flex-col items-center justify-center relative px-[4vw]">
                        <button
                            onClick={closeFullScreenPlayer}
                            className="absolute top-8 left-8 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all active:scale-90"
                            aria-label="Cerrar reproductor"
                        >
                            <IoChevronDown size={24} />
                        </button>

                        <div
                            className="fsp-art aspect-square"
                            style={{ width: 'min(32vw, 560px)', transform: isPlaying ? 'scale(1)' : 'scale(0.86)' }}
                        >
                            <div className="relative w-full h-full rounded-[18px] overflow-hidden shadow-[0_40px_80px_-20px_rgba(0,0,0,.7)]">
                                <img
                                    src={getCoverSrc(currentSong, true)}
                                    alt={songTitle}
                                    className="w-full h-full object-cover"
                                    onError={(e) => { e.currentTarget.src = '/default-album.png'; }}
                                />
                                <div className="fsp-art-gloss" />
                            </div>
                        </div>

                        <div className="mt-7 flex items-center gap-4" style={{ width: 'min(32vw, 560px)' }}>
                            <div className="min-w-0 flex-1">
                                <div className="text-[26px] font-bold tracking-[-.4px] text-white truncate">{songTitle}</div>
                                <button
                                    onClick={() => handleNavigation('artist')}
                                    className="block text-[19px] font-normal mt-0.5 truncate max-w-full hover:underline"
                                    style={{ color: accent }}
                                >
                                    {songArtist}
                                </button>
                            </div>
                            <button
                                onClick={handleLikeToggle}
                                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all active:scale-90 shrink-0"
                                style={{ color: isLiked ? accent : '#fff' }}
                                aria-label={isLiked ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                            >
                                <HeartIcon size={19} />
                            </button>
                        </div>
                    </div>

                    {/* Derecha: tabs Letra / Cola */}
                    <div className="h-full flex flex-col min-h-0">
                        <div className="flex gap-2 pt-8 pr-12 pl-2 flex-none">
                            {[['lyrics', 'Letra'], ['queue', 'Cola']].map(([mode, label]) => {
                                const active = mode === 'queue' ? viewMode === 'queue' : viewMode !== 'queue';
                                return (
                                    <button
                                        key={mode}
                                        onClick={() => setViewMode(mode === 'queue' ? (viewMode === 'queue' ? 'cover' : 'queue') : 'cover')}
                                        className={`px-[18px] py-[7px] rounded-full text-[15px] font-semibold transition-colors ${active ? 'bg-white/[0.14] text-white' : 'text-white/45 hover:text-white/70'}`}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="no-scrollbar flex-1 overflow-y-auto overscroll-contain pt-6 pr-12 pl-2 pb-40 min-h-0">
                            {viewMode === 'queue' ? queuePanel : lyricsPanel}
                        </div>
                    </div>

                    {/* Barra de control inferior */}
                    <div
                        className="absolute bottom-0 left-0 right-0 z-50 h-28 grid grid-cols-[1fr_auto_1fr] items-center px-12"
                        style={{
                            background: 'linear-gradient(to top, rgba(5,5,5,.9), rgba(5,5,5,0))',
                            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)'
                        }}
                    >
                        {/* Izquierda: vacío a propósito (la identidad vive bajo la portada;
                            mantiene la cuadrícula 1fr-auto-1fr centrando el transporte) */}
                        <div />

                        {/* Centro: transporte + progreso */}
                        <div className="flex flex-col items-center gap-2 w-[560px]">
                            <div className="flex items-center gap-9 text-white">
                                <button onClick={previousSong} className="hover:text-white/80 active:scale-90 transition-transform" aria-label="Anterior">
                                    <IoPlaySkipBackSharp size={28} />
                                </button>
                                <button
                                    onClick={togglePlayPause}
                                    className="w-[52px] h-[52px] rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-lg"
                                    aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
                                >
                                    {isPlaying ? <IoPauseSharp size={26} /> : <IoPlaySharp size={26} className="ml-0.5" />}
                                </button>
                                <button onClick={nextSong} className="hover:text-white/80 active:scale-90 transition-transform" aria-label="Siguiente">
                                    <IoPlaySkipForwardSharp size={28} />
                                </button>
                            </div>
                            <div className="flex items-center gap-3 w-full group">
                                <motion.span className="text-xs text-white/45 w-10 text-right" style={{ fontFeatureSettings: "'tnum'" }}>
                                    {displayTimeText}
                                </motion.span>
                                <div className="relative flex-1 h-3 flex items-center">
                                    <div className="absolute left-0 right-0 h-[5px] rounded-[3px] bg-white/20 overflow-hidden">
                                        <motion.div className="h-full rounded-[3px] bg-white/85" style={{ width: displayWidth, willChange: 'width' }} />
                                    </div>
                                    <input {...scrubberProps} className="fsp-range absolute inset-0 w-full h-full" />
                                </div>
                                <span className="text-xs text-white/45 w-10" style={{ fontFeatureSettings: "'tnum'" }}>{formatTime(duration)}</span>
                            </div>
                        </div>

                        {/* Derecha: cola + volumen */}
                        <div className="flex items-center justify-end gap-5">
                            <button
                                onClick={() => setViewMode(viewMode === 'queue' ? 'cover' : 'queue')}
                                className="transition-colors active:scale-90"
                                style={{ color: viewMode === 'queue' ? accent : 'rgba(255,255,255,.55)' }}
                                aria-label="Cola de reproducción"
                            >
                                <IoList size={24} />
                            </button>
                            <div className="flex items-center gap-2.5 w-[130px] text-white/60">
                                <IoVolumeHigh size={18} />
                                <div className="relative flex-1 h-3 flex items-center">
                                    <div className="absolute left-0 right-0 h-[5px] rounded-[3px] bg-white/20 overflow-hidden">
                                        <div className="h-full rounded-[3px] bg-white/75" style={{ width: `${volume * 100}%` }} />
                                    </div>
                                    <input
                                        type="range" min="0" max="1" step="0.01" value={volume}
                                        onChange={(e) => changeVolume(parseFloat(e.target.value))}
                                        className="fsp-range absolute inset-0 w-full h-full"
                                        aria-label="Volumen"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                // ═══════════════ MOBILE (<1024px) ═══════════════
                <div className="relative z-10 flex flex-col h-full w-full px-[26px] pt-safe-top">

                    {/* Grabber */}
<div className="flex justify-center pt-3 pb-4 flex-none">
    <button
        onClick={closeFullScreenPlayer}
        // w-16 h-12 da un área táctil generosa de 64x48px
        className="group w-16 h-12 flex items-center justify-center focus:outline-none touch-manipulation"
        aria-label="Cerrar reproductor"
    >
        <span 
            className="w-[38px] h-[5px] rounded-full bg-white/35 transition-colors 
                       group-active:bg-white/65 group-hover:bg-white/50 
                       group-focus-visible:ring-2 group-focus-visible:ring-white/50 group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-black" 
        />
    </button>
</div>
                    {/* Portada que respira — arriba, pegada al grabber (estilo Apple Music) */}
                    <div className="flex-none flex justify-center pt-2">
                        <div
                            className="fsp-art w-full max-w-[400px] aspect-square"
                            style={{ transform: isPlaying ? 'scale(1)' : 'scale(0.84)' }}
                        >
                            <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-[0_28px_60px_-12px_rgba(0,0,0,.6)]">
                                <img
                                    src={getCoverSrc(currentSong, true)}
                                    alt={songTitle}
                                    className="w-full h-full object-cover"
                                    onError={(e) => { e.currentTarget.src = '/default-album.png'; }}
                                />
                                <div className="fsp-art-gloss" />
                            </div>
                        </div>
                    </div>

                    {/* Espaciadores 3:2: el hueco mayor queda entre arte y título,
                        pero los controles suben respecto al borde inferior */}
                    <div className="flex-[3] min-h-4" />

                    {/* Título + acciones */}
                    <div className="flex items-center justify-between gap-3.5 flex-none">
                        <div className="min-w-0 flex-1">
                            <div
                                className="overflow-hidden"
                                style={(() => {
                                    // Con marquee activo se desvanecen ambos bordes (el duplicado
                                    // entra por la izquierda); estático, solo el derecho.
                                    const mask = longTitle
                                        ? 'linear-gradient(to right, transparent 0, #000 5%, #000 86%, transparent)'
                                        : 'linear-gradient(to right, #000 86%, transparent)';
                                    return { maskImage: mask, WebkitMaskImage: mask };
                                })()}
                            >
                                <div className={`flex w-max ${longTitle ? 'animate-marquee' : ''}`}>
                                    <span className="text-[23px] font-bold tracking-[-.3px] text-white whitespace-nowrap pr-11">{songTitle}</span>
                                    {longTitle && (
                                        <span className="text-[23px] font-bold tracking-[-.3px] text-white whitespace-nowrap pr-11">{songTitle}</span>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => handleNavigation('artist')}
                                className="block text-[18px] font-normal mt-px truncate max-w-full"
                                style={{ color: accent }}
                            >
                                {songArtist}
                            </button>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0">
                            <button
                                onClick={handleLikeToggle}
                                className="w-[38px] h-[38px] rounded-full bg-white/10 flex items-center justify-center transition-all active:scale-90"
                                style={{ color: isLiked ? accent : '#fff' }}
                                aria-label={isLiked ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                            >
                                <HeartIcon size={20} />
                            </button>
                            <button
                                onClick={() => setShowOptions(!showOptions)}
                                className={`w-[38px] h-[38px] rounded-full flex items-center justify-center text-white transition-all active:scale-90 ${showOptions ? 'bg-white/25' : 'bg-white/10'}`}
                                aria-label="Más opciones"
                            >
                                <IoEllipsisHorizontal size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Progreso */}
                    <div className="flex-none pt-5 group" onPointerDown={(e) => e.stopPropagation()}>
                        <div className="relative h-3.5 flex items-center">
                            <div className="absolute left-0 right-0 h-[5px] rounded-[3px] bg-white/[0.22] overflow-hidden">
                                <motion.div className="h-full rounded-[3px] bg-white/85" style={{ width: displayWidth, willChange: 'width' }} />
                            </div>
                            <input {...scrubberProps} className="fsp-range absolute inset-0 w-full h-full z-10" />
                        </div>
                        <div className="flex justify-between mt-1.5 text-xs font-medium text-white/50" style={{ fontFeatureSettings: "'tnum'" }}>
                            <motion.span>{displayTimeText}</motion.span>
                            <motion.span>{displayRemainingText}</motion.span>
                        </div>
                    </div>

                    {/* Transporte */}
                    <div className="flex-none flex items-center justify-center gap-11 pt-2 text-white">
                        <button onClick={previousSong} className="p-1.5 active:scale-75 transition-transform" aria-label="Anterior">
                            <IoPlaySkipBackSharp size={38} />
                        </button>
                        <button
                            onClick={togglePlayPause}
                            className="w-14 h-14 flex items-center justify-center active:scale-90 transition-transform"
                            aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
                        >
                            {isPlaying ? <IoPauseSharp size={52} /> : <IoPlaySharp size={52} className="ml-1" />}
                        </button>
                        <button onClick={nextSong} className="p-1.5 active:scale-75 transition-transform" aria-label="Siguiente">
                            <IoPlaySkipForwardSharp size={38} />
                        </button>
                    </div>

                    {/* Volumen */}
                    <div className="flex-none flex items-center gap-3 pt-4 text-white/60 group" onPointerDown={(e) => e.stopPropagation()}>
                        <IoVolumeLow size={16} />
                        <div className="relative flex-1 h-3.5 flex items-center">
                            <div className="absolute left-0 right-0 h-[5px] rounded-[3px] bg-white/[0.22] overflow-hidden">
                                <div className="h-full rounded-[3px] bg-white/75" style={{ width: `${volume * 100}%` }} />
                            </div>
                            <input
                                type="range" min="0" max="1" step="0.01" value={volume}
                                onChange={(e) => changeVolume(parseFloat(e.target.value))}
                                className="fsp-range absolute inset-0 w-full h-full"
                                aria-label="Volumen"
                            />
                        </div>
                        <IoVolumeHigh size={20} />
                    </div>

                    {/* Barra inferior: Letra / Cola */}
                    <div className="flex-none flex items-center justify-between px-8 pt-5 pb-3">
                        <button
                            onClick={() => setViewMode(viewMode === 'lyrics' ? 'cover' : 'lyrics')}
                            className="p-1.5 transition-colors active:scale-90"
                            style={{ color: viewMode === 'lyrics' ? accent : 'rgba(255,255,255,.55)' }}
                            aria-label="Letra"
                        >
                            <IoText size={24} />
                        </button>
                        <button
                            onClick={() => setViewMode(viewMode === 'queue' ? 'cover' : 'queue')}
                            className="p-1.5 transition-colors active:scale-90"
                            style={{ color: viewMode === 'queue' ? accent : 'rgba(255,255,255,.55)' }}
                            aria-label="Cola de reproducción"
                        >
                            <IoList size={24} />
                        </button>
                    </div>

                    {/* Espaciador inferior: levanta el bloque de controles */}
                    <div className="flex-[2] min-h-3 max-h-16" />

                    {/* Overlay: LETRA */}
                    {viewMode === 'lyrics' && (
                        <div
                            className="fsp-fade-in absolute inset-0 z-50 flex flex-col"
                            style={{ background: 'rgba(5,5,5,.55)', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)' }}
                            onPointerDown={(e) => e.stopPropagation()}
                        >
                            <div className="absolute inset-0 opacity-50 pointer-events-none" style={{ background: `linear-gradient(160deg, ${dominantColor}, ${secondaryColor})` }} />
                            <div className="relative z-10 flex items-center justify-between px-[26px] pt-16 pb-2 flex-none">
                                <span className="text-[22px] font-bold text-white">Letra</span>
                                <button
                                    onClick={() => setViewMode('cover')}
                                    className="w-[38px] h-[38px] rounded-full bg-white/15 text-white flex items-center justify-center active:scale-90 transition-transform"
                                    aria-label="Volver a la portada"
                                >
                                    <IoChevronDown size={22} />
                                </button>
                            </div>
                            <div className="relative z-10 flex-1 overflow-hidden px-2">
                                {lyricsPanel}
                            </div>
                        </div>
                    )}

                    {/* Overlay: COLA */}
                    {viewMode === 'queue' && (
                        <div
                            className="fsp-fade-in absolute inset-0 z-50 flex flex-col"
                            style={{ background: 'rgba(8,8,8,.72)', backdropFilter: 'blur(34px)', WebkitBackdropFilter: 'blur(34px)' }}
                            onPointerDown={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-end justify-between px-[26px] pt-16 pb-3.5 flex-none">
                                <div>
                                    <div className="uppercase text-[11px] tracking-[1.4px] font-semibold text-white/50">A continuación</div>
                                    <div className="text-[22px] font-bold text-white mt-0.5">Cola</div>
                                </div>
                                <button
                                    onClick={() => setViewMode('cover')}
                                    className="w-[38px] h-[38px] rounded-full bg-white/[0.14] text-white flex items-center justify-center active:scale-90 transition-transform"
                                    aria-label="Volver a la portada"
                                >
                                    <IoChevronDown size={22} />
                                </button>
                            </div>
                            <div className="no-scrollbar flex-1 overflow-y-auto overscroll-contain px-[18px] pb-8">
                                {queuePanel}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {optionsMenu}
        </ContainerTag>
    );
}
