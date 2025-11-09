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
  const [playlist, setPlaylist] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playedHistory, setPlayedHistory] = useState([]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullScreenPlayerOpen, setFullScreenPlayerOpen] = useState(false);

  const audioRef = useRef(new Audio());

  const addToHistory = useCallback((songId) => {
    setPlayedHistory(prev => prev.includes(songId) ? prev : [...prev, songId]);
  }, []);

  const playSongList = useCallback((songs, startIndex = 0) => {
    if (!songs || songs.length === 0) return;
    const mainSong = songs[startIndex];
    setCurrentSong(mainSong);
    setPlaylist(songs.slice(startIndex + 1));
    setCurrentIndex(startIndex);
    addToHistory(mainSong.id);
  }, [addToHistory]);

  // --- Ahora las recomendaciones provienen EXCLUSIVAMENTE de Internet Archive ---
  const fetchRecommendations = useCallback(async (songToUse) => {
    if (!songToUse) return;
    setIsLoading(true);
    try {
      // Construimos una query razonable a partir del objeto de canción (varios campos posibles)
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
        // Mapear a la forma que nuestro player espera
        const songs = results.map((item, idx) => ({
          id: item.identifier || item.id || `ia_${idx}_${Math.random().toString(36).slice(2,8)}`,
          url: item.url || item.file || item.playbackUrl || (`https://archive.org/download/${item.identifier}/${item.filename || ''}`),
          titulo: item.title || item.titulo || 'Sin título',
          artista: item.artist || item.creator || item.artista || 'Internet Archive',
          portada: item.thumbnail || item.thumbnail_url || item.image || (`https://archive.org/services/img/${item.identifier}`),
          duracion: item.duration || 0
        })).filter(s => s.url); // filtramos cualquier entrada sin URL reproducible

        if (songs.length > 0) {
          playSongList(songs, 0);
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
  }, [playSongList]);

  const nextSong = useCallback(async () => {
    if (playlist.length > 0) {
      setCurrentSong(playlist[0]);
      setPlaylist(prev => prev.slice(1));
      setCurrentIndex(prev => prev + 1);
    } else {
      // Cuando no hay playlist, pedimos más canciones a Internet Archive usando la canción actual como semilla
      await fetchRecommendations(currentSong);
    }
  }, [playlist, currentSong, fetchRecommendations]);

  const previousSong = useCallback(() => {
    if (audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }
    if (currentIndex > 0) {
      const prevSongId = playedHistory[currentIndex - 1];
      const prevSong = playlist.find(s => s.id === prevSongId);
      if (prevSong) setCurrentSong(prevSong);
    }
  }, [currentIndex, playedHistory, playlist]);

  const togglePlayPause = useCallback(() => {
    if (!currentSong) return;
    isPlaying ? audioRef.current.pause() : audioRef.current.play();
  }, [currentSong, isPlaying]);

  const seek = useCallback((newTime) => {
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  }, []);

  const changeVolume = useCallback((newVolume) => {
    const audio = audioRef.current;
    audio.volume = newVolume;
    audio.muted = newVolume === 0;
  }, []);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    audio.muted = !audio.muted;
    if (!audio.muted && audio.volume === 0) audio.volume = 0.5;
  }, []);

  useEffect(() => {
    if (!currentSong) return;
    const audio = audioRef.current;
    audio.src = currentSong.url;

    audio.play()
      .then(() => setIsPlaying(true))
      .catch(() => { /* autoplay bloqueado o error, se ignora */ });

    addToHistory(currentSong.id);

    // historial local (si existe backend)
    api.post('/history/add', { songId: currentSong.id })
      .catch(err => console.error("DB Historial error:", err));

  }, [currentSong, addToHistory]);

  useEffect(() => {
    const audio = audioRef.current;

    const onTimeUpdate = () => {
      const t = audio.currentTime;
      const d = audio.duration;
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
        seek
      }}>
      {children}
    </PlayerContext.Provider>
  );
}
