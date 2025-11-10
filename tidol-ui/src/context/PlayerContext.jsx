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
  const [playlist, setPlaylist] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playedHistory, setPlayedHistory] = useState([]);
  const [originalQueue, setOriginalQueue] = useState([]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  const [isFullScreenPlayerOpen, setFullScreenPlayerOpen] = useState(false);
  const toggleFullScreenPlayer = () => setFullScreenPlayerOpen(prev => !prev);
  const closeFullScreenPlayer = () => setFullScreenPlayerOpen(false);

  // Guardamos liked songs como Set para consultas rápidas
  const [likedSongs, setLikedSongs] = useState(new Set());
  const prevLikeRef = useRef(null); // usado para revert en caso de error

  const audioRef = useRef(new Audio());

  const addToHistory = useCallback((songId) => {
    setPlayedHistory(prev => prev.includes(songId) ? prev : [...prev, songId]);
  }, []);

  // Cargar canciones con likes al inicio (maneja diferentes shapes de respuesta)
  // PlayerContext.jsx - useEffect para cargar likes
useEffect(() => {
  const fetchLikedSongs = async () => {
    try {
      const res = await api.get('/music/songs/likes'); // ✅ CORRECTO
      const data = res.data;
      const arr = Array.isArray(data) ? data : (Array.isArray(data?.likes) ? data.likes : []);
      const likedIds = new Set(arr.map(song => song.songId || song.id || song.id_cancion || null).filter(Boolean));
      setLikedSongs(likedIds);
    } catch (err) {
      console.error("Error al cargar likes:", err);
    }
  };
  fetchLikedSongs();
}, []);

  // Toggle like/unlike (optimistic UI). Intenta rutas alternativas para compatibilidad.
  const toggleLike = useCallback(async (songId) => {
    if (!songId) return;

    // Actualización optimista y guardamos estado previo para revert
    setLikedSongs(prev => {
      const newSet = new Set(prev);
      const wasLiked = newSet.has(songId);
      if (wasLiked) newSet.delete(songId);
      else newSet.add(songId);

      // Guardamos para posible revert
      prevLikeRef.current = { songId, wasLiked };
      return newSet;
    });

    const token = localStorage.getItem('token');

    // Intentaremos varias rutas (seguridad ante distintas implementaciones)
    const endpoints = [
      `/music/songs/${songId}/like`,
      `/music/like/${songId}`,
      `/music/songs/${songId}/toggle-like`,
      `/songs/${songId}/like`, // por si el proxy mapea distinto
    ];

    let success = false;
    for (const ep of endpoints) {
      try {
        await api.post(ep, null, { headers: { Authorization: `Bearer ${token}` } });
        success = true;
        break;
      } catch (err) {
        // No rompemos: probamos siguiente endpoint
        // Sólo logeamos en detalle en el último intento
        // console.warn(`Try endpoint ${ep} failed`, err.message);
      }
    }

    if (!success) {
      // Revertir UI si falló todo
      const prev = prevLikeRef.current;
      if (prev && prev.songId === songId) {
        setLikedSongs(curr => {
          const newSet = new Set(curr);
          if (prev.wasLiked) newSet.add(songId);
          else newSet.delete(songId);
          return newSet;
        });
      }
      console.error("No se pudo actualizar el like en el servidor para songId:", songId);
    } else {
      // Si tuvo éxito, actualizamos currentSong.isLiked si aplica
      setCurrentSong(cs => {
        if (!cs) return cs;
        if (cs.id === songId) return { ...cs, isLiked: !prevLikeRef.current?.wasLiked };
        return cs;
      });
      prevLikeRef.current = null;
    }
  }, []);

  // Verificar si una canción está en favoritos
  const isSongLiked = useCallback((songId) => {
    return likedSongs.has(songId);
  }, [likedSongs]);

  // Cuando cambian likedSongs, sincronizamos el currentSong.isLiked
  useEffect(() => {
    if (!currentSong) return;
    const liked = likedSongs.has(currentSong.id);
    if (currentSong.isLiked !== liked) {
      setCurrentSong(prev => prev ? { ...prev, isLiked: liked } : prev);
    }
  }, [likedSongs, currentSong]);

  // Reproduce una lista a partir de un índice
  const playSongList = useCallback((songs, startIndex = 0) => {
    if (!songs || songs.length === 0) return;
    setOriginalQueue(songs);
    const mainSong = songs[startIndex];
    // Añadimos isLiked según el set actual
    setCurrentSong({ ...mainSong, isLiked: likedSongs.has(mainSong.id) });
    setPlaylist(songs.slice(startIndex + 1));
    setCurrentIndex(startIndex);
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
              const subdomain = item.server?.replace(/^https?:\/\//,'') || 'archive.org';
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

        if (songs.length > 0) playSongList(songs, 0);
        else setIsPlaying(false);
      } else {
        setIsPlaying(false);
      }
    } catch (err) {
      console.error("Radio infinita IA Error:", err);
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
    }
  }, [playSongList]);

  const nextSong = useCallback(async () => {
    // Si hay más en la cola original
    if (originalQueue.length > 0 && currentIndex < originalQueue.length - 1) {
      const nextIndex = currentIndex + 1;
      const nextSongData = originalQueue[nextIndex];
      setCurrentSong({ ...nextSongData, isLiked: likedSongs.has(nextSongData.id) });
      setCurrentIndex(nextIndex);
      addToHistory(nextSongData.id);
    } else {
      await fetchRecommendations(currentSong);
    }
  }, [originalQueue, currentIndex, currentSong, fetchRecommendations, addToHistory, likedSongs]);

  const previousSong = useCallback(() => {
    if (!audioRef.current) return;

    // Si la canción lleva más de 3 segundos, reiníciala
    if (audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }

    // Verifica si hay una canción anterior en la cola original
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      const prevSongData = originalQueue[prevIndex];

      if (prevSongData) {
        setCurrentSong({ ...prevSongData, isLiked: likedSongs.has(prevSongData.id) });
        setCurrentIndex(prevIndex);
      }
    }
  }, [currentIndex, originalQueue, likedSongs]);

  const togglePlayPause = useCallback(() => {
    if (!currentSong) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play()
      .catch(err => {
        console.error("Play error:", err);
      });
  }, [currentSong, isPlaying]);

  const seek = useCallback((newTime) => {
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  }, []);

  const changeVolume = useCallback((newVolume) => {
    const audio = audioRef.current;
    audio.volume = newVolume;
    audio.muted = newVolume === 0;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  }, []);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    audio.muted = !audio.muted;
    if (!audio.muted && audio.volume === 0) audio.volume = 0.5;
    setIsMuted(audio.muted);
  }, []);

  // Cuando cambia la canción, actualizamos audio.src y enviamos historial
  useEffect(() => {
    if (!currentSong) return;
    const audio = audioRef.current;
    audio.src = currentSong.url;

    audio.play()
      .then(() => setIsPlaying(true))
      .catch((err) => {
        console.error("Error al reproducir:", err);
        setIsPlaying(false);
      });

    api.post('/history/add', {
      songId: currentSong.id,
      titulo: currentSong.titulo,
      artista: currentSong.artista,
      url: currentSong.url,
      portada: currentSong.portada,
    }).catch(err => console.error("DB Historial error:", err));
  }, [currentSong]);

  // Eventos del audio
  useEffect(() => {
    const audio = audioRef.current;

    const onTimeUpdate = () => {
      const t = audio.currentTime || 0;
      const d = audio.duration || 0;
      setCurrentTime(t);
      if (d > 0) {
        setDuration(d);
        setProgress((t / d) * 100);
      }
    };

    const onEnded = () => nextSong();
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onVolumeChange = () => {
      setVolume(audio.volume);
      setIsMuted(audio.muted);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("volumechange", onVolumeChange);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("volumechange", onVolumeChange);
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
        hasNext: !!currentSong,
        hasPrevious: currentIndex > 0 || currentTime > 3,
        playSongList,
        togglePlayPause,
        nextSong,
        previousSong,
        changeVolume,
        toggleMute,
        seek,
        isFullScreenPlayerOpen,
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
