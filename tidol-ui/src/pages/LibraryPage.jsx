import React, { useState, useEffect } from "react";
import { useSwipeable } from "react-swipeable";
import { usePlayer } from "../context/PlayerContext";
import api from "../api/axiosConfig";
import '../styles/glass.css';
import favImage from "./favImage.jpg";
import "./Library.css";

function SongGridItem({ song, onPlay, isActive, isArchive = false }) {
  return (
    <div className="library-card" onClick={onPlay}>
      <img
        src={isArchive ? (song.portada || song.cover_url || "https://via.placeholder.com/300") : (song.portada || "https://via.placeholder.com/300")}
        alt={isArchive ? song.title : song.titulo}
        className="library-img"
      />
      <p className="library-name">{isArchive ? song.title : song.titulo}</p>
      <p className="library-artist">{isArchive ? song.artist : song.artista}</p>
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
            <div className="library-grid">
              {songs.map((song, i) => (
                <SongGridItem
                  key={song.id || i}
                  song={song}
                  isActive={currentSong?.id === song.id}
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
            <div className="library-grid">
              {iaLikes.map((song, i) => (
                <SongGridItem
                  key={song.id || i}
                  song={song}
                  isArchive={true}
                  isActive={currentSong?.identifier === song.identifier}
                  onPlay={() => {
                    // Convertir canciones de IA al formato esperado por playSongList
                    const formattedSongs = iaLikes.map(s => ({
                      ...s,
                      titulo: s.title,
                      artista: s.artist,
                      portada: s.cover_url || s.portada,
                      duration: s.duration
                    }));
                    playSongList(formattedSongs, i);
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
                Proximamente las agregaré.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
