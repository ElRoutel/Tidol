import React, { useState, useEffect } from "react";
import { useSwipeable } from "react-swipeable";
import { usePlayer } from "../context/PlayerContext";
import api from "../api/axiosConfig";
import '../styles/glass.css';
import favImage from "./favImage.jpg";
import "./Library.css";

// Componente para la fila de canción en la lista
function SongListItem({ song, onPlay, isActive, isArchive = false }) {
  const formatDuration = (s) => {
    if (!s || isNaN(s)) return '--:--';
    const minutes = Math.floor(s / 60);
    const seconds = Math.floor(s % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // LÓGICA CORREGIDA: El backend ahora envía 'titulo' y 'artista' unificados
  // Usamos || para tener soporte retroactivo por si acaso.
  const displayTitle = song.titulo || song.title || "Sin título";
  const displayArtist = song.artista || song.artist || "Desconocido";
  const displayCover = song.portada || song.cover_url || '/default_cover.png';
  const displayDuration = song.duration || song.duracion;

  return (
    <div 
      className={`song-list-item ${isActive ? 'playing' : ''}`} 
      onClick={onPlay}
    >
      <img
        className="song-list-cover"
        src={displayCover}
        alt={displayTitle}
      />
      <div className="song-list-info">
        <span className="title">{displayTitle}</span>
        <span className="artist">{displayArtist}</span>
      </div>
      <div className="song-list-duration">
        {formatDuration(displayDuration)}
      </div>
    </div>
  );
}

function PlaylistItem({ playlist, onSelect }) {
  return (
    <div className="playlist-item" onClick={onSelect}>
      <img
        src={playlist.portada || "https://via.placeholder.com/150"}
        alt={playlist.nombre}
        className="playlist-img"
      />
      <div className="playlist-info">
        <p className="playlist-name">{playlist.nombre}</p>
        <p className="playlist-count">{playlist.canciones?.length || 0} canciones</p>
      </div>
    </div>
  );
}

export default function LibraryPage() {
  const [songs, setSongs] = useState([]);
  const [iaLikes, setIaLikes] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingIaLikes, setLoadingIaLikes] = useState(false);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [currentView, setCurrentView] = useState("favorites");
  const { playSongList, currentSong } = usePlayer();

  // ✅ Carga likes locales
  useEffect(() => {
    const getLikes = async () => {
      try {
        setLoading(true);
        const res = await api.get("/music/songs/likes");
        setSongs(res.data || []);
      } catch (e) {
        console.error("Error obteniendo likes locales:", e);
      } finally {
        setLoading(false);
      }
    };

    getLikes();
  }, []);

  // ✅ Carga likes de IA SOLO cuando cambias a esa vista
  useEffect(() => {
    if (currentView === "ia-likes" && iaLikes.length === 0 && !loadingIaLikes) {
      const getIaLikes = async () => {
        setLoadingIaLikes(true);
        try {
          const res = await api.get("/music/ia/likes");
          setIaLikes(res.data || []);
        } catch (e) {
          console.error("Error obteniendo likes de IA:", e);
        } finally {
          setLoadingIaLikes(false);
        }
      };

      getIaLikes();
    }
  }, [currentView]);

  // ✅ Carga playlists SOLO cuando cambias a esa vista
  useEffect(() => {
    if (currentView === "playlists" && playlists.length === 0 && !loadingPlaylists) {
      const getPlaylists = async () => {
        setLoadingPlaylists(true);
        try {
          const res = await api.get("/playlists");
          setPlaylists(res.data || []);
        } catch (e) {
          console.error("Error obteniendo playlists:", e);
        } finally {
          setLoadingPlaylists(false);
        }
      };

      getPlaylists();
    }
  }, [currentView]);

  // Gestos de swipe
  const handlers = useSwipeable({
    onSwipedLeft: () => {
      if (currentView === "favorites") setCurrentView("ia-likes");
      else if (currentView === "ia-likes") setCurrentView("playlists");
    },
    onSwipedRight: () => {
      if (currentView === "playlists") setCurrentView("ia-likes");
      else if (currentView === "ia-likes") setCurrentView("favorites");
    },
    preventScrollOnSwipe: true,
    trackMouse: true,
    delta: 50
  });

  const handlePlayPlaylist = async (playlistId) => {
    try {
      const res = await api.get(`/playlists/${playlistId}/songs`);
      if (res.data?.length > 0) {
        playSongList(res.data, 0);
      }
    } catch (e) {
      console.error("Error cargando playlist:", e);
    }
  };

  return (
    <div className="library-container" {...handlers}>
      {/* Tabs */}
      <div className="library-tabs">
        <button
          className={`library-tab ${currentView === "favorites" ? "active" : ""}`}
          onClick={() => setCurrentView("favorites")}
        >
          Favoritos
        </button>
        <button
          className={`library-tab ${currentView === "ia-likes" ? "active" : ""}`}
          onClick={() => setCurrentView("ia-likes")}
        >
          Internet Archive
        </button>
        <button
          className={`library-tab ${currentView === "playlists" ? "active" : ""}`}
          onClick={() => setCurrentView("playlists")}
        >
          Playlists
        </button>
      </div>

      {/* Vista Favoritos */}
      {currentView === "favorites" && (
        <div className="library-view-content">
          <div className="library-header glass-card">
            <img src={favImage} alt="Favoritos" className="library-header-img" />
            <div>
              <p className="library-header-type">Playlist</p>
              <h1 className="library-title">Favoritos</h1>
              <p className="library-header-count">
                {loading ? "..." : `${songs.length} canciones`}
              </p>
            </div>
          </div>

          {!loading && songs.length > 0 && (
            <div className="library-song-list">
              {songs.map((song, i) => (
                <SongListItem
                  key={song.id || i}
                  song={song}
                  // Para canciones locales, source suele ser null o 'local'
                  isActive={currentSong?.id === song.id && currentSong?.source !== 'internet_archive'}
                  onPlay={() => playSongList(songs, i)}
                />
              ))}
            </div>
          )}

          {!loading && songs.length === 0 && (
            <div className="library-empty glass-card">
              <p className="library-empty-title">Nada por aquí 👀</p>
              <p className="library-empty-text">
                Marca canciones con ❤️ para que aparezcan aquí.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Vista Internet Archive Likes */}
      {currentView === "ia-likes" && (
        <div className="library-view-content">
          <div className="library-header glass-card">
            <img src={favImage} alt="Internet Archive" className="library-header-img" />
            <div>
              <p className="library-header-type">Colección</p>
              <h1 className="library-title">Internet Archive</h1>
              <p className="library-header-count">
                {loadingIaLikes ? "..." : `${iaLikes.length} canciones`}
              </p>
            </div>
          </div>

          {!loadingIaLikes && iaLikes.length > 0 && (
            <div className="library-song-list">
              {iaLikes.map((song, i) => (
                <SongListItem
                  key={song.id || i}
                  song={song}
                  isArchive={true}
                  // La comparación debe ser por identifier Y source
                  isActive={currentSong?.identifier === song.identifier && currentSong?.source === 'internet_archive'}
                  onPlay={() => {
                    // El backend ya envía la estructura correcta:
                    // { titulo, artista, portada, url, duration, source: 'internet_archive' }
                    // No necesitamos mapear nada extra.
                    playSongList(iaLikes, i);
                  }}
                />
              ))}
            </div>
          )}

          {!loadingIaLikes && iaLikes.length === 0 && (
            <div className="library-empty glass-card">
              <p className="library-empty-title">Nada por aquí 🌐</p>
              <p className="library-empty-text">
                Marca canciones de Internet Archive con ❤️ para que aparezcan aquí.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Vista Playlists */}
      {currentView === "playlists" && (
        <div className="library-view-content">
          <div className="library-header glass-card">
            <div className="playlists-header-icon">🎵</div>
            <div>
              <p className="library-header-type">Mis Playlists</p>
              <h1 className="library-title">Tus Colecciones</h1>
              <p className="library-header-count">
                {loadingPlaylists ? "..." : `${playlists.length} playlists`}
              </p>
            </div>
          </div>

          {!loadingPlaylists && playlists.length > 0 && (
            <div className="playlists-list">
              {playlists.map((playlist) => (
                <PlaylistItem
                  key={playlist.id}
                  playlist={playlist}
                  onSelect={() => handlePlayPlaylist(playlist.id)}
                />
              ))}
            </div>
          )}

          {!loadingPlaylists && playlists.length === 0 && (
            <div className="library-empty glass-card">
              <p className="library-empty-title">No tienes playlists 📝</p>
              <p className="library-empty-text">
                Próximamente podrás crearlas.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}