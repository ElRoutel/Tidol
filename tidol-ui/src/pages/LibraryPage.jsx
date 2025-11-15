import React, { useState, useEffect } from "react";
import { useSwipeable } from "react-swipeable";
import { usePlayer } from "../context/PlayerContext";
import api from "../api/axiosConfig";
import '../styles/glass.css';
import favImage from "./favImage.jpg";
import "./Library.css";

function SongGridItem({ song, onPlay, isActive }) {
  return (
    <div className="library-card" onClick={onPlay}>
      <img
        src={song.portada || "https://via.placeholder.com/300"}
        alt={song.titulo}
        className="library-img"
      />
      <p className="library-name">{song.titulo}</p>
      <p className="library-artist">{song.artista}</p>
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
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [currentView, setCurrentView] = useState("favorites");
  const { playSongList, currentSong } = usePlayer();

  // ✅ Carga likes (tu código original que funciona)
  useEffect(() => {
    const getLikes = async () => {
      try {
        const res = await api.get("/music/songs/likes");
        setSongs(res.data || []);
      } catch (e) {
        console.error("Error obteniendo likes:", e);
      } finally {
        setLoading(false);
      }
    };

    getLikes();
  }, []);

  // ✅ Carga playlists SOLO cuando cambias a esa vista
  useEffect(() => {
    if (currentView === "playlists" && playlists.length === 0) {
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
      if (currentView === "favorites") setCurrentView("playlists");
    },
    onSwipedRight: () => {
      if (currentView === "playlists") setCurrentView("favorites");
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
