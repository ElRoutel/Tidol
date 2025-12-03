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
import axios from 'axios';
import { useAuth } from './AuthContext';

// --- Context Definitions ---
const PlayerStateContext = createContext();    // Datos Lentos (Canción, Queue, Volumen)
const PlayerProgressContext = createContext(); // Datos Rápidos (Tiempo, Duración) - 60fps
const PlayerActionsContext = createContext();  // Funciones Estables (Play, Pause)
const PlayerContext = createContext();         // Legacy

// --- Hooks ---
export const usePlayerState = () => useContext(PlayerStateContext);
export const usePlayerProgress = () => useContext(PlayerProgressContext);
export const usePlayerActions = () => useContext(PlayerActionsContext);
export const usePlayer = () => useContext(PlayerContext);

export function PlayerProvider({ children }) {
  // --- STATE (Datos Lentos) ---
  const [currentSong, setCurrentSong] = useState(null);
  const [originalQueue, setOriginalQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullScreenOpen, setIsFullScreenOpen] = useState(false);
  const [likedSongs, setLikedSongs] = useState(new Set());

  // Spectra / VOX State
  const [detectedQuality, setDetectedQuality] = useState(null);
  const [spectraData, setSpectraData] = useState({ waveform: [], lyrics: [], bpm: null, key: null, status: 'idle' });
  const [voxMode, setVoxMode] = useState(false);
  const [voxType, setVoxType] = useState('vocals');
  const [voxTracks, setVoxTracks] = useState(null);
  const [isVoxLoading, setIsVoxLoading] = useState(false);

  // --- STATE (Datos Rápidos) ---
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // --- REFS (Dual Audio Engine) ---
  const audioRefA = useRef(new Audio());
  const audioRefB = useRef(new Audio());
  const activePlayerRef = useRef('A'); // 'A' or 'B'
  const crossfadeIntervalRef = useRef(null);

  // Helper to get active and next player
  const getPlayers = useCallback(() => {
    if (activePlayerRef.current === 'A') return { current: audioRefA.current, next: audioRefB.current };
    return { current: audioRefB.current, next: audioRefA.current };
  }, []);

  const stateRef = useRef({
    currentSong, originalQueue, currentIndex, isPlaying, volume, isMuted, likedSongs, voxMode, voxTracks, voxType
  });

  // Mantener refs sincronizados
  useEffect(() => {
    stateRef.current = {
      currentSong, originalQueue, currentIndex, isPlaying, volume, isMuted, likedSongs, voxMode, voxTracks, voxType
    };
  }, [currentSong, originalQueue, currentIndex, isPlaying, volume, isMuted, likedSongs, voxMode, voxTracks, voxType]);

  const hasUserInteracted = useRef(false);
  const prevLikeRef = useRef(null);
  const { isAuthenticated } = useAuth();

  // Track last song ID to detect changes
  const lastSongIdRef = useRef(null);

  // --- CONFIGURACIÓN INICIAL AUDIO ---
  useEffect(() => {
    [audioRefA.current, audioRefB.current].forEach(audio => {
      audio.preload = 'auto';
      audio.crossOrigin = 'anonymous';
    });

    const handleInteraction = () => { hasUserInteracted.current = true; };
    window.addEventListener('click', handleInteraction, { once: true });
    return () => window.removeEventListener('click', handleInteraction);
  }, []);

  // --- CROSSFADE LOGIC (Equal Power Curve) ---
  const performCrossfade = useCallback((duration = 6) => {
    const { current: fadeOutPlayer, next: fadeInPlayer } = getPlayers();
    const targetVolume = stateRef.current.volume;

    if (crossfadeIntervalRef.current) clearInterval(crossfadeIntervalRef.current);

    const steps = 60 * duration; // 60fps
    let step = 0;

    // Prepare Fade In Player
    fadeInPlayer.volume = 0;
    fadeInPlayer.play().catch(e => console.warn("Crossfade play error", e));

    crossfadeIntervalRef.current = setInterval(() => {
      step++;
      const t = step / steps;

      // Equal Power Curve (Constant Power)
      const fadeOutGain = Math.cos(t * 0.5 * Math.PI);
      const fadeInGain = Math.sin(t * 0.5 * Math.PI);

      fadeOutPlayer.volume = targetVolume * fadeOutGain;
      fadeInPlayer.volume = targetVolume * fadeInGain;

      if (step >= steps) {
        clearInterval(crossfadeIntervalRef.current);
        fadeOutPlayer.pause();
        fadeOutPlayer.currentTime = 0;
        fadeOutPlayer.volume = targetVolume; // Reset
        fadeInPlayer.volume = targetVolume;

        // Swap Active Player Ref
        activePlayerRef.current = activePlayerRef.current === 'A' ? 'B' : 'A';
        console.log(`🔀 Crossfade Complete. Active Player: ${activePlayerRef.current}`);
      }
    }, 1000 / 60);
  }, [getPlayers]);

  // --- ACTIONS (Estables) ---

  const togglePlayPause = useCallback(() => {
    const { current } = getPlayers();
    if (stateRef.current.isPlaying) {
      current.pause();
      // Also pause crossfade if active
      if (crossfadeIntervalRef.current) {
        clearInterval(crossfadeIntervalRef.current);
        const { next } = getPlayers();
        next.pause();
      }
    } else {
      current.play().catch(e => console.warn("Play error", e));
    }
  }, [getPlayers]);

  const seek = useCallback((time) => {
    if (Number.isFinite(time)) {
      const { current } = getPlayers();
      current.currentTime = time;
      setCurrentTime(time);
    }
  }, [getPlayers]);

  const changeVolume = useCallback((val) => {
    const newVol = Math.min(1, Math.max(0, val));
    const { current, next } = getPlayers();

    current.volume = newVol;
    current.muted = newVol === 0;
    next.volume = newVol;

    setVolume(newVol);
    setIsMuted(newVol === 0);
  }, [getPlayers]);

  const toggleMute = useCallback(() => {
    const { current } = getPlayers();
    const newMuted = !current.muted;
    current.muted = newMuted;
    if (!newMuted && current.volume === 0) {
      current.volume = 0.5;
      setVolume(0.5);
    }
    setIsMuted(newMuted);
  }, [getPlayers]);

  const addToHistory = useCallback((songId) => {
    const song = stateRef.current.currentSong;
    if (!song || song.id !== songId) return;

    api.post('/history/add', {
      songId: song.id,
      titulo: song.titulo || song.title,
      artista: song.artista || song.artist,
      url: song.url,
      portada: song.portada,
    }).catch(err => console.error("DB Historial error:", err));
  }, []);

  // --- SPECTRA & VOX ACTIONS ---
  const updateSpectraData = useCallback((data) => setSpectraData(prev => ({ ...prev, ...data })), []);
  const resetSpectraData = useCallback(() => setSpectraData({ waveform: [], lyrics: [], bpm: null, key: null, status: 'idle' }), []);
  const updateSpectraField = useCallback((f, v) => setSpectraData(p => ({ ...p, [f]: v })), []);

  const toggleVox = useCallback(async () => {
    const { currentSong, voxMode, voxTracks } = stateRef.current;
    if (!currentSong) return;

    if (voxMode) {
      setVoxMode(false);
      return;
    }

    if (voxTracks && voxTracks.songId === currentSong.id) {
      setVoxMode(true);
      return;
    }

    setIsVoxLoading(true);
    try {
      const isIA = currentSong.url?.includes('archive.org');
      const endpoint = isIA ? '/spectra/vox/separate' : `/spectra/local/vox/separate/${currentSong.id}`;
      const params = isIA ? { ia_id: currentSong.identifier || currentSong.id } : {};

      const res = await axios.post(endpoint, params);

      if (res.data.status === 'success') {
        setVoxTracks({
          songId: currentSong.id,
          vocals: `/spectra${res.data.vocals}`,
          accompaniment: `/spectra${res.data.accompaniment}`
        });
        setVoxMode(true);
        setVoxType('accompaniment');
      } else {
        alert("VOX está procesando en segundo plano. Intenta en unos segundos.");
      }
    } catch (e) {
      console.error("VOX Error", e);
    } finally {
      setIsVoxLoading(false);
    }
  }, []);

  const toggleVoxType = useCallback(() => setVoxType(p => p === 'vocals' ? 'accompaniment' : 'vocals'), []);

  // --- RECOMMENDATIONS LOGIC ---
  const fetchRecommendations = useCallback(async (songToUse) => {
    if (!songToUse) return;
    setIsLoading(true);
    try {
      const candidate = songToUse.title || songToUse.titulo || songToUse.name || songToUse.artista || songToUse.artist || songToUse.identifier || '';
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
            if (coverFile) highResCover = `https://archive.org/0/items/${item.identifier}/${coverFile.name}?cnt=0`;
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
          setCurrentSong({ ...songs[0], isLiked: stateRef.current.likedSongs.has(songs[0].id), playRequestId: Date.now() });
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
  }, []);

  // --- QUEUE LOGIC ---
  const playSongList = useCallback((songs, startIndex = 0) => {
    if (!songs?.length) return;
    setOriginalQueue(songs);
    const song = songs[startIndex];
    setCurrentIndex(startIndex);
    setCurrentSong({ ...song, isLiked: stateRef.current.likedSongs.has(song.id), playRequestId: Date.now() });
  }, []);

  const nextSong = useCallback(async () => {
    const { originalQueue, currentIndex, currentSong } = stateRef.current;
    if (originalQueue.length > 0 && currentIndex < originalQueue.length - 1) {
      const nextIdx = currentIndex + 1;
      const nextS = originalQueue[nextIdx];
      setCurrentIndex(nextIdx);
      setCurrentSong({ ...nextS, isLiked: stateRef.current.likedSongs.has(nextS.id), playRequestId: Date.now() });
    } else {
      console.log("Fin de la lista, buscando recomendaciones...");
      await fetchRecommendations(currentSong);
    }
  }, [fetchRecommendations]);

  const previousSong = useCallback(() => {
    const { originalQueue, currentIndex } = stateRef.current;
    const { current } = getPlayers();
    if (current.currentTime > 3) {
      seek(0);
      return;
    }
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      const prevS = originalQueue[prevIdx];
      setCurrentIndex(prevIdx);
      setCurrentSong({ ...prevS, isLiked: stateRef.current.likedSongs.has(prevS.id), playRequestId: Date.now() });
    }
  }, [seek, getPlayers]);

  const addToQueue = useCallback((song) => {
    setOriginalQueue(prev => [...prev, song]);
  }, []);

  const playNext = useCallback((song) => {
    setOriginalQueue(prev => {
      const newQueue = [...prev];
      newQueue.splice(stateRef.current.currentIndex + 1, 0, song);
      return newQueue;
    });
  }, []);

  const reorderQueue = useCallback((newQueue) => {
    if (stateRef.current.currentSong) {
      const newIndex = newQueue.findIndex(s => s.id === stateRef.current.currentSong.id);
      if (newIndex !== -1) {
        setCurrentIndex(newIndex);
      }
    }
    setOriginalQueue(newQueue);
  }, []);

  // --- LIKES LOGIC ---
  useEffect(() => {
    if (!isAuthenticated) {
      setLikedSongs(new Set());
      return;
    }
    let mounted = true;
    const fetchAllLikedSongs = async () => {
      try {
        const [localRes, iaRes] = await Promise.all([
          api.get('/music/songs/likes'),
          api.get('/music/ia/likes')
        ]);
        const localData = localRes.data || [];
        const iaData = iaRes.data || [];
        const allLikedIds = new Set([
          ...localData.map(s => s.id || s.songId).filter(Boolean),
          ...iaData.map(s => s.id).filter(Boolean)
        ]);
        if (mounted) setLikedSongs(allLikedIds);
      } catch (err) { }
    };
    fetchAllLikedSongs();
    return () => { mounted = false; };
  }, [isAuthenticated]);

  const toggleLike = useCallback(async (songId, songData) => {
    if (!songId) return;
    const isIa = songData?.identifier || songData?.source === 'internet_archive' || (typeof songId === 'string' && songId.includes('-'));

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
        }, { headers: { Authorization: `Bearer ${token}` } });
      } else {
        await api.post(`/music/songs/${songId}/like`, null, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setCurrentSong(cs => {
        if (!cs || cs.id !== songId) return cs;
        return { ...cs, isLiked: !prevLikeRef.current?.wasLiked };
      });
      prevLikeRef.current = null;
    } catch (err) {
      console.error("No se pudo actualizar el like:", err);
      const prev = prevLikeRef.current;
      if (prev && prev.songId === songId) {
        setLikedSongs(curr => {
          const newSet = new Set(curr);
          if (prev.wasLiked) newSet.add(songId);
          else newSet.delete(songId);
          return newSet;
        });
      }
    }
  }, []);

  const isSongLiked = useCallback((id) => stateRef.current.likedSongs.has(id), []);

  // --- AUDIO ENGINE EFFECT (Dual Engine Core) ---
  useEffect(() => {
    if (!currentSong) return;

    const { voxMode, voxTracks, voxType } = stateRef.current;

    // 1. Determinar URL
    let src = currentSong.url;
    if (voxMode && voxTracks?.songId === currentSong.id) src = voxTracks[voxType];
    if (voxMode && voxTracks?.songId !== currentSong.id) {
      setVoxMode(false);
      src = currentSong.url;
    }

    // 2. Normalizar
    const normalize = (u) => { try { return new URL(u, window.location.href).href; } catch { return u; } };
    const newSrc = normalize(src);

    // Get players
    const { current: activeAudio, next: nextAudio } = getPlayers();
    const currentSrc = activeAudio.src;

    // CHECK IF WE SHOULD CROSSFADE
    const isNewSong = lastSongIdRef.current !== currentSong.id;

    if (isNewSong && stateRef.current.isPlaying && lastSongIdRef.current !== null) {
      // Si ya hay un crossfade ocurriendo (cambio rápido), CANCELAR y hacer Hard Cut
      if (crossfadeIntervalRef.current) {
        console.log("⚠️ Crossfade Interrupted - Hard Cut");
        clearInterval(crossfadeIntervalRef.current);
        crossfadeIntervalRef.current = null;

        // Detener todo
        activeAudio.pause();
        nextAudio.pause();

        // Resetear volúmenes
        activeAudio.volume = stateRef.current.volume;
        nextAudio.volume = stateRef.current.volume;

        // Cargar en el activo directamente
        activeAudio.src = src;
        activeAudio.currentTime = 0;
        activeAudio.load();
        activeAudio.play().catch(e => console.error("Hard cut play error", e));
      } else {
        // CROSSFADE NORMAL
        console.log("🔀 Smart Crossfade Initiated");
        nextAudio.src = src;
        nextAudio.load();
        performCrossfade(6); // 6 seconds default
      }

      // Update history
      addToHistory(currentSong.id);
    } else if (currentSrc !== newSrc || isNewSong) {
      // Standard load (First play, or VOX toggle, or paused change)
      const wasPlaying = !activeAudio.paused;
      const prevTime = activeAudio.currentTime;

      activeAudio.src = src;
      // Restore time if toggling VOX
      if (voxMode && voxTracks?.songId === currentSong.id && !isNewSong) {
        activeAudio.currentTime = prevTime;
      }

      activeAudio.load();

      // AUTO-PLAY LOGIC FIX
      // If it's a new song (user clicked it), we MUST play.
      // If it's just a source change (VOX toggle), we respect previous state.
      if (isNewSong || wasPlaying || stateRef.current.isPlaying) {
        const playPromise = activeAudio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => setIsPlaying(true))
            .catch(e => {
              console.warn("Auto-play prevented:", e);
              setIsPlaying(false);
            });
        }
      }
      addToHistory(currentSong.id);
    }

    lastSongIdRef.current = currentSong.id;

    // 3. Metadata Quality (IA)
    if (src && src.includes('archive.org')) {
      // ... (Logic omitted for brevity)
    }

  }, [currentSong, voxMode, voxType, voxTracks, addToHistory, performCrossfade, getPlayers]);

  // --- EVENT LISTENERS (Dual) ---
  useEffect(() => {
    const listeners = [audioRefA.current, audioRefB.current];

    const updateTime = (e) => {
      // Only update time from the ACTIVE player
      if (e.target === getPlayers().current) {
        setCurrentTime(e.target.currentTime);
        if (e.target.duration && e.target.duration !== Infinity) setDuration(e.target.duration);
      }
    };

    const handleEnded = (e) => {
      if (e.target === getPlayers().current) {
        // NO detener la reproducción, dejar que nextSong maneje el flujo
        // setIsPlaying(false); <--- REMOVED
        nextSong();
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => {
      // Solo marcar pausa si NO estamos en crossfade
      if (!crossfadeIntervalRef.current) setIsPlaying(false);
    };

    listeners.forEach(audio => {
      audio.addEventListener('timeupdate', updateTime);
      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('play', handlePlay);
      audio.addEventListener('pause', handlePause);
    });

    return () => {
      listeners.forEach(audio => {
        audio.removeEventListener('timeupdate', updateTime);
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('play', handlePlay);
        audio.removeEventListener('pause', handlePause);
      });
    };
  }, [nextSong, getPlayers]);

  // --- MEMOIZED VALUES ---

  const playerStateValue = useMemo(() => ({
    currentSong, isPlaying, isLoading, volume, isMuted, isFullScreenOpen,
    likedSongs, originalQueue, currentIndex,
    spectraData, detectedQuality, voxMode, voxType, isVoxLoading, voxTracks,
    hasNext: originalQueue.length > 0,
    hasPrevious: currentIndex > 0 || currentTime > 3
  }), [
    currentSong, isPlaying, isLoading, volume, isMuted, isFullScreenOpen,
    likedSongs, originalQueue, currentIndex,
    spectraData, detectedQuality, voxMode, voxType, isVoxLoading, voxTracks, currentTime
  ]);

  const playerProgressValue = useMemo(() => ({
    currentTime,
    duration,
    progress: duration ? (currentTime / duration) * 100 : 0
  }), [currentTime, duration]);

  const playerActionsValue = useMemo(() => ({
    playSongList, togglePlayPause, nextSong, previousSong, addToQueue,
    playNext, changeVolume, toggleMute, seek,
    openFullScreenPlayer: () => setIsFullScreenOpen(true),
    closeFullScreenPlayer: () => setIsFullScreenOpen(false),
    toggleFullScreenPlayer: () => setIsFullScreenOpen(p => !p),
    toggleLike, isSongLiked,
    updateSpectraData, resetSpectraData, updateSpectraField,
    toggleVox, toggleVoxType
  }), [
    playSongList, togglePlayPause, nextSong, previousSong, addToQueue,
    playNext, changeVolume, toggleMute, seek, toggleLike, isSongLiked,
    updateSpectraData, resetSpectraData, updateSpectraField, toggleVox, toggleVoxType
  ]);

  const legacyContextValue = useMemo(() => ({
    audioRef: audioRefA, // Expose primary ref for legacy compatibility
    ...playerStateValue, ...playerProgressValue, ...playerActionsValue
  }), [playerStateValue, playerProgressValue, playerActionsValue]);

  return (
    <PlayerStateContext.Provider value={playerStateValue}>
      <PlayerProgressContext.Provider value={playerProgressValue}>
        <PlayerActionsContext.Provider value={playerActionsValue}>
          <PlayerContext.Provider value={legacyContextValue}>
            {children}
          </PlayerContext.Provider>
        </PlayerActionsContext.Provider>
      </PlayerProgressContext.Provider>
    </PlayerStateContext.Provider>
  );
}
