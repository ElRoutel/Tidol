// src/components/ContextMenu.jsx
import { useEffect, useState, useRef } from "react";
import { usePlaylist } from "../context/PlaylistContext";
import { usePlayer } from "../context/PlayerContext";
import { useContextMenu } from "../context/ContextMenuContext";
import Portal from "./Portal";
import { useNavigate } from "react-router-dom";

export default function ContextMenu() {
  const { menuState, closeContextMenu } = useContextMenu();
  const { visible, position, item } = menuState;

  const { openAddToPlaylistModal } = usePlaylist();
  const { addToQueue, playNext, toggleLike, isSongLiked } = usePlayer();
  const navigate = useNavigate();

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

  const handleAction = (action) => {
    const data = item.data;

    // Helper to normalize song data
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
      // Album/Artist specific actions could be added here
    }
    closeContextMenu();
  };

  const options = [];

  if (item.type === "song") {
    const isLiked = isSongLiked(item.data.id);

    options.push(
      { label: "Agregar a la cola", action: "addToQueue" },
      { label: "Reproducir siguiente", action: "queueNext" },
      { label: isLiked ? "Quitar de favoritos" : "Agregar a favoritos", action: "addFavorite" },
      { label: "Agregar a playlist", action: "addToPlaylist" }
    );

    if (item.data.albumId) {
      options.push({ label: "Ir al álbum", action: "goAlbum" });
    }
    if (item.data.artistId) {
      options.push({ label: "Ir al artista", action: "goArtist" });
    }
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
        style={{ pointerEvents: "auto" }}
        onClick={closeContextMenu}
        onContextMenu={(e) => {
          e.preventDefault();
          closeContextMenu();
        }}
      >
        <ul
          ref={menuRef}
          className="absolute glass-card text-white p-1 min-w-[200px]"
          style={{
            top: adjustedPosition.y,
            left: adjustedPosition.x,
            pointerEvents: "auto",
            zIndex: 100000,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {options.map((opt) => (
            <li
              key={opt.label}
              className="px-3 py-2 hover:bg-white/10 rounded-md cursor-pointer text-sm flex items-center gap-2 transition-colors"
              onClick={() => handleAction(opt.action)}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      </div>
    </Portal>
  );
}
