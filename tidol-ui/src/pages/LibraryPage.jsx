import React from "react";
import { useSwipeable } from "react-swipeable";
import { usePlayer } from "../context/PlayerContext";
import { useLibrary } from "../hooks/useLibrary";
import { useResponsiveListHeight } from '../hooks/useResponsiveListHeight';
import LibraryItem from "../components/LibraryItem";
import SkeletonSongList from "../components/skeletons/SkeletonSongList";
import VirtualSongList from "../components/VirtualSongList";
import api from "../api/axiosConfig";
import favImage from "./favImage.jpg";
import "../styles/glass.css";
import "./Library.css";

export default function LibraryPage() {
  const { currentView, setCurrentView, layout, setLayout, data, isLoading } = useLibrary();
  const { playSongList } = usePlayer();
  const [listRef, listHeight] = useResponsiveListHeight();

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

  const getSubtitle = (item) => {
    if (currentView === "playlists") {
      const count = item.canciones ? item.canciones.length : 0;
      return `${count} canciones`;
    }
    return item.artista || item.artist || item.subtitle || "Desconocido";
  };

  const handleItemClick = (item, index) => {
    if (currentView === "playlists") {
      handlePlayPlaylist(item.id);
    } else {
      playSongList(data, index);
    }
  };

  // Normalize data for VirtualSongList
  const virtualSongs = data.map(item => ({
    id: item.id || item.identifier,
    titulo: item.titulo || item.title || item.nombre || "Sin título",
    artista: item.artista || item.artist || item.subtitle || "Desconocido",
    album: item.album || "Desconocido",
    portada: item.portada || item.cover_url || favImage,
    coverThumb: item.portada || item.cover_url || favImage,
    duracion: item.duracion || "0:00",
  }));

  return (
    <div className="lib-container" {...swipeHandlers}>
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

      <div className={`lib-grid ${layout}`} ref={listRef}>
        {isLoading && <SkeletonSongList count={12} />}

        {!isLoading && data.length > 0 && (
          layout === 'list' ? (
            <VirtualSongList
              songs={virtualSongs}
              height={listHeight}
              onPlay={(_, index) => handleItemClick(data[index], index)}
            />
          ) : (
            data.map((item, i) => (
              <LibraryItem
                key={item.id || item.identifier || `idx-${i}`}
                title={item.titulo || item.title || item.nombre || "Sin título"}
                subtitle={getSubtitle(item)}
                image={item.portada || item.cover_url || favImage}
                viewMode={layout}
                item={item}
                type={currentView === "playlists" ? "playlist" : "song"}
                onClick={() => handleItemClick(item, i)}
              />
            ))
          )
        )}
      </div>
    </div>
  );
}
