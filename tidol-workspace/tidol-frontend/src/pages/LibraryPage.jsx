import React from "react";
import { useNavigate } from "react-router-dom";
import { useSwipeable } from "react-swipeable";
import { usePlayer } from "../context/PlayerContext";
import { usePlaylist } from "../context/PlaylistContext";
import { useLibrary } from "../hooks/useLibrary";
import LibraryItem from "../components/LibraryItem";
import SkeletonSongList from "../components/skeletons/SkeletonSongList";
import VirtualSongList from "../components/VirtualSongList";
import PlaylistNameModal from "../components/PlaylistNameModal";
import { normalizeTrackList } from "../utils/trackNormalization";
import { IoGridOutline, IoListOutline, IoAdd, IoHeart } from "react-icons/io5";
import favImage from "./favImage.jpg";
import "../styles/glass.css";
import "./Library.css";

const VIEWS = [
  { key: "favorites", label: "Favoritos" },
  { key: "ia-likes", label: "Archive" },
  { key: "playlists", label: "Playlists" },
];

const VIEW_TITLES = {
  favorites: "Tus favoritos",
  "ia-likes": "Internet Archive",
  playlists: "Tus playlists",
};

function formatMinutes(seconds) {
  if (!seconds) return null;
  const m = Math.round(seconds / 60);
  return m > 0 ? `${m} min` : null;
}

export default function LibraryPage() {
  const { currentView, setCurrentView, layout, setLayout, data, isLoading, refresh } = useLibrary();
  const { playSongList } = usePlayer();
  const { createPlaylist } = usePlaylist();
  const navigate = useNavigate();
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);

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

  const handleCreatePlaylist = async (nombre) => {
    const created = await createPlaylist(nombre);
    setIsCreateOpen(false);
    if (created) {
      refresh();
      navigate(`/playlist/${created.id}`);
    }
  };

  // Subtítulos por vista: las playlists muestran nº de canciones, minutos,
  // dueño y likes (datos reales del backend enriquecido).
  const getSubtitle = (item) => {
    if (currentView === "playlists") {
      const parts = [`${item.songCount ?? 0} canciones`];
      const mins = formatMinutes(item.totalDuration);
      if (mins) parts.push(mins);
      if (item.owner) parts.push(item.owner);
      if (item.likes > 0) parts.push(`♥ ${item.likes}`);
      return parts.join(" · ");
    }
    return item.artist || item.artista || item.subtitle || "Desconocido";
  };

  const getImage = (item) =>
    item.coverUrl || item.portada || item.cover_url || favImage;

  const handleItemClick = (item, index) => {
    if (currentView === "playlists") {
      // A la página de la playlist (ahí vive el play, el like y la gestión).
      navigate(`/playlist/${item.id}`);
    } else {
      const normalizedData = normalizeTrackList(data);
      playSongList(normalizedData, index);
    }
  };

  return (
    <div className="lib-container pb-28 pt-16 md:pt-20 px-4 md:px-8" {...swipeHandlers}>
      <div className="max-w-[1400px] mx-auto">
        {/* Cabecera del sistema de diseño */}
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <span className="text-white/40 text-[11px] font-bold uppercase tracking-[1.4px] mb-2 block">
              Tu colección
            </span>
            <h1 className="text-white text-3xl md:text-4xl font-bold tracking-tight">
              {VIEW_TITLES[currentView]}
            </h1>
            <p className="text-white/45 text-sm mt-1.5">
              {isLoading ? "Cargando…" : `${data.length} ${data.length === 1 ? "elemento" : "elementos"}`}
            </p>
          </div>

          {currentView === "playlists" && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white text-black text-sm font-semibold hover:scale-[1.03] active:scale-95 transition-transform shrink-0"
            >
              <IoAdd size={18} /> Nueva playlist
            </button>
          )}
        </div>

        {/* Pestañas + toggle de vista */}
        <div className="flex items-center justify-between gap-3 mb-8 flex-wrap">
          <div className="flex gap-2">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                onClick={() => setCurrentView(v.key)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                  currentView === v.key
                    ? "bg-white text-black"
                    : "bg-white/[0.06] text-white/70 border border-white/10 hover:bg-white/[0.12] hover:text-white"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setLayout(layout === "grid" ? "list" : "grid")}
            className="w-10 h-10 rounded-full bg-white/[0.06] border border-white/10 text-white/70 hover:text-white hover:bg-white/[0.12] flex items-center justify-center transition-colors"
            aria-label={layout === "grid" ? "Ver como lista" : "Ver como cuadrícula"}
          >
            {layout === "grid" ? <IoListOutline size={18} /> : <IoGridOutline size={18} />}
          </button>
        </div>

        {/* Contenido */}
        {isLoading && <SkeletonSongList count={12} />}

        {!isLoading && data.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[320px] text-center px-8">
            <div className="w-16 h-16 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center mb-6">
              <IoHeart size={24} className="text-white/50" />
            </div>
            {currentView === "playlists" ? (
              <>
                <h2 className="text-xl font-bold text-white mb-1.5">Aún no tienes playlists</h2>
                <p className="text-white/45 text-[15px] max-w-sm">
                  Crea una con el botón "Nueva playlist" o desde el menú contextual de cualquier canción.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-white mb-1.5">Nada guardado todavía</h2>
                <p className="text-white/45 text-[15px] max-w-sm">
                  Toca el corazón en cualquier canción para guardarla aquí.
                </p>
              </>
            )}
          </div>
        )}

        {!isLoading && data.length > 0 && (
          <div className={`lib-grid ${layout}`}>
            {layout === "list" ? (
              <VirtualSongList
                data={data}
                currentView={currentView}
                getSubtitle={getSubtitle}
                onClick={handleItemClick}
              />
            ) : (
              data.map((item, i) => {
                const uniqueKey = item.id || item.identifier || `idx-${i}`;
                return (
                  <LibraryItem
                    key={uniqueKey}
                    title={item.titulo || item.title || item.nombre || "Sin título"}
                    subtitle={getSubtitle(item)}
                    image={getImage(item)}
                    viewMode={layout}
                    item={item}
                    type={currentView === "playlists" ? "playlist" : "song"}
                    onClick={() => handleItemClick(item, i)}
                  />
                );
              })
            )}
          </div>
        )}
      </div>

      <PlaylistNameModal
        isOpen={isCreateOpen}
        title="Nueva playlist"
        initialValue=""
        confirmLabel="Crear"
        onConfirm={handleCreatePlaylist}
        onClose={() => setIsCreateOpen(false)}
      />
    </div>
  );
}
