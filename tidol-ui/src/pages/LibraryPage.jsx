import React from "react";
import { useSwipeable } from "react-swipeable";
import { usePlayer } from "../context/PlayerContext";
import { useLibrary } from "../hooks/useLibrary";
import LibraryItem from "../components/LibraryItem";
import SkeletonSongList from "../components/skeletons/SkeletonSongList";
import VirtualSongList from "../components/VirtualSongList";
import VirtualGrid from "../components/VirtualGrid"; // Importar el nuevo componente
import api from "../api/axiosConfig";
import favImage from "./favImage.jpg";
import "../styles/glass.css";
import "./Library.css";

export default function LibraryPage() {
  const { currentView, setCurrentView, layout, setLayout, data, isLoading } = useLibrary();
  const { playSongList } = usePlayer();

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

  // HELPER PARA SUBTÍTULOS
  const getSubtitle = (item) => {
    if (currentView === "playlists") {
      const count = item.canciones ? item.canciones.length : 0;
      return `${count} canciones`;
    }
    return item.artista || item.artist || item.subtitle || "Desconocido";
  };

  // This handler is passed to both LibraryItem and VirtualSongList
  // to unify click handling for both grid and list views.
  const handleItemClick = (item, index) => {
    if (currentView === "playlists") {
      handlePlayPlaylist(item.id);
    } else {
      playSongList(data, index);
    }
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
      <div className={`lib-grid ${layout}`} style={{ height: 'calc(100vh - 220px)' }}>
        {isLoading && <SkeletonSongList count={12} />}

        {!isLoading && data.length > 0 && (
          layout === 'list' ? (
            <VirtualSongList
              data={data}
              currentView={currentView}
              getSubtitle={getSubtitle}
              onClick={handleItemClick}
            />
          ) : (
            <VirtualGrid
              data={data}
              getSubtitle={getSubtitle}
              onClick={handleItemClick}
            />
          )
        )}
      </div>
    </div>
  );
}