// src/context/PlayerContext.jsx
import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import api from '../api/axiosConfig';

const PlayerContext = createContext();
export const usePlayer = () => useContext(PlayerContext);

export function PlayerProvider({ children }) {
  // --- ESTADO GLOBAL DEL REPRODUCTOR ---
  const [currentSong, setCurrentSong] = useState(null);
  const [playlist, setPlaylist] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playedHistory, setPlayedHistory] = useState(new Set());
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Estados de la UI
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  const audioRef = useRef(new Audio());

  // --- 3. FUNCIONES DE CONTROL (Definidas ANTES de usarlas) ---

  const addToHistory = useCallback((songId) => {
    setPlayedHistory(prev => new Set(prev).add(songId));
  }, []);

  const playSongList = useCallback((songs, startIndex = 0) => {
    if (!songs || songs.length === 0) return;
    const mainSong = songs[startIndex];
    const nextSongs = songs.slice(startIndex + 1);
    setCurrentSong(mainSong);
    setPlaylist(nextSongs);
    setCurrentIndex(startIndex); // <-- Añadido para reiniciar el índice
    addToHistory(mainSong.id);
  }, [addToHistory]);

  const fetchRecommendations = useCallback(async (songToUse) => {
    if (!songToUse) return;
    console.log("📻 Fin de cola. Buscando radio infinita...");
    setIsLoading(true);

    try {
      const playedIds = Array.from(playedHistory).join(',');
      const res = await api.get(
        `/api/recommendations/${songToUse.id}?played=${playedIds}`
      );
      
      if (res.data && res.data.length > 0) {
        console.log(`📻 Radio encontrada: ${res.data.length} canciones.`);
        playSongList(res.data, 0); 
      } else {
        console.log("📻 No se encontraron más canciones.");
        setIsPlaying(false);
      }
    } catch (err) {
      console.error("Error al buscar radio infinita:", err);
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
    }
  }, [playedHistory, playSongList]);

  const nextSong = useCallback(async () => {
    if (playlist.length > 0) { 
      const nextSongInQueue = playlist[0];
      const remainingQueue = playlist.slice(1);
      
      setCurrentSong(nextSongInQueue);
      setPlaylist(remainingQueue);
      setCurrentIndex(prevIndex => prevIndex + 1); // <-- Actualiza el índice
    } else {
      await fetchRecommendations(currentSong);
    }
  }, [playlist, currentSong, fetchRecommendations]);

  const previousSong = useCallback(() => {
    if (audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0; // Reinicia la canción
    } else if (currentIndex > 0) {
      // Esta lógica es compleja (requiere un historial real de la playlist)
      // Por ahora, la mantenemos simple, pero el botón ya no se bloqueará.
      // Idealmente, aquí buscarías en un historial de playlist, no solo en la 'cola'.
      console.log("Ir a canción anterior (aún no implementado del todo)");
      // const prevIndex = currentIndex - 1;
      // setCurrentIndex(prevIndex);
      // setCurrentSong(playlist[prevIndex]); // <-- 'playlist' aquí es solo la "cola"
    }
  }, [currentIndex, audioRef]); // <-- 'playlist' quitado para evitar bugs

  const seek = useCallback((newTime) => {
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  }, [audioRef]);

  const changeVolume = useCallback((newVolume) => {
    audioRef.current.volume = newVolume;
    audioRef.current.muted = newVolume === 0;
  }, [audioRef]);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (audio.muted) {
      audio.muted = false;
      if (audio.volume === 0) {
        audio.volume = 0.5;
      }
    } else {
      audio.muted = true;
    }
  }, [audioRef]);

  const togglePlayPause = useCallback(() => {
    if (!currentSong) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  }, [currentSong, isPlaying]);


  // --- 4. EFECTOS (AHORA AL FINAL) ---
  
  useEffect(() => {
    if (currentSong) {
      audioRef.current.src = currentSong.url;
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(e => console.warn("Autoplay bloqueado", e));
      
      addToHistory(currentSong.id);
    }
  }, [currentSong, addToHistory]);

  useEffect(() => {
    const audio = audioRef.current;

    const onTimeUpdate = () => {
      const newTime = audio.currentTime;
      const newDuration = audio.duration;
      setCurrentTime(newTime);
      if (newDuration > 0) {
        setDuration(newDuration);
        setProgress((newTime / newDuration) * 100);
      }
    };
    const onDurationChange = () => setDuration(audio.duration || 0);
    const onVolumeChange = () => {
      setVolume(audio.volume);
      setIsMuted(audio.muted);
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => nextSong(); 

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('loadstart', onDurationChange);
    audio.addEventListener('volumechange', onVolumeChange);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('loadstart', onDurationChange);
      audio.removeEventListener('volumechange', onVolumeChange);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
    };
  }, [nextSong]);


  // --- 5. VALORES EXPUESTOS ---
  const value = {
    audioRef,
    currentSong,
    isPlaying,
    isLoading,
    volume,
    isMuted,
    currentTime,
    duration,
    progress,
    hasNext: !!currentSong, // <-- Corregido (igual que antes)
    
    // ***** ¡AQUÍ ESTÁ LA CORRECCIÓN DEL BUG! *****
    hasPrevious: currentIndex > 0 || currentTime > 3, // <-- ¡CORREGIDO!

    playSongList,
    togglePlayPause,
    nextSong,
    previousSong,
    changeVolume,
    toggleMute,
    seek
  };

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}