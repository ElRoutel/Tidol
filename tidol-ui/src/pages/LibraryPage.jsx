import React, { useState, useEffect, useCallback } from "react";
import { useSwipeable } from "react-swipeable";
import { usePlayer } from "../context/PlayerContext";
import LibraryItem from "../components/LibraryItem";
import api from "../api/axiosConfig";
import favImage from "./favImage.jpg"; // Asegúrate de que esta ruta sea correcta
import "../styles/glass.css";
import "./Library.css";


export default function LibraryPage() {
  const [songs, setSongs] = useState([]);
  const [iaLikes, setIaLikes] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(false);

  const [currentView, setCurrentView] = useState("favorites");
  const [layout, setLayout] = useState("grid");
  const { playSongList, currentSong } = usePlayer();

  // Función genérica para fetching
  const fetchData = useCallback(async (endpoint, setter) => {
    setLoading(true);
    try {
      const res = await api.get(endpoint);
      setter(res.data || []);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // === LOAD FAVORITES ===
  useEffect(() => {
    if (currentView === "favorites" && songs.length === 0) {
      fetchData("/music/songs/likes", setSongs);
    }
  }, [currentView, songs.length, fetchData]);

  // === LOAD IA ===
  useEffect(() => {
    if (currentView === "ia-likes" && iaLikes.length === 0) {
      fetchData("/music/ia/likes", setIaLikes);
    }
  }, [currentView, iaLikes.length, fetchData]);

  // === LOAD PLAYLISTS ===
  useEffect(() => {
    if (currentView === "playlists" && playlists.length === 0) {
      fetchData("/playlists", setPlaylists);
    }
  }, [currentView, playlists.length, fetchData]);

  // === SWIPE LOGIC ===
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      if (currentView === "favorites") setCurrentView("ia-likes");
      else if (currentView === "ia-likes") setCurrentView("playlists");
    },
    onSwipedRight: () => {
      if (currentView === "playlists") setCurrentView("ia-likes");
      else if (currentView === "ia-likes") setCurrentView("favorites");
    },
    delta: 50,
    trackMouse: true,
  });

  // PLAY PLAYLIST
  const handlePlayPlaylist = async (id) => {
    try {
      const res = await api.get(`/playlists/${id}/songs`);
      if (res.data && res.data.length > 0) {
        playSongList(res.data, 0);
      } else {
        alert("Esta playlist está vacía");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // SELECTOR DE DATOS
  const renderData = () => {
    switch (currentView) {
      case "favorites": return songs;
      case "ia-likes": return iaLikes;
      case "playlists": return playlists;
      default: return [];
    }
  };

  const data = renderData();

  // HELPER PARA SUBTÍTULOS (Corrige el bug lógico)
  const getSubtitle = (item) => {
    if (currentView === "playlists") {
      // Si tiene array de canciones, mostramos la cantidad, si no, 0
      const count = item.canciones ? item.canciones.length : 0;
      return `${count} canciones`;
    }
    // Para canciones normales o IA
    return item.artista || item.artist || item.subtitle || "Desconocido";
  };

  return (
    <div className="lib-container" {...swipeHandlers}>
      {/* CHIPS */}
      <div className="lib-chips-row">
        {[
          { key: "favorites", label: "Favoritos" },
          { key: "ia-likes", label: "IA Likes" },
          { key: "playlists", label: "Playlists" },
        ].map((c) => (
          <button
            key={c.key}
            className={`lib-chip ${currentView === c.key ? "active" : ""}`}
            onClick={() => setCurrentView(c.key)}
          >
            {c.label}
          </button>
        ))}

        <button
          className="lib-chip layout-chip"
          onClick={() => setLayout(layout === "grid" ? "list" : "grid")}
        >
          {layout === "grid" ? "📄 Lista" : "🔳 Grid"}
        </button>
      </div>

      {/* HEADER */}
      <div className="lib-header glass-card">
        <div className="lib-header-img-wrapper">
          <img src={favImage} alt="Header" className="lib-header-img" />
        </div>
        <div className="lib-header-text">
          <h5 className="lib-subtitle">Colección</h5>
          <h1 className="lib-title">
            {currentView === "favorites" && "Tus Favoritos"}
            {currentView === "ia-likes" && "Internet Archive"}
            {currentView === "playlists" && "Tus Playlists"}
          </h1>
          <p className="lib-count">{data.length} elementos</p>
        </div>
      </div>

      {/* CONTENIDO */}
      <div className={`lib-grid ${layout}`}>
        {loading && <div className="lib-loader">Cargando...</div>}

        {!loading && data.length === 0 && (
          <div className="lib-empty">
            <p className="lib-empty-text">No hay nada por aquí aún.</p>
          </div>
        )}

        {!loading && data.map((item, i) => {
          // Generar un ID único robusto para la key
          const uniqueKey = item.id || item.identifier || `idx-${i}`;

          return (
            <LibraryItem
              key={uniqueKey}
              title={item.titulo || item.title || item.nombre || "Sin título"}
              subtitle={getSubtitle(item)}
              image={item.portada || item.cover_url || favImage}
              viewMode={layout}
              item={item}
              type={currentView === "playlists" ? "playlist" : "song"}
              onClick={() => {
                if (currentView === "playlists") handlePlayPlaylist(item.id);
                else playSongList(data, i);
              }}
            />
          );
        })}
      </div>
    </div>
  );
}