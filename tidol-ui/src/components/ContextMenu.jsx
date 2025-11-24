// src/components/ContextMenu.jsx
import { useEffect, useState, useRef } from "react";
import { usePlaylist } from "../context/PlaylistContext";
import Portal from "./Portal";

export default function ContextMenu({ item, onAction }) {
  const { openAddToPlaylistModal } = usePlaylist();
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleContextMenu = (e) => {
      const targetItem = e.target.closest(".song-item, .album-item, .artist-item");
      if (!targetItem) {
        setVisible(false);
        return;
      }

      e.preventDefault();
      setPosition({ x: e.clientX, y: e.clientY });

      const type = targetItem.classList.contains("song-item")
        ? "song"
        : targetItem.classList.contains("album-item")
          ? "album"
          : "artist";

      setVisible(true);
      onAction("setItem", { type, data: targetItem.dataset });
    };

    const handleClick = () => setVisible(false);

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("click", handleClick);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("click", handleClick);
    };
  }, [onAction]);

  // Adjust position to keep menu within viewport
  const menuRef = useRef(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  useEffect(() => {
    if (visible && menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const { innerWidth, innerHeight } = window;
      let { x, y } = position;

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

  const options = [];

  if (item.type === "song") {
    options.push(
      { label: "Agregar a la cola", action: "addToQueue" },
      { label: "Reproducir siguiente", action: "queueNext" },
      { label: "Agregar a favoritos", action: "addFavorite" },
      { label: "Agregar a playlist", action: "addToPlaylist" },
      { label: "Ir al álbum", action: "goAlbum" },
      { label: "Ir al artista", action: "goArtist" }
    );
  } else if (item.type === "album") {
    options.push(
      { label: "Reproducir todo", action: "playAlbum" },
      { label: "Agregar a favoritos", action: "addAlbumFavorite" }
    );
  } else if (item.type === "artist") {
    options.push(
      { label: "Ver perfil", action: "goArtist" },
      { label: "Reproducir top canciones", action: "playArtistTop" }
    );
  }

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[99999]"
        style={{ pointerEvents: "auto" }} // Capture clicks to close
        onClick={() => setVisible(false)}
        onContextMenu={(e) => {
          e.preventDefault();
          setVisible(false);
        }}
      >
        <ul
          ref={menuRef}
          className="absolute glass-card text-white p-1 min-w-[200px]"
          style={{
            top: adjustedPosition.y,
            left: adjustedPosition.x,
            pointerEvents: "auto",
            zIndex: 100000, // Ensure it's above the overlay
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {options.map((opt) => (
            <li
              key={opt.label}
              className="px-3 py-2 hover:bg-white/10 rounded-md cursor-pointer text-sm flex items-center gap-2 transition-colors"
              onClick={() => {
                if (opt.action === "addToPlaylist") {
                  openAddToPlaylistModal(item.data);
                } else {
                  onAction(opt.action, item.data);
                }
                setVisible(false);
              }}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      </div>
    </Portal>
  );
}
