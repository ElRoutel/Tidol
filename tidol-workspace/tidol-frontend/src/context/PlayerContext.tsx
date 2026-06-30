import {
    createContext, useContext, useState, useRef,
    useEffect, useCallback, ReactNode
} from 'react';
import { useMotionValue, MotionValue } from 'framer-motion';
import api from '../api/axiosConfig';
import { TidolAudioEngine } from '../engine/TidolAudioEngine';
import { resolvePlayback } from '../engine/embedResolver';
import YouTubeEmbed, { YouTubeEmbedHandle } from '../components/embeds/YouTubeEmbed';
import { UnifiedTrack, PlayerState } from '../types/music';
import { useVoxAudio } from '../hooks/useVoxAudio';

interface PlayerContextType extends Omit<PlayerState, 'progress'> {
    isLoading: boolean;
    isMuted: boolean;
    isFullScreenOpen: boolean;
    currentTimeMotion: MotionValue<number>;
    progressMotion: MotionValue<number>;
    togglePlayPause: () => void;
    seek: (time: number) => void;
    changeVolume: (val: number) => void;
    toggleMute: () => void;
    playSongList: (songs: UnifiedTrack[], startIndex?: number) => void;
    playAt: (index: number) => void;
    nextSong: () => Promise<void>;
    previousSong: () => void;
    addToQueue: (song: UnifiedTrack) => void;
    playNext: (song: UnifiedTrack) => void;
    toggleShuffle: () => void;
    toggleRepeat: () => void;
    setIsFullScreenOpen: (open: boolean) => void;
    duration: number;
    isDataSaving: boolean;
    setIsDataSaving: (saving: boolean) => void;
    getOptimizedSize: (idealSize: number) => number;
    isSongLiked: (id: string | number) => boolean;
    toggleLike: (id: string | number, song?: UnifiedTrack) => Promise<void>;
    spectraData: any;
    updateSpectraData: (data: any) => void;
    resetSpectraData: () => void;
    closeFullScreenPlayer: () => void;
    toggleVox: () => void;
    toggleVoxType: () => void;
    voxMode: boolean;
    voxType: 'vocals' | 'accompaniment';
    originalQueue: UnifiedTrack[];
    currentIndex: number;
    engine: TidolAudioEngine;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const usePlayer = () => {
    const context = useContext(PlayerContext);
    if (!context) throw new Error('usePlayer debe usarse dentro de un PlayerProvider');
    return context;
};

export const usePlayerState = () => {
    const ctx = usePlayer();
    return {
        currentSong: ctx.currentTrack,
        isPlaying: ctx.isPlaying,
        volume: ctx.volume,
        isMuted: ctx.isMuted,
        isFullScreenOpen: ctx.isFullScreenOpen,
        isDataSaving: ctx.isDataSaving,
        voxMode: ctx.voxMode,
        voxType: ctx.voxType,
        originalQueue: ctx.originalQueue ?? ctx.queue,
        currentIndex: ctx.currentIndex,
        detectedQuality: null,
        isVoxLoading: ctx.isLoading || ctx.spectraData?.voxLoading,
        playbackDetails: { provider: 'unknown' }
    };
};

export const usePlayerActions = () => {
    const ctx = usePlayer();
    return {
        togglePlayPause: ctx.togglePlayPause,
        nextSong: ctx.nextSong,
        previousSong: ctx.previousSong,
        changeVolume: ctx.changeVolume,
        toggleMute: ctx.toggleMute,
        seek: ctx.seek,
        toggleFullScreenPlayer: () => ctx.setIsFullScreenOpen(!ctx.isFullScreenOpen),
        closeFullScreenPlayer: ctx.closeFullScreenPlayer,
        toggleVox: ctx.toggleVox,
        toggleVoxType: ctx.toggleVoxType,
    };
};

export const usePlayerProgress = () => {
    const ctx = usePlayer();
    // Return motion values for transient rendering without React state updates
    return {
        currentTimeMotion: ctx.currentTimeMotion,
        progressMotion: ctx.progressMotion,
        duration: ctx.duration
    };
};


export function PlayerProvider({ children }: { children: ReactNode }) {

    // ✅ FIX 1: engineRef AL INICIO, antes de cualquier useEffect que lo use
    const engineRef = useRef(new TidolAudioEngine());

    // ── Reproductor YouTube global (motor principal de audio legal) ──
    // YouTube e Internet Archive son las únicas fuentes controlables por la UI.
    // El IFrame de YouTube reproduce de forma oficial (sin descarga/proxy ilegal).
    const ytRef = useRef<YouTubeEmbedHandle>(null);
    const [ytVideoId, setYtVideoId] = useState<string | null>(null);
    const ytVideoIdRef = useRef<string | null>(null);
    const playbackModeRef = useRef<'youtube' | 'archive' | 'idle'>('idle');
    const pendingYtPlayRef = useRef(false);
    const durationRef = useRef(0);
    const isMutedRef = useRef(false);

    const [currentTrack, setCurrentTrack] = useState<UnifiedTrack | null>(null);
    const [queue, setQueue] = useState<UnifiedTrack[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);

    // Transient state for 60fps performance without React re-renders
    const currentTimeMotion = useMotionValue(0);
    const progressMotion = useMotionValue(0);

    const [duration, setDuration] = useState(0);
    const [shuffle, setShuffle] = useState(false);
    const [repeatMode, setRepeatMode] = useState<'none' | 'one' | 'all'>('none');
    const [isFullScreenOpen, setIsFullScreenOpen] = useState(false);
    const [isDataSaving, setIsDataSaving] = useState(false);
    const [voxMode, setVoxMode] = useState(false);
    const [voxType, setVoxType] = useState<'vocals' | 'accompaniment'>('vocals');
    const [likedSongs, setLikedSongs] = useState<Set<string | number>>(new Set());
    const [spectraData, setSpectraData] = useState<any>({ status: 'idle' });
    const progressRef = useRef(0); // Stable ref for drift detection (avoids interval churn)
    const volumeRef = useRef(1); // Stable ref for volume restoration

    const updateSpectraData = useCallback((data: any) => {
        setSpectraData((prev: any) => ({ ...prev, ...data }));
    }, []);

    const resetSpectraData = useCallback(() => setSpectraData({ status: 'idle' }), []);

    const getOptimizedSize = useCallback((idealSize: number) => {
        return isDataSaving ? Math.min(idealSize, 300) : idealSize;
    }, [isDataSaving]);


    // ── Likes ────────────────────────────────────────────────────
    useEffect(() => {
        const fetchLikes = async () => {
            try {
                const [localRes, iaRes] = await Promise.all([
                    api.get('/music/songs/likes').catch(() => ({ data: [] })),
                    api.get('/music/ia/likes').catch(() => ({ data: [] }))
                ]);
                const localIds = localRes.data || [];
                const iaIds = iaRes.data || [];
                setLikedSongs(new Set([...localIds, ...iaIds]));
            } catch (err) {
                console.error('[PlayerContext] Failed to fetch likes:', err);
            }
        };
        fetchLikes();
    }, []);

    // ── Telemetry (Log Play) ────────────────────────────────────────────────
    useEffect(() => {
        if (currentTrack && isPlaying) {
            const mbid = currentTrack.trackId || currentTrack.id || (currentTrack as any).mbid;
            if (mbid) {
                api.post(`/tracks/${mbid}/log-play`).catch(() => {});
            }
        }
    }, [currentTrack, isPlaying]);

    // ── VOX ──────────────────────────────────────────────────────

    const { voxState, processAndListen, startStems, stopStems, setActiveType, checkDrift } = useVoxAudio();

    // Track when Vox is loading (propagate to spectraData for UI)
    useEffect(() => {
        updateSpectraData({
            voxLoading: voxState.status === 'processing' || voxState.status === 'queued'
        });
    }, [voxState.status, updateSpectraData]);

    // Manage Vox Activation: process stems when voxMode turns on
    // ═══ FIX: NO volume/progress in deps — only voxMode and currentTrack should trigger this ═══
    useEffect(() => {
        if (!currentTrack) return;
        if (voxMode) {
            processAndListen(currentTrack);
        } else {
            stopStems();
            engineRef.current.setVolume(volumeRef.current);
        }
    }, [voxMode, currentTrack?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // When stems become available and we're playing, start them
    useEffect(() => {
        if (!voxMode || !voxState.stemsAvailable) {
            // Restore engine volume when stems are not active
            if (!isMuted) engineRef.current.setVolume(volumeRef.current);
            return;
        }

        // Mute the HTML <audio> element — stems take over
        engineRef.current.setVolume(0);

        // Set which stem is audible
        setActiveType(voxType);

        // If currently playing, create source nodes at current position
        if (isPlaying) {
            startStems(progressRef.current);
        }
    }, [voxState.stemsAvailable, voxMode]); // eslint-disable-line react-hooks/exhaustive-deps

    // Toggle active stem type (just gain change, no new nodes)
    useEffect(() => {
        if (voxMode && voxState.stemsAvailable) {
            setActiveType(voxType);
        }
    }, [voxType, voxMode, voxState.stemsAvailable, setActiveType]);

    // Drift detection: 1 Hz interval that re-syncs stems if they drift from <audio>
    // ═══ FIX: Uses progressRef instead of progress state to avoid recreating interval 10x/sec ═══
    useEffect(() => {
        if (!voxMode || !voxState.stemsAvailable || !isPlaying) return;
        const interval = setInterval(() => {
            checkDrift(progressRef.current);
        }, 1000);
        return () => clearInterval(interval);
    }, [voxMode, voxState.stemsAvailable, isPlaying, checkDrift]);


    // ── MediaSession + Historial ─────────────────────────────────
    useEffect(() => {
        if (!currentTrack) {
            document.title = 'Tidol';
            return;
        }

        const title = currentTrack.title || currentTrack.attributes?.name || 'Unknown Track';
        const artist = currentTrack.artist || currentTrack.attributes?.artistName || 'Unknown Artist';
        document.title = `${title} • ${artist} | Tidol`;

        if ('mediaSession' in navigator) {
            const coverUrl = currentTrack.coverArtUrl
                || (currentTrack as any).portada
                || (currentTrack as any).coverUrl
                || (currentTrack as any).artworkUrl
                || '/default-album.png';

            navigator.mediaSession.metadata = new MediaMetadata({
                title: currentTrack.trackName || (currentTrack as any).titulo || 'Unknown Track',
                artist: currentTrack.artistName || (currentTrack as any).artista || 'Unknown Artist',
                album: currentTrack.albumName || (currentTrack as any).album || 'Tidol',
                artwork: [
                    { src: coverUrl, sizes: '96x96',   type: 'image/jpeg' },
                    { src: coverUrl, sizes: '128x128',  type: 'image/jpeg' },
                    { src: coverUrl, sizes: '192x192',  type: 'image/jpeg' },
                    { src: coverUrl, sizes: '256x256',  type: 'image/jpeg' },
                    { src: coverUrl, sizes: '384x384',  type: 'image/jpeg' },
                    { src: coverUrl, sizes: '512x512',  type: 'image/jpeg' },
                ]
            });

            navigator.mediaSession.setActionHandler('play', () => {
                if (playbackModeRef.current === 'youtube') ytRef.current?.play();
                else engineRef.current?.resume();
                setIsPlaying(true);
            });
            navigator.mediaSession.setActionHandler('pause', () => {
                if (playbackModeRef.current === 'youtube') ytRef.current?.pause();
                else engineRef.current?.pause();
                setIsPlaying(false);
            });

            // ✅ FIX 4: usar refs para evitar closures stale en mediaSession
            navigator.mediaSession.setActionHandler('previoustrack', () => previousSongRef.current());
            navigator.mediaSession.setActionHandler('nexttrack', () => nextSongRef.current());
            navigator.mediaSession.setActionHandler('seekto', (details) => {
                if (details.seekTime == null) return;
                if (playbackModeRef.current === 'youtube') ytRef.current?.seek(details.seekTime);
                else engineRef.current?.seek(details.seekTime);
            });

            navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
        }

        const syncHistory = async () => {
            try {
                await api.post('/history/add', {
                    cancion_id: currentTrack.id
                });
            } catch (err) {
                console.warn('⚠️ No se pudo sincronizar el historial:', err);
            }
        };
        syncHistory();

        if (!currentTrack.extractedColors) {
            const artworkUrl = currentTrack.artworkUrl || (currentTrack as any).portada
                || currentTrack.attributes?.artwork?.url || '/default_cover.png';

            if (artworkUrl && artworkUrl !== '/default_cover.png') {
                api.post('/colors/extract', {
                    imageUrl: artworkUrl,
                    songId: currentTrack.id,
                    source: currentTrack.sourceType === 'internet-archive' ? 'internet_archive' : 'local'
                })
                    .then((res: any) => {
                        if (res.data?.colors) {
                            setCurrentTrack(prev =>
                                prev?.id === currentTrack.id ? { ...prev, extractedColors: res.data.colors } : prev
                            );
                        }
                    })
                    .catch((err: any) => console.warn('[PlayerContext] Color extraction failed:', err));
            }
        }
    }, [currentTrack]);


    // ── Engine event listeners ───────────────────────────────────
    useEffect(() => {
        const engine = engineRef.current;

        const handleTimeUpdate = (e: any) => {
            const { currentTime, duration: d } = e.detail;

            currentTimeMotion.set(currentTime);
            progressRef.current = currentTime; // Keep ref in sync for drift detection

            if (d) {
                if (Math.abs(duration - d) > 0.1) setDuration(d);
                progressMotion.set((currentTime / d) * 100);
            }
        };
        const handleStateChange = (e: any) => {
            const s = e.detail;
            setIsPlaying(s === 'PLAYING');
            setIsLoading(s === 'LOADING' || s === 'BUFFERING');
        };
        const handleEnded = () => {
            console.log('[PlayerContext] Song ended, playing next...');
            nextSongRef.current();
        };

        engine.addEventListener('timeupdate', handleTimeUpdate);
        engine.addEventListener('statechange', handleStateChange);
        engine.addEventListener('ended', handleEnded);

        return () => {
            engine.removeEventListener('timeupdate', handleTimeUpdate);
            engine.removeEventListener('statechange', handleStateChange);
            engine.removeEventListener('ended', handleEnded);
        };
    }, []);


    // ── Reproducción unificada (YouTube IFrame / audio nativo IA) ──

    const handleYtReady = useCallback(() => {
        durationRef.current = ytRef.current?.getDuration() || 0;
        if (durationRef.current) setDuration(durationRef.current);
        if (pendingYtPlayRef.current) {
            ytRef.current?.setVolume(isMutedRef.current ? 0 : volumeRef.current);
            ytRef.current?.play();
            pendingYtPlayRef.current = false;
        }
    }, []);

    const handleYtStateChange = useCallback((s: 'playing' | 'paused' | 'ended' | 'buffering') => {
        if (playbackModeRef.current !== 'youtube') return;
        if (s === 'playing') { setIsPlaying(true); setIsLoading(false); }
        else if (s === 'paused') { setIsPlaying(false); }
        else if (s === 'buffering') { setIsLoading(true); }
        else if (s === 'ended') { nextSongRef.current(); }
    }, []);

    const handleYtTimeUpdate = useCallback((currentTime: number, dur: number) => {
        if (playbackModeRef.current !== 'youtube') return;
        currentTimeMotion.set(currentTime);
        progressRef.current = currentTime;
        if (dur) {
            if (Math.abs(durationRef.current - dur) > 0.1) { durationRef.current = dur; setDuration(dur); }
            progressMotion.set((currentTime / dur) * 100);
        }
    }, [currentTimeMotion, progressMotion]);

    const handleYtError = useCallback((err: any) => {
        console.error('[PlayerContext] YouTube embed error:', err);
        setIsLoading(false);
    }, []);

    // Resuelve la pista a una fuente legal y arranca la reproducción correcta.
    const startPlayback = useCallback(async (track: UnifiedTrack) => {
        setCurrentTrack(track);
        setIsLoading(true);
        setIsPlaying(false);
        currentTimeMotion.set(0);
        progressMotion.set(0);
        progressRef.current = 0;
        durationRef.current = 0;

        try {
            const resolved = await resolvePlayback(track);

            if (resolved.mode === 'youtube' && resolved.videoId) {
                playbackModeRef.current = 'youtube';
                engineRef.current.pause(); // silencia audio nativo previo
                pendingYtPlayRef.current = true;

                if (resolved.videoId === ytVideoIdRef.current && ytRef.current) {
                    // mismo vídeo ya montado: reinicia y reproduce
                    pendingYtPlayRef.current = false;
                    ytRef.current.setVolume(isMutedRef.current ? 0 : volumeRef.current);
                    ytRef.current.seek(0);
                    ytRef.current.play();
                } else {
                    ytVideoIdRef.current = resolved.videoId;
                    setYtVideoId(resolved.videoId); // (re)monta el IFrame; onReady hará play
                }
            } else if (resolved.mode === 'archive' && resolved.audioUrl) {
                playbackModeRef.current = 'archive';
                ytRef.current?.pause(); // pausa YouTube si estaba activo
                await engineRef.current.playTrack({ ...track, playbackUrl: resolved.audioUrl });
            }
        } catch (err) {
            console.error('[PlayerContext] startPlayback:', err);
            setIsLoading(false);
            setIsPlaying(false);
        }
    }, [currentTimeMotion, progressMotion]);


    // ── Actions ──────────────────────────────────────────────────

    const togglePlayPause = useCallback(() => {
        if (playbackModeRef.current === 'youtube') {
            if (isPlaying) ytRef.current?.pause();
            else ytRef.current?.play();
            return;
        }
        if (isPlaying) {
            engineRef.current.pause();
            // Web Audio source nodes are fire-and-forget; stop them on pause
            if (voxMode && voxState.stemsAvailable) stopStems();
        } else {
            engineRef.current.resume();
            // Recreate source nodes at current position on resume
            if (voxMode && voxState.stemsAvailable) {
                engineRef.current.setVolume(0); // keep engine muted
                startStems(currentTimeMotion.get());
            }
        }
    }, [isPlaying, voxMode, voxState.stemsAvailable, stopStems, startStems, currentTimeMotion]);

    const seek = useCallback((time: number) => {
        if (playbackModeRef.current === 'youtube') {
            ytRef.current?.seek(time);
            currentTimeMotion.set(time);
            progressRef.current = time;
            if (duration > 0) progressMotion.set((time / duration) * 100);
            return;
        }
        engineRef.current.seek(time);
        currentTimeMotion.set(time);
        if (duration > 0) progressMotion.set((time / duration) * 100);
        // Stop old source nodes; recreate at new seek position if vox is active
        if (voxMode && voxState.stemsAvailable) {
            stopStems();
            if (isPlaying) startStems(time);
        }
    }, [stopStems, startStems, voxMode, voxState.stemsAvailable, isPlaying, duration, currentTimeMotion, progressMotion]);

    const changeVolume = useCallback((val: number) => {
        const newVol = Math.min(1, Math.max(0, val));
        engineRef.current.setVolume(newVol);
        ytRef.current?.setVolume(newVol);
        setVolume(newVol);
        volumeRef.current = newVol; // Keep ref in sync
        isMutedRef.current = newVol === 0;
        setIsMuted(newVol === 0);
    }, []);

    const toggleMute = useCallback(() => {
        const newMuted = !isMuted;
        setIsMuted(newMuted);
        isMutedRef.current = newMuted;
        const v = newMuted ? 0 : volume;
        engineRef.current.setVolume(v);
        ytRef.current?.setVolume(v);
    }, [isMuted, volume]);

    const playSongList = useCallback((songs: UnifiedTrack[], startIndex = 0) => {
        if (!songs.length) return;
        setQueue(songs);
        setCurrentIndex(startIndex);
        startPlayback(songs[startIndex]);
    }, [startPlayback]);

    const playAt = useCallback((index: number) => {
        if (index < 0 || index >= queue.length) return;
        setCurrentIndex(index);
        stopStems(); // New track — kill any lingering stem nodes
        startPlayback(queue[index]);
    }, [queue, stopStems, startPlayback]);

    const triggerRadioAutoplay = useCallback(async () => {
        if (!currentTrack) return;
        
        const artistName = currentTrack.artistName || currentTrack.attributes?.artistName || currentTrack.artist || 'Desconocido';
        const trackTitle = currentTrack.trackName || currentTrack.attributes?.name || currentTrack.title || 'Desconocido';

        const toast = document.createElement('div');
        toast.className = 'fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-black/80 backdrop-blur-md text-white px-6 py-3 rounded-full border border-[#1db954]/50 shadow-2xl z-[9999] animate-fade-in pointer-events-none transition-all duration-500';
        toast.innerHTML = `<span class="text-[#1db954] font-bold">Radio Infinita:</span> Buscando música similar a "${trackTitle}"...`;
        document.body.appendChild(toast);
        
        setTimeout(() => { toast.style.opacity = '0'; }, 2500);
        setTimeout(() => toast.remove(), 3000);

        try {
            const res = await api.get('/radio', {
                params: { artist: artistName, title: trackTitle, limit: 10 }
            });

            if (res.data?.tracks && res.data.tracks.length > 0) {
                const normalizedNewTracks = res.data.tracks.map((t: any) => ({
                    id: t.mbid,
                    trackId: t.mbid,
                    trackName: t.title,
                    artistName: t.artist,
                    coverArtUrl: t.coverUrl || t.stream_url ? '/default-album.png' : '/default-album.png',
                    sourceType: 'radio',
                    attributes: {
                        name: t.title,
                        artistName: t.artist,
                        artwork: { url: t.coverUrl || '/default-album.png' }
                    }
                }));

                setQueue(prev => [...prev, ...normalizedNewTracks]);
                playAt(currentIndex + 1);
            } else {
                engineRef.current.pause();
                setIsPlaying(false);
            }
        } catch (error) {
            console.error("Fallo al obtener la Radio Infinita:", error);
            engineRef.current.pause();
            setIsPlaying(false);
        }
    }, [currentTrack, currentIndex, playAt]);

    const nextSong = useCallback(async () => {
        if (currentIndex < queue.length - 1) playAt(currentIndex + 1);
        else if (repeatMode === 'all') playAt(0);
        else await triggerRadioAutoplay();
    }, [currentIndex, queue, repeatMode, playAt, triggerRadioAutoplay]);

    // ✅ FIX 4: refs estables para nextSong y previousSong
    const nextSongRef = useRef(nextSong);
    const previousSongRef = useRef<() => void>(() => { });
    useEffect(() => { nextSongRef.current = nextSong; }, [nextSong]);

    const previousSong = useCallback(() => {
        if (currentTimeMotion.get() > 3) seek(0);
        else if (currentIndex > 0) playAt(currentIndex - 1);
    }, [currentTimeMotion, currentIndex, playAt, seek]);

    useEffect(() => { previousSongRef.current = previousSong; }, [previousSong]);

    const addToQueue = useCallback((song: UnifiedTrack) => {
        setQueue(prev => [...prev, song]);
    }, []);

    const playNext = useCallback((song: UnifiedTrack) => {
        setQueue(prev => {
            const next = [...prev];
            next.splice(currentIndex + 1, 0, song);
            return next;
        });
    }, [currentIndex]);

    const toggleShuffle = useCallback(() => setShuffle(prev => !prev), []);
    const toggleRepeat = useCallback(() => {
        setRepeatMode(prev => prev === 'none' ? 'all' : prev === 'all' ? 'one' : 'none');
    }, []);

    const closeFullScreenPlayer = useCallback(() => setIsFullScreenOpen(false), []);
    const toggleVox = useCallback(() => setVoxMode(prev => !prev), []);
    const toggleVoxType = useCallback(() => {
        setVoxType(prev => prev === 'vocals' ? 'accompaniment' : 'vocals');
    }, []);

    const isSongLiked = useCallback((id: string | number) => likedSongs.has(id), [likedSongs]);

    const toggleLike = useCallback(async (id: string | number, song?: UnifiedTrack) => {
        if (!id) return;

        const isIA = song?.sourceType === 'internet-archive'
            || (song as any)?.source === 'internet_archive'
            || (song as any)?.sourceType === 'internet_archive'
            || !!(song as any)?.identifier
            || String(id).includes('_');

        const isCurrentlyLiked = likedSongs.has(id);

        setLikedSongs(prev => {
            const next = new Set(prev);
            isCurrentlyLiked ? next.delete(id) : next.add(id);
            return next;
        });

        try {
            if (isIA) {
                await api.post('/music/ia/likes/toggle', {
                    identifier: id,
                    title: song?.attributes?.name || song?.title || (song as any)?.titulo || 'Unknown',
                    artist: song?.attributes?.artistName || song?.artist || (song as any)?.artista || 'Unknown',
                    source: (song as any)?.source || 'internet_archive',
                    url: song?.playbackUrl || (song as any)?.url,
                    portada: song?.attributes?.artwork?.url || song?.artworkUrl || (song as any)?.portada,
                    duration: song?.attributes?.durationInSeconds || (song as any)?.duration
                });
            } else {
                await api.post(`/music/songs/${id}/like`, {});
            }
        } catch (error: any) {
            console.error('[PlayerContext] Toggle like failed:', error);
            setLikedSongs(prev => {
                const next = new Set(prev);
                isCurrentlyLiked ? next.add(id) : next.delete(id);
                return next;
            });
        }
    }, [likedSongs]);


    // ── Provider value ───────────────────────────────────────────
    return (
        <PlayerContext.Provider value={{
            currentTrack, queue, isPlaying, isLoading, volume, isMuted,
            currentTimeMotion, progressMotion, duration, shuffle, repeatMode, isFullScreenOpen,
            togglePlayPause, seek, changeVolume, toggleMute,
            playSongList, playAt, nextSong, previousSong,
            addToQueue, playNext, toggleShuffle, toggleRepeat,
            setIsFullScreenOpen, isDataSaving, setIsDataSaving,
            getOptimizedSize, isSongLiked, toggleLike,
            spectraData, updateSpectraData, resetSpectraData,
            closeFullScreenPlayer, toggleVox, toggleVoxType,
            voxMode, voxType,
            originalQueue: queue,
            currentIndex,
            engine: engineRef.current
        }}>
            {children}

            {/*
              Reproductor YouTube global y oculto (motor de audio principal legal).
              Se mantiene montado fuera de pantalla — NO usar display:none, que
              detiene la reproducción del IFrame. Reproduce vía el IFrame oficial
              de YouTube; nunca descarga ni proxea audio.
            */}
            {ytVideoId && (
                <div
                    aria-hidden
                    style={{
                        position: 'fixed',
                        left: '-9999px',
                        top: 0,
                        width: 320,
                        height: 180,
                        opacity: 0,
                        pointerEvents: 'none',
                    }}
                >
                    <YouTubeEmbed
                        ref={ytRef}
                        videoId={ytVideoId}
                        autoPlay
                        onReady={handleYtReady}
                        onStateChange={handleYtStateChange}
                        onTimeUpdate={handleYtTimeUpdate}
                        onError={handleYtError}
                    />
                </div>
            )}
        </PlayerContext.Provider>
    );
}
