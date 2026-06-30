// src/components/ContextMenu.jsx
import { useEffect, useLayoutEffect, useState, useRef } from "react";
import { usePlaylist } from "../context/PlaylistContext";
import { usePlayer } from "../context/PlayerContext";
import { useContextMenu } from "../context/ContextMenuContext";
import Portal from "./Portal";
import { useNavigate } from "react-router-dom";
import {
  IoPlaySkipForwardOutline,
  IoAddOutline,
  IoHeartOutline,
  IoHeart,
  IoListOutline,
  IoAlbumsOutline,
  IoPersonOutline
} from "react-icons/io5";

export default function ContextMenu() {
  const { menuState, closeContextMenu } = useContextMenu();
  const { visible, position, item } = menuState;

  // 1. Data Normalization Helper
  const normalizeData = (rawData) => {
    if (!rawData) return {};
    return {
      id: rawData.id || rawData.identifier,
      titulo: rawData.titulo || rawData.title || rawData.name,
      artista: rawData.artista || rawData.artist || rawData.creator || 'Desconocido',
      album: rawData.album || rawData.collection,
      portada: rawData.portada || rawData.cover || rawData.image || rawData.thumb,
      url: rawData.url || (rawData.identifier ? `https://archive.org/download/${rawData.identifier}/${rawData.name}` : null),
      duration: rawData.duracion || rawData.duration || rawData.length,
      source: rawData.source || (rawData.identifier ? 'internet_archive' : 'local'),
      type: rawData.type || 'song',
      // Keep original for specifics
      ...rawData
    };
  };

  const data = normalizeData(item?.data);
  const { openAddToPlaylistModal } = usePlaylist();
  const { addToQueue, playNext, toggleLike, isSongLiked } = usePlayer();
  const navigate = useNavigate();

  const menuRef = useRef(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useLayoutEffect(() => {
    if (visible && menuRef.current && !isMobile) {
      const rect = menuRef.current.getBoundingClientRect();
      const { innerWidth, innerHeight } = window;
      let { x, y } = position;

      // Smart positioning for Desktop
      if (x + rect.width > innerWidth) x = innerWidth - rect.width - 20;
      if (y + rect.height > innerHeight) y = innerHeight - rect.height - 20;

      // Ensure positive coords
      x = Math.max(10, x);
      y = Math.max(10, y);

      setAdjustedPosition({ x, y });
    }
  }, [visible, position, isMobile]);

  if (!visible || !item) return null;

  console.log("📍 Rendering ContextMenu at:", adjustedPosition, "Original:", position);

  const handleAction = (action) => {
    switch (action) {
      case 'addToQueue':
        addToQueue(data);
        break;
      case 'queueNext':
        playNext(data);
        break;
      case 'addFavorite':
        toggleLike(data.id, data);
        break;
      case 'addToPlaylist':
        openAddToPlaylistModal(data);
        break;
      case 'goAlbum':
        if (data.albumId) navigate(`/album/${data.albumId}`);
        break;
      case 'goArtist':
        if (data.artistId) navigate(`/artist/${data.artistId}`);
        break;
    }
    closeContextMenu();
  };

  const options = [];

  if (item.type === "song" || item.type === "ia-song") {
    const isLiked = isSongLiked(data.id);
    const isInternetArchive = data.source === 'internet_archive' || data.identifier;

    options.push(
      { label: "Reproducir siguiente", action: "queueNext", icon: IoPlaySkipForwardOutline },
      { label: "Agregar a la cola", action: "addToQueue", icon: IoAddOutline },
      { label: isLiked ? "Quitar de favoritos" : "Agregar a favoritos", action: "addFavorite", icon: isLiked ? IoHeart : IoHeartOutline },
      { label: "Agregar a playlist", action: "addToPlaylist", icon: IoListOutline }
    );

    if (data.albumId) {
      options.push({ label: "Ir al álbum", action: "goAlbum", icon: IoAlbumsOutline });
    }

    if (data.artistId && !isInternetArchive) {
      options.push({ label: "Ir al artista", action: "goArtist", icon: IoPersonOutline });
    }
  }

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[99999] bg-black/20 md:bg-transparent"
        style={{ pointerEvents: "auto" }}
        onClick={closeContextMenu}
        onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }}
      >
        {/* Mobile Bottom Sheet vs Desktop Popover */}
        <div
          ref={menuRef}
          onClick={(e) => e.stopPropagation()}
          className={`
            fixed z-[100000] bg-[#1a1a1a]/95 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden
            ${isMobile
              ? 'bottom-4 left-4 right-4 rounded-2xl animate-slide-up origin-bottom'
              : 'rounded-xl animate-in fade-in zoom-in-95 duration-200 w-[220px]'
            }
          `}
          style={!isMobile ? { top: adjustedPosition.y, left: adjustedPosition.x } : {}}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-white/5 bg-white/5">
            <h4 className="font-bold text-sm text-white truncate">{data.titulo || 'Opciones'}</h4>
            <p className="text-xs text-white/50 truncate mt-0.5">{data.artista}</p>
          </div>

          {/* Options */}
          <ul className="flex flex-col py-1">
            {options.map((opt, index) => (
              <MenuItem
                key={`${opt.action}-${index}`}
                icon={<opt.icon size={20} />}
                label={opt.label}
                onClick={() => handleAction(opt.action)}
              />
            ))}
          </ul>
        </div>
      </div>
    </Portal>
  );
}

const MenuItem = ({ icon, label, onClick, className = '' }) => (
  <li
    className={`flex items-center gap-3 px-4 py-3 hover:bg-white/10 cursor-pointer transition-colors active:scale-[0.98] ${className}`}
    onClick={onClick}
  >
    <span className="opacity-70 text-white">{icon}</span>
    <span className="font-medium text-sm text-white/90">{label}</span>
  </li>
);
