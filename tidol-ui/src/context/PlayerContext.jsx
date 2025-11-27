import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo
} from 'react';
import api from '../api/axiosConfig';

// --- Context Definitions ---
const PlayerStateContext = createContext();
const PlayerProgressContext = createContext();
const PlayerActionsContext = createContext();
const PlayerContext = createContext(); // Legacy for backward compatibility

// --- Hooks ---
export const usePlayerState = () => useContext(PlayerStateContext);
export const usePlayerProgress = () => useContext(PlayerProgressContext);
export const usePlayerActions = () => useContext(PlayerActionsContext);
export const usePlayer = () => useContext(PlayerContext); // Legacy hook

export function PlayerProvider({ children }) {
  // --- State ---
  const [currentSong, setCurrentSong] = useState(null);
  const [originalQueue, setOriginalQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playedHistory, setPlayedHistory] = useState([]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // High frequency updates
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);

  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  const [isFullScreenOpen, setIsFullScreenOpen] = useState(false);

  // Liked songs
  const [likedSongs, setLikedSongs] = useState(new Set());
  const prevLikeRef = useRef(null);

  const audioRef = useRef(null);
  const hasUserInteracted = useRef(false);

  // Detected audio quality (for Internet Archive songs)
  const [detectedQuality, setDetectedQuality] = useState(null);

  // Spectra Analytics State (keeping it if it was there, or initializing default)
  const [spectraData, setSpectraData] = useState({
    waveform: [],
    lyrics: [],
    bpm: null,
    key: null,
    status: 'idle'
  });

  // --- Actions ---
  const openFullScreenPlayer = useCallback(() => setIsFullScreenOpen(true), []);
  const toggleFullScreenPlayer = useCallback(() => setIsFullScreenOpen(prev => !prev), []);
  const closeFullScreenPlayer = useCallback(() => setIsFullScreenOpen(false), []);

  const addToHistory = useCallback((songId) => {
    setPlayedHistory(prev => prev.includes(songId) ? prev : [...prev, songId]);
  }, []);

  // Spectra Actions
  const updateSpectraData = useCallback((data) => {
    setSpectraData(prev => ({ ...prev, ...data }));
  }, []);

  const resetSpectraData = useCallback(() => {
    setSpectraData({
      waveform: [],
      lyrics: [],
      bpm: null,
      key: null,
      status: 'idle'
    });
  }, []);

  const updateSpectraField = useCallback((field, value) => {
    setSpectraData(prev => ({ ...prev, [field]: value }));
  }, []);

  // Fetch liked songs
  useEffect(() => {
    let mounted = true;
    const fetchAllLikedSongs = async () => {
      try {
        const [localRes, iaRes] = await Promise.all([
          api.get('/music/songs/likes'),
          api.get('/music/ia/likes')
        ]);

        const localData = localRes.data;
        const localArr = Array.isArray(localData) ? localData : [];
        const localLikedIds = localArr.map(song => song.id || song.songId).filter(Boolean);

        const iaData = iaRes.data;
        const iaArr = Array.isArray(iaData) ? iaData : [];
        const iaLikedIds = iaArr.map(song => song.id).filter(Boolean);

        const allLikedIds = new Set([...localLikedIds, ...iaLikedIds]);

        if (mounted) {
          setLikedSongs(allLikedIds);
        }

      } catch (err) {
        // console.error("Error al cargar todos los likes:", err);
      }
    };

    fetchAllLikedSongs();
    return () => { mounted = false; };
  }, []);

  const toggleLike = useCallback(async (songId, songData = null) => {
    if (!songId) return;

    const isIa = songData?.identifier || songData?.source === 'internet_archive' || typeof songId === 'string' && songId.includes('-');

    setLikedSongs(prev => {
      const newSet = new Set(prev);
      const wasLiked = newSet.has(songId);
      if (wasLiked) newSet.delete(songId);
      else newSet.add(songId);
      prevLikeRef.current = { songId, wasLiked };
      return newSet;
    });

    const token = localStorage.getItem('token');

    try {
      if (isIa) {
        await api.post(`/music/ia/likes/toggle`, {
          identifier: songData?.identifier || songId,
          title: songData?.titulo || songData?.title || '',
          artist: songData?.artista || songData?.artist || '',
          source: songData?.source || 'internet_archive',
          url: songData?.url,
          portada: songData?.portada,
          duration: songData?.duration
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await api.post(`/music/songs/${songId}/like`, null, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      setCurrentSong(cs => {
        if (!cs) return cs;
        if (cs.id === songId) {
          return { ...cs, isLiked: !prevLikeRef.current?.wasLiked };
        }
        return cs;
      });
      prevLikeRef.current = null;
    } catch (err) {
      const prev = prevLikeRef.current;
      if (prev && prev.songId === songId) {
        setLikedSongs(curr => {
          const newSet = new Set(curr);
          if (prev.wasLiked) newSet.add(songId);
          else newSet.delete(songId);
          return newSet;
        });
      }
      console.error("No se pudo actualizar el like:", err);
    }
  }, []);

  const isSongLiked = useCallback((songId) => {
    return likedSongs.has(songId);
  }, [likedSongs]);

  useEffect(() => {
    const handleFirstInteraction = () => {
      if (!hasUserInteracted.current) {
        hasUserInteracted.current = true;
      }
      window.removeEventListener('click', handleFirstInteraction, true);
    };
    window.addEventListener('click', handleFirstInteraction, true);
    return () => window.removeEventListener('click', handleFirstInteraction, true);
  }, []);

  useEffect(() => {
    setCurrentSong(prev => {
      if (!prev) return prev;
      const liked = likedSongs.has(prev.id);
      if (prev.isLiked === liked) return prev;
      return { ...prev, isLiked: liked };
    });
  }, [likedSongs]);

  const playSongList = useCallback((songs, startIndex = 0) => {
    if (!songs || songs.length === 0) return;
    setOriginalQueue(songs);
    const mainSong = songs[startIndex];
    setCurrentIndex(startIndex);
    setCurrentSong({ ...mainSong, isLiked: likedSongs.has(mainSong.id), playRequestId: Date.now() });
    addToHistory(mainSong.id);
  }, [addToHistory, likedSongs]);

  const fetchRecommendations = useCallback(async (songToUse) => {
    if (!songToUse) return;
    setIsLoading(true);
    try {
      const candidate =
        songToUse.title ||
        songToUse.titulo ||
        songToUse.name ||
        songToUse.artista ||
        songToUse.artist ||
        songToUse.identifier ||
        '';
      if (!candidate) {
        setIsLoading(false);
        setIsPlaying(false);
        return;
      }
      const res = await api.get(`/music/searchArchive?q=${encodeURIComponent(candidate)}`);
      const results = res.data || [];
      if (Array.isArray(results) && results.length > 0) {
        const songs = results.map((item, idx) => {
          let highResCover = null;
          if (item.files && Array.isArray(item.files)) {
            const coverFile = item.files.find(f => f.format?.includes("JPEG") || f.format?.includes("PNG"));
            if (coverFile) {
              highResCover = `https://archive.org/0/items/${item.identifier}/${coverFile.name}?cnt=0`;
            }
          }
          return {
            id: item.identifier || item.id || `ia_${idx}_${Math.random().toString(36).slice(2, 8)}`,
            url: item.url || item.file || item.playbackUrl || (`https://archive.org/download/${item.identifier}/${item.filename || ''}`),
            titulo: item.title || item.titulo || 'Sin título',
            artista: item.artist || item.creator || item.artista || 'Internet Archive',
            portada: highResCover || item.thumbnail || item.thumbnail_url || item.image || (`https://archive.org/services/img/${item.identifier}`),
            duracion: item.duration || 0
          };
        }).filter(s => s.url);
        if (songs.length > 0) {
          setOriginalQueue(songs);
          setCurrentIndex(0);
          setCurrentSong({ ...songs[0], isLiked: likedSongs.has(songs[0].id), playRequestId: Date.now() });
          addToHistory(songs[0].id);
        } else {
          setIsPlaying(false);
        }
      } else {
        setIsPlaying(false);
      }
    } catch (err) {
      console.error("Radio infinita IA Error:", err);
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
    }
  }, [addToHistory, likedSongs]);

  const nextSong = useCallback(async () => {
    if (originalQueue.length > 0 && currentIndex < originalQueue.length - 1) {
      const nextIndex = currentIndex + 1;
      const nextSongData = originalQueue[nextIndex];
      setCurrentIndex(nextIndex);
      setCurrentSong({ ...nextSongData, isLiked: likedSongs.has(nextSongData.id), playRequestId: Date.now() });
      addToHistory(nextSongData.id);
    } else {
      await fetchRecommendations(currentSong);
    }
  }, [originalQueue, currentIndex, currentSong, fetchRecommendations, addToHistory, likedSongs]);

  const previousSong = useCallback(() => {
    if (!audioRef.current) return;
    if (audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      return;
    }
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      const prevSongData = originalQueue[prevIndex];
      if (prevSongData) {
        setCurrentIndex(prevIndex);
        setCurrentSong({ ...prevSongData, isLiked: likedSongs.has(prevSongData.id), playRequestId: Date.now() });
      }
    }
  }, [currentIndex, originalQueue, likedSongs]);

  const addToQueue = useCallback((song) => {
    setOriginalQueue(prev => [...prev, song]);
  }, []);

  const playNext = useCallback((song) => {
    setOriginalQueue(prev => {
      const newQueue = [...prev];
      newQueue.splice(currentIndex + 1, 0, song);
      return newQueue;
    });
  }, [currentIndex]);

  const reorderQueue = useCallback((newQueue) => {
    if (currentSong) {
      const newIndex = newQueue.findIndex(s => s.id === currentSong.id);
      if (newIndex !== -1) {
        setCurrentIndex(newIndex);
      }
    }
    setOriginalQueue(newQueue);
  }, [currentSong]);

  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(err => {
        console.error("Play error:", err);
      });
    }
  }, [isPlaying]);

  const seek = useCallback((newTime) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  }, []);

  const changeVolume = useCallback((newVolume) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = Math.min(1, Math.max(0, newVolume));
    audio.muted = audio.volume === 0;
    setVolume(audio.volume);
    setIsMuted(audio.muted);
  }, []);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    if (!audio.muted && audio.volume === 0) audio.volume = 0.5;
    setIsMuted(audio.muted);
    setVolume(audio.volume);
  }, []);

  // Audio Logic
  const currentSongIdRef = useRef(null);
  const lastPlayRequestIdRef = useRef(null);

  useEffect(() => {
    if (!currentSong) return;

    const isSameSong = currentSongIdRef.current === currentSong.id;
    const isNewPlayRequest = currentSong.playRequestId !== lastPlayRequestIdRef.current;

    if (isSameSong && !isNewPlayRequest) {
      return;
    }

    currentSongIdRef.current = currentSong.id;
    lastPlayRequestIdRef.current = currentSong.playRequestId;

    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = 'auto';
      audioRef.current.crossOrigin = 'anonymous';
    }
    const audio = audioRef.current;

    const previousSrc = audio.src;
    const newSrc = currentSong.url || previousSrc;
    if (previousSrc !== newSrc) {
      audio.src = newSrc;
    }

    // Detect if this is an Internet Archive song
    const isInternetArchive = currentSong.url?.includes('archive.org');

    // Parse quality info from format string (only for IA songs without metadata)
    if (isInternetArchive && !currentSong.bit_depth && !currentSong.sample_rate) {
      let bitDepth = null;
      let sampleRate = null;

      if (currentSong.format) {
        const formatStr = currentSong.format.toLowerCase();

        // Parse bit depth
        if (formatStr.includes('24bit') || formatStr.includes('24-bit')) {
          bitDepth = 24;
        } else if (formatStr.includes('16bit') || formatStr.includes('16-bit')) {
          bitDepth = 16;
        } else if (formatStr.includes('32bit') || formatStr.includes('32-bit')) {
          bitDepth = 32;
        }

        // Parse sample rate from common patterns
        const khzMatch = formatStr.match(/(\d+)\s*khz/i);
        if (khzMatch) {
          sampleRate = parseFloat(khzMatch[1]) * 1000;
        }
      }

      setDetectedQuality({ sample_rate: sampleRate, bit_depth: bitDepth });
    } else {
      setDetectedQuality(null);
    }

    const safePlay = () => {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          console.warn("🔇 Autoplay bloqueado. Esperando interacción del usuario.");
          setIsPlaying(false);
        });
      }
    };

    audio.load();
    if (hasUserInteracted.current) {
      safePlay();
    } else {
      setIsPlaying(false);
    }

    api.post('/history/add', {
      songId: currentSong.id,
      titulo: currentSong.titulo,
      artista: currentSong.artista,
      url: currentSong.url,
      portada: currentSong.portada,
    }).catch(err => console.error("DB Historial error:", err));
  }, [currentSong]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      const t = audio.currentTime || 0;
      const d = audio.duration || 0;
      setCurrentTime(t);
      if (d > 0 && !isNaN(d) && isFinite(d)) {
        setDuration(d);
        setProgress((t / d) * 100);
      } else {
        setDuration(prev => prev || 0);
      }
    };

    const onLoadedMetadata = () => {
      const d = audio.duration || 0;
      if (d > 0 && !isNaN(d) && isFinite(d)) {
        setDuration(d);
      }
    };

    const onEmptied = () => {
      setCurrentTime(0);
      setDuration(0);
      setProgress(0);
      setIsPlaying(false);
    };

    const onLoadStart = () => setIsLoading(true);
    const onCanPlay = () => setIsLoading(false);
    const onEnded = () => {
      setIsPlaying(false);
      nextSong();
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onVolumeChange = () => {
      setVolume(audio.volume);
      setIsMuted(audio.muted);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('emptied', onEmptied);
    audio.addEventListener('loadstart', onLoadStart);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('volumechange', onVolumeChange);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('emptied', onEmptied);
      audio.removeEventListener('loadstart', onLoadStart);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('volumechange', onVolumeChange);
    };
  }, [nextSong]);

  useEffect(() => {
    if ('mediaSession' in navigator && currentSong) {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: currentSong.titulo || currentSong.title || '',
        artist: currentSong.artista || currentSong.artist || '',
        artwork: [
          { src: currentSong.portada || '/default_cover.png', sizes: '512x512', type: 'image/png' }
        ]
      });

      navigator.mediaSession.setActionHandler('previoustrack', previousSong);
      navigator.mediaSession.setActionHandler('nexttrack', nextSong);
      navigator.mediaSession.setActionHandler('play', () => {
        audioRef.current.play();
        setIsPlaying(true);
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        audioRef.current.pause();
        setIsPlaying(false);
      });
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime != null) {
          audioRef.current.currentTime = details.seekTime;
          setCurrentTime(details.seekTime);
        }
      });
    }
  }, [currentSong, previousSong, nextSong]);

  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }, [isPlaying]);

  // --- Context Values ---

  // 1. State Context (Low frequency)
  const playerState = useMemo(() => ({
    currentSong,
    isPlaying,
    isLoading,
    volume,
    isMuted,
    isFullScreenOpen,
    likedSongs,
    originalQueue,
    currentIndex,
    hasNext: originalQueue.length > 0,
    hasPrevious: currentIndex > 0 || currentTime > 3,
    spectraData,
    detectedQuality, // Added detected quality for IA songs
  }), [currentSong, isPlaying, isLoading, volume, isMuted, isFullScreenOpen, likedSongs, originalQueue, currentIndex, currentTime, spectraData, detectedQuality]);

  // 2. Progress Context (High frequency - 60fps)
  const playerProgress = useMemo(() => ({
    currentTime,
    duration,
    progress
  }), [currentTime, duration, progress]);

  // 3. Actions Context (Static)
  const playerActions = useMemo(() => ({
    playSongList,
    togglePlayPause,
    nextSong,
    previousSong,
    addToQueue,
    playNext,
    changeVolume,
    toggleMute,
    seek,
    openFullScreenPlayer,
    toggleFullScreenPlayer,
    closeFullScreenPlayer,
    toggleLike,
    isSongLiked,
    reorderQueue,
    updateSpectraData,
    resetSpectraData,
    updateSpectraField
  }), [playSongList, togglePlayPause, nextSong, previousSong, addToQueue, playNext, changeVolume, toggleMute, seek, openFullScreenPlayer, toggleFullScreenPlayer, closeFullScreenPlayer, toggleLike, isSongLiked, reorderQueue, updateSpectraData, resetSpectraData, updateSpectraField]);

  // Legacy Context (Combined)
  const legacyContext = useMemo(() => ({
    audioRef,
    ...playerState,
    ...playerProgress,
    ...playerActions
  }), [playerState, playerProgress, playerActions]);

  return (
    <PlayerStateContext.Provider value={playerState}>
      <PlayerProgressContext.Provider value={playerProgress}>
        <PlayerActionsContext.Provider value={playerActions}>
          <PlayerContext.Provider value={legacyContext}>
            {children}
          </PlayerContext.Provider>
        </PlayerActionsContext.Provider>
      </PlayerProgressContext.Provider>
    </PlayerStateContext.Provider>
  );
}
