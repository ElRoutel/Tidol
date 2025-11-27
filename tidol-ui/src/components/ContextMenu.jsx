// src/components/ContextMenu.jsx
import { useEffect, useState, useRef } from "react";
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

  const { openAddToPlaylistModal } = usePlaylist();
  const { addToQueue, playNext, toggleLike, isSongLiked } = usePlayer();
  const navigate = useNavigate();

  const menuRef = useRef(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  useEffect(() => {
    if (visible && menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const { innerWidth, innerHeight } = window;
      let { x, y } = position;

      // Smart positioning: adjust if menu would overflow
      if (x + rect.width > innerWidth) {
        x = innerWidth - rect.width - 10;
      }
      if (y + rect.height > innerHeight) {
        y = innerHeight - rect.height - 10;
      }

      setAdjustedPosition({ x, y });
    }
  }, [visible, position]);

  if (!visible || !item) return null;

  const handleAction = (action) => {
    const data = item.data;

    const getSongData = () => ({
      id: data.id,
      titulo: data.titulo || data.title,
      artista: data.artista || data.artist,
      album: data.album,
      url: data.url,
      portada: data.portada || data.image || data.cover,
      duracion: data.duration,
      source: data.source,
      format: data.format,
      quality: data.quality,
      artistId: data.artistId,
      albumId: data.albumId
    });

    switch (action) {
      case 'addToQueue':
        addToQueue(getSongData());
        break;
      case 'queueNext':
        playNext(getSongData());
        break;
      case 'addFavorite':
        toggleLike(data.id, getSongData());
        break;
      case 'addToPlaylist':
        openAddToPlaylistModal(getSongData());
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

  if (item.type === "song") {
    const isLiked = isSongLiked(item.data.id);

    // Detect Internet Archive tracks
    const isInternetArchive =
      item.data.url?.includes('archive.org') ||
      item.data.source === 'internet_archive' ||
      item.data.type === 'ia' ||
      item.data.identifier;

    options.push(
      {
        label: "Reproducir siguiente",
        action: "queueNext",
        icon: IoPlaySkipForwardOutline
      },
      {
        label: "Agregar a la cola",
        action: "addToQueue",
        icon: IoAddOutline
      },
      {
        label: isLiked ? "Quitar de favoritos" : "Agregar a favoritos",
        action: "addFavorite",
        icon: isLiked ? IoHeart : IoHeartOutline
      },
      {
        label: "Agregar a playlist",
        action: "addToPlaylist",
        icon: IoListOutline
      }
    );

    if (item.data.albumId) {
      options.push({
        label: "Ir al álbum",
        action: "goAlbum",
        icon: IoAlbumsOutline
      });
    }

    // Only show "Go to Artist" for local tracks (not Internet Archive)
    if (item.data.artistId && !isInternetArchive) {
      options.push({
        label: "Ir al artista",
        action: "goArtist",
        icon: IoPersonOutline
      });
    }
  }

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[99999]"
        style={{ pointerEvents: "auto" }}
        onClick={closeContextMenu}
        onContextMenu={(e) => {
          e.preventDefault();
          closeContextMenu();
        }}
      >
        <div
          ref={menuRef}
          className="absolute"
          style={{
            top: adjustedPosition.y,
            left: adjustedPosition.x,
            pointerEvents: "auto",
            zIndex: 100000,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Glassmorphism Container */}
          <div
            className="min-w-[220px] rounded-xl overflow-hidden"
            style={{
              background: 'rgba(18, 18, 18, 0.95)',
              backdropFilter: 'blur(40px) saturate(180%)',
              WebkitBackdropFilter: 'blur(40px) saturate(180%)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
            }}
          >
            <ul className="py-2">
              {options.map((opt, index) => {
                const Icon = opt.icon;
                return (
                  <li
                    key={`${opt.action}-${index}`}
                    className="px-4 py-2.5 hover:bg-white/10 cursor-pointer text-sm flex items-center gap-3 transition-colors text-white"
                    onClick={() => handleAction(opt.action)}
                  >
                    <Icon size={18} className="flex-shrink-0 text-gray-300" />
                    <span className="flex-1">{opt.label}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </Portal>
  );
}
