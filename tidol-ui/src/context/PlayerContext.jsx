// src/context/PlayerContext.jsx
import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback
} from 'react';
import api from '../api/axiosConfig';

const PlayerContext = createContext();
export const usePlayer = () => useContext(PlayerContext);

export function PlayerProvider({ children }) {
  const [currentSong, setCurrentSong] = useState(null);
  const [originalQueue, setOriginalQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playedHistory, setPlayedHistory] = useState([]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  const [isFullScreenOpen, setIsFullScreenOpen] = useState(false);
  const openFullScreenPlayer = () => setIsFullScreenOpen(true);
  const toggleFullScreenPlayer = () => setIsFullScreenOpen(prev => !prev);
  const closeFullScreenPlayer = () => setIsFullScreenOpen(false);

  // likedSongs como Set
  const [likedSongs, setLikedSongs] = useState(new Set());
  const prevLikeRef = useRef(null);

  const audioRef = useRef(null);
  const hasUserInteracted = useRef(false);

  // ---------- helpers ----------
  const addToHistory = useCallback((songId) => {
    setPlayedHistory(prev => prev.includes(songId) ? prev : [...prev, songId]);
  }, []);

  // Cargar liked songs al inicio
  useEffect(() => {
    let mounted = true;
    const fetchLikedSongs = async () => {
      try {
        const res = await api.get('/music/songs/likes');
        const data = res.data;
        const arr = Array.isArray(data) ? data : (Array.isArray(data?.likes) ? data.likes : []);
        const likedIds = new Set(arr.map(song => song.songId || song.id || song.id_cancion || null).filter(Boolean));
        if (mounted) setLikedSongs(likedIds);
      } catch (err) {
        console.error("Error al cargar likes:", err);
      }
    };
    fetchLikedSongs();
    return () => { mounted = false; };
  }, []);

  const toggleLike = useCallback(async (songId) => {
    if (!songId) return;

    // Optimistic UI
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
      await api.post(`/music/songs/${songId}/like`, null, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // sincronizar currentSong.isLiked si es la pista actual
      setCurrentSong(cs => {
        if (!cs) return cs;
        if (cs.id === songId) {
          return { ...cs, isLiked: !prevLikeRef.current?.wasLiked };
        }
        return cs;
      });
      prevLikeRef.current = null;
    } catch (err) {
      // rollback
      const prev = prevLikeRef.current;
      if (prev && prev.songId === songId) {
        setLikedSongs(curr => {
          const newSet = new Set(curr);
          if (prev.wasLiked) newSet.add(songId);
          else newSet.delete(songId);
          return newSet;
        });
      }
      console.error("No se pudo actualizar el like en el servidor para songId:", songId, err);
    }
  }, []);

  const isSongLiked = useCallback((songId) => {
    return likedSongs.has(songId);
  }, [likedSongs]);

  // Gesto del usuario para autoplay
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

  // Sincronizar isLiked en currentSong
  useEffect(() => {
    setCurrentSong(prev => {
      if (!prev) return prev;
      const liked = likedSongs.has(prev.id);
      if (prev.isLiked === liked) return prev;
      return { ...prev, isLiked: liked };
    });
  }, [likedSongs]);

  // Reproduce una lista
  const playSongList = useCallback((songs, startIndex = 0) => {
    if (!songs || songs.length === 0) return;
    setOriginalQueue(songs);
    const mainSong = songs[startIndex];
    setCurrentIndex(startIndex);
    setCurrentSong({ ...mainSong, isLiked: likedSongs.has(mainSong.id) });
    addToHistory(mainSong.id);
  }, [addToHistory, likedSongs]);

  // Radio infinita
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
            id: item.identifier || item.id || `ia_${idx}_${Math.random().toString(36).slice(2,8)}`,
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
          setCurrentSong({ ...songs[0], isLiked: likedSongs.has(songs[0].id) });
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
      setCurrentSong({ ...nextSongData, isLiked: likedSongs.has(nextSongData.id) });
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
        setCurrentSong({ ...prevSongData, isLiked: likedSongs.has(prevSongData.id) });
      }
    }
  }, [currentIndex, originalQueue, likedSongs]);

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

  // Actualiza audio.src y gatea autoplay por interacción del usuario
  useEffect(() => {
    if (!currentSong) return;
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

    // Historial no bloqueante
    api.post('/history/add', {
      songId: currentSong.id,
      titulo: currentSong.titulo,
      artista: currentSong.artista,
      url: currentSong.url,
      portada: currentSong.portada,
    }).catch(err => console.error("DB Historial error:", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong]);

  // Eventos del audio
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

    const onLoadStart = () => {
      setIsLoading(true);
    };

    const onCanPlay = () => {
      setIsLoading(false);
    };

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

  return (
    <PlayerContext.Provider
      value={{
        audioRef,
        currentSong,
        isPlaying,
        isLoading,
        volume,
        isMuted,
        currentTime,
        duration,
        progress,
        hasNext: originalQueue.length > 0,
        hasPrevious: currentIndex > 0 || currentTime > 3,
        playSongList,
        togglePlayPause,
        nextSong,
        previousSong,
        changeVolume,
        toggleMute,
        seek,
        isFullScreenOpen,
        openFullScreenPlayer,
        toggleFullScreenPlayer,
        closeFullScreenPlayer,
        toggleLike,
        isSongLiked,
        likedSongs
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}
