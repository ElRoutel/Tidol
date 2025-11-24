// src/components/ContextMenu.jsx
import { useEffect, useState } from "react";
import { usePlaylist } from "../context/PlaylistContext";

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

  if (!visible || !item) return null;

  const options = [];

  if (item.type === "song") {
    options.push(
      { label: "Reproducir ahora", action: "playSong" },
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
    <ul
      className="absolute bg-gray-800 text-white rounded shadow-lg z-50 p-2"
      style={{ top: position.y, left: position.x }}
    >
      {options.map((opt) => (
        <li
          key={opt.label}
          className="px-3 py-1 hover:bg-gray-700 cursor-pointer"
          onClick={() => {
            if (opt.action === "addToPlaylist") {
              openAddToPlaylistModal(item.data);
            } else {
              onAction(opt.action, item.data);
            }
            setVisible(false); // cerrar menú al hacer click
          }}
        >
          {opt.label}
        </li>
      ))}
    </ul>
  );
}
