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

// --- Constants ---
const AUDIO_CONFIG = {
  RESTART_THRESHOLD: 3, // seconds
  CROSSFADE_FPS: 60,
  CROSSFADE_DURATION_NORMAL: 2, // seconds
  CROSSFADE_DURATION_DJ: 6,
  DJ_CUE_OUT_OFFSET: 3, // Reduced from 6 to 3 for tighter mix
  TIME_UPDATE_THROTTLE: 100, // ms (~10fps)
  MAX_SMART_MIX_RETRIES: 3,
  SUPPORTED_FORMATS: ['mp3', 'ogg', 'wav', 'flac', 'm4a', 'aac', 'webm']
};

// --- Context Definitions ---
const PlayerStateContext = createContext();
const PlayerProgressContext = createContext();
const PlayerActionsContext = createContext();
const PlayerContext = createContext();

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
  const [spectraData, setSpectraData] = useState({
    waveform: [],
    lyrics: [],
    bpm: null,
    key: null,
    status: 'idle'
  });
  const [voxMode, setVoxMode] = useState(false);
  const [voxType, setVoxType] = useState('vocals');
  const [voxTracks, setVoxTracks] = useState(null);
  const [isVoxLoading, setIsVoxLoading] = useState(false);

  // DJ Mode State
  const [djMode, setDjMode] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState('off'); // 'off', 'all', 'one'

  // --- STATE (Datos Rápidos) ---
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [lastSwapTime, setLastSwapTime] = useState(0); // Triggers preload after swap

  // --- REFS (Dual Audio Engine) ---
  const audioRefA = useRef(new Audio());
  const audioRefB = useRef(new Audio());
  const activePlayerRef = useRef('A');
  const crossfadeIntervalRef = useRef(null);

  // Control refs
  const hasUserInteracted = useRef(false);
  const prevLikeRef = useRef(null);
  const lastSongIdRef = useRef(null);
  const smartMixAttemptsRef = useRef(0);
  const lastCueTriggerRef = useRef(null);
  const throttledSetCurrentTime = useRef(null);
  const lastTransitionIdRef = useRef(0);
  const songStartTimeRef = useRef(0);
  const lastPlayRequestIdRef = useRef(null);

  const { isAuthenticated } = useAuth();

  // Helper to get active and next player
  const getPlayers = useCallback(() => {
    if (activePlayerRef.current === 'A') {
      return { current: audioRefA.current, next: audioRefB.current };
    }
    return { current: audioRefB.current, next: audioRefA.current };
  }, []);

  // Unified state ref
  const stateRef = useRef({
    currentSong,
    originalQueue,
    currentIndex,
    isPlaying,
    volume,
    isMuted,
    likedSongs,
    voxMode,
    voxTracks,
    voxType,
    djMode,
    isTransitioning: false
  });

  // Sync state to ref
  useEffect(() => {
    stateRef.current = {
      currentSong,
      originalQueue,
      currentIndex,
      isPlaying,
      volume,
      isMuted,
      likedSongs,
      voxMode,
      voxTracks,
      voxType,
      djMode,
      isShuffle,
      repeatMode,
      isTransitioning: stateRef.current.isTransitioning
    };
  }, [
    currentSong,
    originalQueue,
    currentIndex,
    isPlaying,
    volume,
    isMuted,
    likedSongs,
    voxMode,
    voxTracks,
    voxType,
    djMode,
    isShuffle,
    repeatMode
  ]);

  // --- AUDIO VALIDATION ---
  const isValidAudioUrl = useCallback((url) => {
    if (!url) return false;
    try {
      const urlObj = new URL(url, window.location.href);
      const pathname = urlObj.pathname || '';
      const ext = pathname.split('.').pop()?.toLowerCase();

      // 1) Common case: explicit extension known and supported
      if (ext && AUDIO_CONFIG.SUPPORTED_FORMATS.includes(ext)) return true;

      // 2) Known hosts/paths allowed (but validate more strictly)
      if (url.includes('archive.org') || url.includes('stream')) return true;

      // 3) Spectra stems: accept only if path contains a supported extension
      if (url.includes('/spectra')) {
        // Ensure the path contains a file with extension
        if (ext && AUDIO_CONFIG.SUPPORTED_FORMATS.includes(ext)) return true;
        return false;
      }

      return false;
    } catch {
      return false;
    }
  }, []);

  // --- INITIAL AUDIO SETUP ---
  useEffect(() => {
    [audioRefA.current, audioRefB.current].forEach(audio => {
      audio.preload = 'auto';
      audio.crossOrigin = 'anonymous';
    });

    const handleInteraction = () => {
      hasUserInteracted.current = true;
    };

    window.addEventListener('click', handleInteraction, { once: true });

    return () => {
      window.removeEventListener('click', handleInteraction);

      // Cleanup audio instances
      [audioRefA.current, audioRefB.current].forEach(audio => {
        audio.pause();
        audio.src = '';
        audio.load();
        audio.remove?.();
      });

      // Clear intervals
      if (crossfadeIntervalRef.current) {
        clearInterval(crossfadeIntervalRef.current);
        crossfadeIntervalRef.current = null;
      }
    };
  }, []);

  // --- AUTO-EXTRACTION: Request colors if missing (Just-in-Time) ---
  useEffect(() => {
    if (!currentSong) return;

    // Skip if already has colors or no cover image
    if (currentSong.extractedColors || !currentSong.portada) return;

    // Skip if already requested (prevent loops)
    if (currentSong._colorRequested) return;


    // Mark as requested to prevent duplicate calls
    setCurrentSong(prev => ({ ...prev, _colorRequested: true }));

    // Request extraction (non-blocking, graceful fallback)
    api.post('/colors/extract', {
      imageUrl: currentSong.portada,
      songId: currentSong.id,
      source: currentSong.source || 'local'
    })
      .then(({ data }) => {
        if (data.success && data.colors) {
          // Update currentSong with new colors (Aurora will transition smoothly)
          setCurrentSong(prev => ({
            ...prev,
            extractedColors: data.colors
          }));
        }
      })
      .catch(err => {
        console.error('[Colors] ✗ Extraction failed:', err.message);
        // Fallback remains (pink/cyan/purple from AmbientBackground.jsx)
      });
  }, [currentSong?.id]);

  // --- CROSSFADE LOGIC ---
  const performCrossfade = useCallback(
    async (duration = AUDIO_CONFIG.CROSSFADE_DURATION_DJ) => {
      const active = getPlayers().current;
      const next = getPlayers().next;
      const nextSong = stateRef.current.currentSong;

      if (!active || !next || !nextSong) return;

      // Clear existing crossfade
      if (crossfadeIntervalRef.current) {
        clearInterval(crossfadeIntervalRef.current);
        crossfadeIntervalRef.current = null;
      }

      // Generate Transition ID
      const transitionId = Date.now();
      lastTransitionIdRef.current = transitionId;
      stateRef.current.isTransitioning = true;

      const targetVolume = stateRef.current.volume;
      const steps = AUDIO_CONFIG.CROSSFADE_FPS * duration;
      let step = 0;

      next.volume = 0;

      try {
        console.log('⏳ Starting Crossfade: Waiting for next.play()...');
        await next.play();
        console.log('✅ Crossfade: next.play() successful');
      } catch (e) {
        console.warn('Crossfade play error:', e);

        // FALLBACK: Hard Cut on Active if crossfade fails
        if (lastTransitionIdRef.current === transitionId) {
          console.log("⚠️ Crossfade failed - Falling back to Hard Cut on Active");
          stateRef.current.isTransitioning = false;

          next.pause();
          next.currentTime = 0;

          // Force play on active
          active.src = nextSong.url;
          active.volume = targetVolume;
          active.play().catch(err => console.error("Fallback play error", err));
        }
        return;
      }

      // Check if cancelled during await
      if (lastTransitionIdRef.current !== transitionId) {
        console.log("⚠️ Crossfade cancelled during async play");
        next.pause(); // Ensure we stop the player if it just started
        return;
      }

      crossfadeIntervalRef.current = setInterval(() => {
        step++;
        const t = step / steps;

        // Equal Power Crossfade
        const fadeOutGain = Math.cos(t * 0.5 * Math.PI);
        const fadeInGain = Math.sin(t * 0.5 * Math.PI);

        active.volume = targetVolume * fadeOutGain;
        next.volume = targetVolume * fadeInGain;

        if (step >= steps) {
          clearInterval(crossfadeIntervalRef.current);

          active.pause();
          active.currentTime = 0;
          active.volume = targetVolume;
          next.volume = targetVolume;

          // Swap active player
          activePlayerRef.current = activePlayerRef.current === 'A' ? 'B' : 'A';
          stateRef.current.isTransitioning = false;

          crossfadeIntervalRef.current = null;
          setLastSwapTime(Date.now()); // Trigger preloading

          console.log(`🔀 Crossfade Complete. Active: ${activePlayerRef.current}`);
        }
      }, 1000 / AUDIO_CONFIG.CROSSFADE_FPS);
    },
    [getPlayers]
  );

  // --- PLAYER CONTROLS ---
  const togglePlayPause = useCallback(() => {
    const { current } = getPlayers();

    if (stateRef.current.isPlaying) {
      current.pause();

      // Pause crossfade if active
      if (crossfadeIntervalRef.current) {
        clearInterval(crossfadeIntervalRef.current);
        crossfadeIntervalRef.current = null;
        const { next } = getPlayers();
        next.pause();
        stateRef.current.isTransitioning = false;
      }
    } else {
      current.play().catch(e => console.warn('Play error:', e));
    }
  }, [getPlayers]);

  const seek = useCallback(
    time => {
      if (Number.isFinite(time)) {
        const { current } = getPlayers();
        current.currentTime = time;
        setCurrentTime(time);
      }
    },
    [getPlayers]
  );

  const changeVolume = useCallback(
    val => {
      const newVol = Math.min(1, Math.max(0, val));
      const { current, next } = getPlayers();

      current.volume = newVol;
      current.muted = newVol === 0;
      next.volume = newVol;

      setVolume(newVol);
      setIsMuted(newVol === 0);
    },
    [getPlayers]
  );

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

  // --- HISTORY ---
  const addToHistory = useCallback(songId => {
    const song = stateRef.current.currentSong;
    if (!song || song.id !== songId) return;

    const isIaSong = song.identifier || song.source === 'internet_archive' || (song.url && song.url.includes('archive.org'));

    api
      .post('/history/add', {
        songId: song.id,
        titulo: song.titulo || song.title,
        artista: song.artista || song.artist,
        url: song.url,
        portada: song.portada,
        // Pass identifier and isIa so backend can normalize and store correctly
        identifier: song.identifier,
        isIa: !!isIaSong,
        originalUrl: song.originalUrl
      })
      .catch(err => console.error('DB Historial error:', err));
  }, []);

  // --- SPECTRA & VOX ---
  const updateSpectraData = useCallback(
    data => setSpectraData(prev => ({ ...prev, ...data })),
    []
  );

  const resetSpectraData = useCallback(
    () =>
      setSpectraData({
        waveform: [],
        lyrics: [],
        bpm: null,
        key: null,
        status: 'idle'
      }),
    []
  );

  const updateSpectraField = useCallback(
    (field, value) => setSpectraData(prev => ({ ...prev, [field]: value })),
    []
  );

  const toggleVox = useCallback(async () => {
    const { currentSong, voxMode, voxTracks, voxType } = stateRef.current;

    if (!currentSong) return;

    // Cycle: Off -> Karaoke (Accompaniment) -> Vocals -> Off
    if (voxMode) {
      if (voxType === 'accompaniment') {
        // Switch to Vocals
        setVoxType('vocals');
        return;
      } else {
        // Switch to Off
        setVoxMode(false);
        return;
      }
    }

    // Attempt to turn ON (Default to Accompaniment/Karaoke)
    if (voxTracks && voxTracks.songId === currentSong.id) {
      setVoxMode(true);
      setVoxType('accompaniment');
      return;
    }

    setIsVoxLoading(true);

    try {
      const isIA = currentSong.url?.includes('archive.org');
      const endpoint = isIA
        ? '/spectra/vox/separate'
        : `/spectra/local/vox/separate/${currentSong.id}`;
      const params = isIA
        ? { ia_id: currentSong.identifier || currentSong.id }
        : {};

      const res = await axios.post(endpoint, params);

      // Validate returned URLs before accepting them
      const vocalsPath = res?.data?.vocals;
      const accompPath = res?.data?.accompaniment;

      if ((res.data && res.data.status === 'success') && vocalsPath && accompPath) {
        const vocalsUrl = `/spectra${vocalsPath}`;
        const accompUrl = `/spectra${accompPath}`;

        // Ensure URLs look valid (extensions, etc.)
        if (!isValidAudioUrl(vocalsUrl) || !isValidAudioUrl(accompUrl)) {
          console.error('[VOX] Invalid stems from Spectra:', { vocalsUrl, accompUrl });
          alert('Spectra devolvió rutas inválidas para las pistas separadas. Intente nuevamente más tarde.');
        } else {
          setVoxTracks({
            songId: currentSong.id,
            vocals: vocalsUrl,
            accompaniment: accompUrl
          });

          console.log('[VOX] Tracks ready:', { songId: currentSong.id, vocalsUrl, accompUrl });

          setVoxMode(true);
          setVoxType('accompaniment');
        }
      } else if (res.data && res.data.status === 'processing') {
        // Notify user it's processing
        alert('Spectra está separando las pistas (Karaoke). Esto tomará unos segundos.');
      } else {
        console.error('[VOX] Unexpected Spectra response:', res?.data);
        alert('No se pudo obtener las pistas separadas. Intente de nuevo.');
      }
    } catch (e) {
      console.error('VOX Error:', e);
      alert('Error al conectar con Spectra Engine.');
    } finally {
      setIsVoxLoading(false);
    }
  }, [isValidAudioUrl]);

  const toggleVoxType = useCallback(
    () => setVoxType(prev => (prev === 'vocals' ? 'accompaniment' : 'vocals')),
    []
  );

  const toggleDjMode = useCallback(() => {
    setDjMode(prev => {
      console.log('🎧 Toggling DJ Mode to:', !prev);
      return !prev;
    });
  }, []);

  const toggleShuffle = useCallback(() => {
    setIsShuffle(prev => {
      const newState = !prev;
      const { originalQueue, currentIndex, currentSong } = stateRef.current;

      if (newState && originalQueue.length > 1) {
        // Shuffle logic: Keep current song at index 0, shuffle the rest
        const queueToShuffle = originalQueue.filter((_, idx) => idx !== currentIndex);
        const shuffled = [...queueToShuffle].sort(() => Math.random() - 0.5);
        const newQueue = [originalQueue[currentIndex], ...shuffled];

        setOriginalQueue(newQueue);
        setCurrentIndex(0);
      } else if (!newState) {
        // Simple disable: Keep queue as is for now
        // Note: Real "unshuffle" would require storing the initial order, 
        // but for now we'll just stop the shuffle mode.
      }

      return newState;
    });
  }, []);

  const toggleRepeat = useCallback(() => {
    setRepeatMode(prev => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  }, []);

  // --- RECOMMENDATIONS ---
  const fetchRecommendations = useCallback(async songToUse => {
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

      const res = await api.get(
        `/music/searchArchive?q=${encodeURIComponent(candidate)}`
      );
      const results = res.data || [];

      if (Array.isArray(results) && results.length > 0) {
        const songs = results
          .map((item, idx) => {
            let highResCover = null;

            if (item.files && Array.isArray(item.files)) {
              const coverFile = item.files.find(
                f => f.format?.includes('JPEG') || f.format?.includes('PNG')
              );
              if (coverFile) {
                highResCover = `https://archive.org/0/items/${item.identifier}/${coverFile.name}?cnt=0`;
              }
            }

            const originalUrl =
              item.url ||
              item.file ||
              item.playbackUrl ||
              `https://archive.org/download/${item.identifier}/${item.filename || ''}`;

            const proxyUrl = `${api.defaults.baseURL}/music/stream?url=${encodeURIComponent(originalUrl)}`;

            const identifierClean = item.identifier || item.id || `ia_${idx}_${Math.random().toString(36).slice(2, 8)}`;

            return {
              id: identifierClean,
              identifier: identifierClean,
              url: proxyUrl,
              originalUrl: originalUrl,
              titulo: item.title || item.titulo || 'Sin título',
              artista:
                item.artist ||
                item.creator ||
                item.artista ||
                'Internet Archive',
              portada:
                highResCover ||
                item.thumbnail ||
                item.thumbnail_url ||
                item.image ||
                `https://archive.org/services/img/${item.identifier}`,
              duracion: item.duration || 0,
              source: 'internet_archive'
            };
          })
          .filter(s => s.url);

        if (songs.length > 0) {
          setOriginalQueue(songs);
          setCurrentIndex(0);
          setCurrentSong({
            ...songs[0],
            isLiked: stateRef.current.likedSongs.has(songs[0].id),
            playRequestId: Date.now()
          });
        } else {
          setIsPlaying(false);
        }
      } else {
        setIsPlaying(false);
      }
    } catch (err) {
      console.error('Radio infinita IA Error:', err);
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
    setCurrentSong({
      ...song,
      isLiked: stateRef.current.likedSongs.has(song.id),
      playRequestId: Date.now()
    });
    setIsPlaying(true);
  }, []);

  // Play a specific item in the queue (used by the fullscreen queue UI)
  const playAt = useCallback(index => {
    const { originalQueue } = stateRef.current;
    if (!Array.isArray(originalQueue) || index < 0 || index >= originalQueue.length) return;
    const song = originalQueue[index];

    setCurrentIndex(index);
    setCurrentSong({
      ...song,
      isLiked: stateRef.current.likedSongs.has(song.id),
      playRequestId: Date.now()
    });
    setIsPlaying(true);
  }, []);

  // --- SMART MIX ---
  const getSmartRecommendation = useCallback(async currentSongId => {
    try {
      const res = await api.get(`/music/recommend/${currentSongId}`);

      if (res.data && res.data.success && res.data.recommendation) {
        const rec = res.data.recommendation;
        return {
          id: rec.id,
          titulo: rec.title,
          artista: rec.artist,
          url: rec.url,
          portada: rec.cover,
          bpm: rec.bpm,
          musical_key: rec.key,
          cue_in: rec.cue_in,
          cue_out: rec.cue_out,
          source: 'smart_mix'
        };
      }
    } catch (e) {
      console.error('Smart Mix failed:', e);
    }

    return null;
  }, []);

  const nextSong = useCallback(async () => {
    const { originalQueue, currentIndex, currentSong, djMode, repeatMode } = stateRef.current;

    // 0. Repeat One Logic
    if (repeatMode === 'one' && currentSong) {
      console.log('🔁 [Repeat One] Restarting current song:', currentSong.titulo);
      const { current } = getPlayers();

      // Reset transition safety guards
      stateRef.current.isTransitioning = false;
      lastTransitionIdRef.current = Date.now();

      current.currentTime = 0;
      setIsPlaying(true);
      current.play().catch(e => {
        console.error('🔁 [Repeat One] play error - attempting reload:', e);
        current.load();
        current.play().catch(p2 => console.error('🔁 [Repeat One] reload play failed:', p2));
      });
      return;
    }

    // 1. Normal Queue
    if (originalQueue.length > 0 && currentIndex < originalQueue.length - 1) {
      smartMixAttemptsRef.current = 0;
      const nextIdx = currentIndex + 1;
      const nextS = originalQueue[nextIdx];

      setCurrentIndex(nextIdx);
      setCurrentSong({
        ...nextS,
        isLiked: stateRef.current.likedSongs.has(nextS.id),
        playRequestId: Date.now()
      });
      setIsPlaying(true);
      return;
    }

    // 2. Smart Mix (DJ Mode)
    if (
      djMode &&
      currentSong?.id &&
      smartMixAttemptsRef.current < AUDIO_CONFIG.MAX_SMART_MIX_RETRIES
    ) {
      smartMixAttemptsRef.current++;
      console.log(
        `🎧 DJ Mode: Attempt ${smartMixAttemptsRef.current}/${AUDIO_CONFIG.MAX_SMART_MIX_RETRIES}`
      );

      const smartNext = await getSmartRecommendation(currentSong.id);

      // Re-check queue state after async
      const { originalQueue: latestQueue, currentIndex: latestIdx } =
        stateRef.current;

      if (latestQueue.length > latestIdx + 1) {
        smartMixAttemptsRef.current = 0;
        console.log('⚠️ User added song during Smart Mix - Aborting');
        const nextS = latestQueue[latestIdx + 1];

        setCurrentIndex(latestIdx + 1);
        setCurrentSong({
          ...nextS,
          isLiked: stateRef.current.likedSongs.has(nextS.id),
          playRequestId: Date.now()
        });
        return;
      }

      if (smartNext) {
        smartMixAttemptsRef.current = 0;
        setOriginalQueue(prev => [...prev, smartNext]);
        setCurrentIndex(prev => prev + 1);
        setCurrentSong({
          ...smartNext,
          isLiked: false,
          playRequestId: Date.now()
        });
        return;
      }

      // Retry or fallback
      if (smartMixAttemptsRef.current >= AUDIO_CONFIG.MAX_SMART_MIX_RETRIES) {
        console.log('❌ Smart Mix failed after retries, fallback to IA');
        smartMixAttemptsRef.current = 0;
        await fetchRecommendations(currentSong);
      }
      return;
    }

    // 3. Repeat All Logic (At end of list)
    if (repeatMode === 'all' && originalQueue.length > 0) {
      console.log('🔄 Loop All: Restarting queue');
      playAt(0);
      return;
    }

    // 4. Fallback (IA Radio)
    smartMixAttemptsRef.current = 0;
    console.log('Fin de la lista, buscando recomendaciones...');
    await fetchRecommendations(currentSong);
  }, [fetchRecommendations, getSmartRecommendation, playAt, seek, getPlayers]);

  const previousSong = useCallback(() => {
    const { originalQueue, currentIndex } = stateRef.current;
    const { current } = getPlayers();

    if (current.currentTime > AUDIO_CONFIG.RESTART_THRESHOLD) {
      seek(0);
      return;
    }

    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      const prevS = originalQueue[prevIdx];

      setCurrentIndex(prevIdx);
      setCurrentSong({
        ...prevS,
        isLiked: stateRef.current.likedSongs.has(prevS.id),
        playRequestId: Date.now()
      });
      setIsPlaying(true);
    }
  }, [seek, getPlayers]);

  const addToQueue = useCallback(song => {
    setOriginalQueue(prev => [...prev, song]);
  }, []);

  const playNext = useCallback(song => {
    setOriginalQueue(prev => {
      const newQueue = [...prev];
      newQueue.splice(stateRef.current.currentIndex + 1, 0, song);
      return newQueue;
    });
  }, []);

  const reorderQueue = useCallback(newQueue => {
    if (stateRef.current.currentSong) {
      const newIndex = newQueue.findIndex(
        s => s.id === stateRef.current.currentSong.id
      );
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
      } catch (err) {
        console.error('Error fetching likes:', err);
      }
    };

    fetchAllLikedSongs();

    return () => {
      mounted = false;
    };
  }, [isAuthenticated]);

  const toggleLike = useCallback(async (songId, songData) => {
    // Accept calls like toggleLike(songObj) for convenience
    if (songId && typeof songId === 'object' && !songData) {
      songData = songId;
      songId = songData.id || songData.identifier || songData.url || null;
    }

    if (!songId) return;

    // Debugging info if something unexpected comes in
    if (typeof songId !== 'number' && typeof songId !== 'string') {
      console.warn('toggleLike received unexpected songId type:', typeof songId, songId);
    }

    const isIa =
      songData?.identifier ||
      songData?.source === 'internet_archive' ||
      songData?.url?.includes('archive.org') ||
      (typeof songId === 'string' && songId.toString().startsWith('ia_'));

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
        await api.post(
          `/music/ia/likes/toggle`,
          {
            identifier: songData?.identifier || songId,
            title: songData?.titulo || songData?.title || '',
            artist: songData?.artista || songData?.artist || '',
            source: songData?.source || 'internet_archive',
            // Use originalUrl when available (so backend stores the real IA file URL)
            url: songData?.originalUrl || songData?.url,
            originalUrl: songData?.originalUrl || songData?.url,
            portada: songData?.portada,
            duration: songData?.duration
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else {
        await api.post(`/music/songs/${songId}/like`, null, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      setCurrentSong(cs => {
        if (!cs) return cs;
        // update currentSong.isLiked if matching by either numeric id or archivo/identifier
        const matches = (value) => {
          return cs.id === value || cs.identifier === value || cs.archivo === value || cs.url === value;
        };
        if (matches(songId)) return { ...cs, isLiked: !prevLikeRef.current?.wasLiked };
        return cs;
      });

      prevLikeRef.current = null;
    } catch (err) {
      console.error('No se pudo actualizar el like:', err);

      // Rollback
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

  const isSongLiked = useCallback(id => likedSongs.has(id), [likedSongs]);

  // --- AUDIO ENGINE EFFECT ---
  useEffect(() => {
    if (!currentSong) return;

    // Safety Guard: Prevent loading empty URLs which cause MediaError
    if (!currentSong.url && !currentSong.preview_url) {
      console.warn("⚠️ Skipped playback: Song has no valid URL", currentSong);
      setIsPlaying(false);
      return;
    }

    const { voxMode, voxTracks, voxType } = stateRef.current;

    // 1. Determine URL
    let src = currentSong.url;

    if (voxMode && voxTracks?.songId === currentSong.id) {
      src = voxTracks[voxType];
    }

    if (voxMode && voxTracks?.songId !== currentSong.id) {
      setVoxMode(false);
      src = currentSong.url;
    }

    // 2. Validate
    if (!isValidAudioUrl(src)) {
      console.error('❌ Invalid audio URL:', src);
      setIsPlaying(false);
      return;
    }

    // 3. Normalize
    const normalize = u => {
      try {
        return new URL(u, window.location.href).href;
      } catch {
        return u;
      }
    };

    const newSrc = normalize(src);
    const { current: activeAudio, next: nextAudio } = getPlayers();
    const currentSrc = activeAudio.src;

    // Check if new song
    const isNewSong = lastSongIdRef.current !== currentSong.id;
    console.log(`🎵 Effect Triggered: ${currentSong.titulo} | New: ${isNewSong} | Playing: ${stateRef.current.isPlaying} | LastID: ${lastSongIdRef.current}`);

    if (isNewSong) {
      songStartTimeRef.current = Date.now(); // Reset wall-clock timer
    }

    if (isNewSong && stateRef.current.isPlaying && lastSongIdRef.current !== null) {
      // Hard cut if crossfade already running
      if (crossfadeIntervalRef.current) {
        console.log('⚠️ Crossfade Interrupted - Hard Cut');

        // Cancel pending crossfade
        lastTransitionIdRef.current = Date.now(); // Invalidate pending awaits

        if (crossfadeIntervalRef.current) {
          clearInterval(crossfadeIntervalRef.current);
          crossfadeIntervalRef.current = null;
        }

        // Force stop BOTH players to ensure no zombie audio
        audioRefA.current.pause();
        audioRefB.current.pause();

        activeAudio.volume = stateRef.current.volume;
        nextAudio.volume = stateRef.current.volume;

        activeAudio.src = src;
        activeAudio.currentTime = 0;
        activeAudio.load();
        activeAudio.play().catch(e => console.error('Hard cut play error:', e));

        stateRef.current.isTransitioning = false;
      } else {
        // Normal crossfade
        console.log('🔀 Smart Crossfade Initiated (Condition Met)');

        if (normalize(nextAudio.src) !== normalize(src)) {
          nextAudio.src = src;
          nextAudio.load();
        }

        // DJ Mode cue point
        if (stateRef.current.djMode && currentSong?.cue_in) {
          console.log(`🎧 DJ Mode: Starting at cue_in = ${currentSong.cue_in}s`);
          nextAudio.currentTime = currentSong.cue_in;
        } else {
          nextAudio.currentTime = 0;
        }

        // Instant play if previous ended
        if (activeAudio.ended) {
          console.log('⏩ Previous song ended - Instant Play');
          nextAudio.volume = stateRef.current.volume;
          nextAudio.play().catch(e => console.error('Instant play error:', e));

          activePlayerRef.current = activePlayerRef.current === 'A' ? 'B' : 'A';
          stateRef.current.isTransitioning = false;
        } else {
          const crossfadeDuration = stateRef.current.djMode
            ? AUDIO_CONFIG.CROSSFADE_DURATION_DJ
            : AUDIO_CONFIG.CROSSFADE_DURATION_NORMAL;

          performCrossfade(crossfadeDuration);
        }
      }

      addToHistory(currentSong.id);
    } else if (currentSrc !== newSrc || isNewSong || (currentSong.playRequestId && currentSong.playRequestId !== lastPlayRequestIdRef.current)) {
      console.log('💿 Standard Load (No Crossfade)');
      const forcePlay = currentSong.playRequestId && currentSong.playRequestId !== lastPlayRequestIdRef.current;
      lastPlayRequestIdRef.current = currentSong.playRequestId;

      // Standard load
      const wasPlaying = !activeAudio.paused;
      const prevTime = activeAudio.currentTime;

      // 4. Update Audio Source
      if (!src) {
        console.warn('PlayerContext: Computed src is empty, skipping load', { currentSong, src });
        return;
      }

      // Use the computed `src` (may be vox track or original song URL)
      console.log(`🎚️ Setting audio src -> ${src} (voxMode: ${voxMode})`);
      activeAudio.src = src;
      activeAudio.volume = stateRef.current.volume; // Ensure volume is set

      // Load the new source
      activeAudio.load();

      // Restore time for VOX toggle (preserve playback position)
      if (voxMode && voxTracks?.songId === currentSong.id && !isNewSong && prevTime > 0) {
        console.log(`🎵 Restoring playback position: ${prevTime.toFixed(2)}s`);
        activeAudio.currentTime = prevTime;
      }

      // 5. Try to play (handling autoplay policies)
      if (forcePlay || isNewSong || wasPlaying || stateRef.current.isPlaying) {
        const playPromise = activeAudio.play();

        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsPlaying(true);
              // If successful, we can preload next track if needed
            })
            .catch(error => {
              if (error.name !== 'AbortError') {
                console.error('Playback failed:', error.message);
                setIsPlaying(false);
              }
            });
        }
      }

      if (isNewSong) {
        addToHistory(currentSong.id);
      }
    }

    lastSongIdRef.current = currentSong.id;
  }, [
    currentSong,
    voxMode,
    voxType,
    voxTracks,
    addToHistory,
    performCrossfade,
    getPlayers,
    isValidAudioUrl
  ]);

  // --- PRELOADING ---
  useEffect(() => {
    if (stateRef.current.isTransitioning) {
      console.log('⏳ Preloading deferred: Transition in progress');
      return;
    }

    const { originalQueue, currentIndex } = stateRef.current;
    const nextIndex = currentIndex + 1;

    if (originalQueue.length > nextIndex) {
      const nextS = originalQueue[nextIndex];
      const { next: nextPlayer } = getPlayers();

      if (!nextS?.url || !isValidAudioUrl(nextS.url)) return;

      const normalize = u => {
        try {
          return new URL(u, window.location.href).href;
        } catch {
          return u;
        }
      };

      const nextUrl = normalize(nextS.url);
      const currentNextSrc = normalize(nextPlayer.src);

      if (currentNextSrc !== nextUrl) {
        console.log(`🚀 Preloading: ${nextS.titulo}`);
        nextPlayer.src = nextS.url;

        const handlePreloadError = e => {
          console.error('❌ Preload failed:', e);
        };

        nextPlayer.addEventListener('error', handlePreloadError, { once: true });
        nextPlayer.load();
      }
    }
  }, [currentSong, getPlayers, isValidAudioUrl, lastSwapTime]);

  // --- MEDIA SESSION API ---
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentSong) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentSong.titulo || currentSong.title || 'Unknown Title',
      artist: currentSong.artista || currentSong.artist || 'Unknown Artist',
      album: currentSong.album || 'Tidol',
      artwork: [
        {
          src: currentSong.portada || '/default_cover.png',
          sizes: '512x512',
          type: 'image/png'
        }
      ]
    });

    navigator.mediaSession.setActionHandler('play', togglePlayPause);
    navigator.mediaSession.setActionHandler('pause', togglePlayPause);
    navigator.mediaSession.setActionHandler('previoustrack', previousSong);
    navigator.mediaSession.setActionHandler('nexttrack', nextSong);
    navigator.mediaSession.setActionHandler('seekto', details => {
      if (details.seekTime && Number.isFinite(details.seekTime)) {
        seek(details.seekTime);
      }
    });
  }, [currentSong, togglePlayPause, nextSong, previousSong, seek]);

  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }, [isPlaying]);

  // --- EVENT LISTENERS ---
  useEffect(() => {
    const listeners = [audioRefA.current, audioRefB.current];

    const updateTime = e => {
      if (e.target !== getPlayers().current) return;

      // Throttle updates
      const now = Date.now();
      if (
        throttledSetCurrentTime.current &&
        now - throttledSetCurrentTime.current < AUDIO_CONFIG.TIME_UPDATE_THROTTLE
      ) {
        return;
      }
      throttledSetCurrentTime.current = now;

      const currentTime = e.target.currentTime;
      const duration = e.target.duration || 0;

      setCurrentTime(currentTime);
      if (duration && duration !== Infinity) setDuration(duration);

      // DJ Mode auto-mix
      // console.log(`🔍 UpdateTime - DJ Mode: ${stateRef.current.djMode}`);
      if (stateRef.current.djMode && duration > 10) {
        // Calculate Cue Out with safety clamp (max 15s before end)
        let cueOut = currentSong?.cue_out || (duration - AUDIO_CONFIG.DJ_CUE_OUT_OFFSET);

        // Safety: If cue_out is too early (e.g. > 15s before end), clamp it
        if (duration - cueOut > 15) {
          console.log(`⚠️ Cue Out too early (${cueOut}s), clamping to -15s`);
          cueOut = duration - 15;
        }
        const songId = currentSong?.id;

        // Safety: Wall-Clock Guard (Absolute prevention of early skips)
        const timePlayed = (Date.now() - songStartTimeRef.current) / 1000;
        if (timePlayed < 30 && duration > 60) {
          return;
        }

        if (
          currentTime >= cueOut &&
          !stateRef.current.isTransitioning &&
          lastCueTriggerRef.current !== songId
        ) {
          console.log(
            `🎧 DJ Mode: Auto-mixing at ${currentTime.toFixed(1)}s (Cue Out: ${cueOut}, Duration: ${duration})`
          );
          lastCueTriggerRef.current = songId;
          stateRef.current.isTransitioning = true;
          nextSong();
        }
      }
    };

    const handleEnded = e => {
      // Ignore 'ended' event if we are already transitioning (prevents double skip)
      if (stateRef.current.isTransitioning) {
        console.log('🛑 handleEnded ignored due to active transition');
        return;
      }

      if (e.target === getPlayers().current) {
        nextSong();
      }
    };

    const handlePlay = () => setIsPlaying(true);

    const handlePause = (e) => {
      // Ignore pause from inactive player (e.g. after crossfade swap)
      if (e.target !== getPlayers().current) return;

      if (!crossfadeIntervalRef.current) {
        setIsPlaying(false);
      }
    };

    const handleError = e => {
      console.error('Audio playback error:', e.target.error);
      setIsPlaying(false);
    };

    listeners.forEach(audio => {
      audio.addEventListener('timeupdate', updateTime);
      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('play', handlePlay);
      audio.addEventListener('pause', handlePause);
      audio.addEventListener('error', handleError);
    });

    return () => {
      listeners.forEach(audio => {
        audio.removeEventListener('timeupdate', updateTime);
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('play', handlePlay);
        audio.removeEventListener('pause', handlePause);
        audio.removeEventListener('error', handleError);
      });
    };
  }, [nextSong, getPlayers, currentSong]);

  // --- MEMOIZED VALUES ---
  const playerStateValue = useMemo(
    () => ({
      currentSong,
      isPlaying,
      isLoading,
      volume,
      isMuted,
      isFullScreenOpen,
      likedSongs,
      originalQueue,
      currentIndex,
      spectraData,
      detectedQuality,
      voxMode,
      voxType,
      isVoxLoading,
      voxTracks,
      djMode,
      isShuffle,
      repeatMode,
      hasNext: originalQueue.length > currentIndex + 1,
      hasPrevious: currentIndex > 0 || currentTime > AUDIO_CONFIG.RESTART_THRESHOLD
    }),
    [
      currentSong,
      isPlaying,
      isLoading,
      volume,
      isMuted,
      isFullScreenOpen,
      likedSongs,
      originalQueue,
      currentIndex,
      spectraData,
      detectedQuality,
      voxMode,
      voxType,
      isVoxLoading,
      voxTracks,
      isVoxLoading,
      voxTracks,
      djMode,
      isShuffle,
      repeatMode,
      currentTime
    ]
  );

  const playerProgressValue = useMemo(
    () => ({
      currentTime,
      duration,
      progress: duration ? (currentTime / duration) * 100 : 0
    }),
    [currentTime, duration]
  );

  const playerActionsValue = useMemo(
    () => ({
      playSongList,
      playAt,
      togglePlayPause,
      nextSong,
      previousSong,
      addToQueue,
      playNext,
      reorderQueue,
      changeVolume,
      toggleMute,
      seek,
      openFullScreenPlayer: () => setIsFullScreenOpen(true),
      closeFullScreenPlayer: () => setIsFullScreenOpen(false),
      toggleFullScreenPlayer: () => setIsFullScreenOpen(p => !p),
      toggleLike,
      isSongLiked,
      updateSpectraData,
      resetSpectraData,
      updateSpectraField,
      toggleVox,
      toggleVoxType,
      toggleDjMode,
      toggleShuffle,
      toggleRepeat
    }),
    [
      playSongList,
      playAt,
      togglePlayPause,
      nextSong,
      previousSong,
      addToQueue,
      playNext,
      reorderQueue,
      changeVolume,
      toggleMute,
      seek,
      toggleLike,
      isSongLiked,
      updateSpectraData,
      resetSpectraData,
      updateSpectraField,
      toggleVox,
      toggleVoxType,
      toggleDjMode,
      toggleShuffle,
      toggleRepeat,
      isShuffle,
      repeatMode
    ]
  );

  const legacyContextValue = useMemo(
    () => ({
      audioRef: audioRefA,
      ...playerStateValue,
      ...playerProgressValue,
      ...playerActionsValue
    }),
    [playerStateValue, playerProgressValue, playerActionsValue]
  );

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
