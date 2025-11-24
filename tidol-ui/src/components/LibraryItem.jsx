import React from "react";
import { useContextMenu } from "../context/ContextMenuContext";
import { FaEllipsisH } from 'react-icons/fa';

export default function LibraryItem({
    title,
    subtitle,
    image,
    onClick,
    viewMode = "list",
    item = null, // Full item object for context menu
    type = "song" // song, playlist, album, artist
}) {
    const { openContextMenu } = useContextMenu();

    const handleContextMenu = (e) => {
        if (item && type === 'song') {
            e.preventDefault();
            e.stopPropagation();

            // Normalize data for context menu
            const data = {
                id: item.id || item.identifier,
                titulo: item.titulo || item.title || title,
                artista: item.artista || item.artist || subtitle,
                album: item.album || item.album_name,
                portada: item.portada || item.cover_url || image,
                url: item.url,
                duracion: item.duracion || item.duration,
                artistId: item.artistId || item.artista_id,
                albumId: item.albumId || item.album_id,
                format: item.format,
                quality: item.quality
            };

            openContextMenu(e, type, data);
        }
    };

    const handleMenuClick = (e) => {
        handleContextMenu(e);
    };

    return (
        <div
            className={`lib-item ${viewMode} ${type === 'song' ? 'song-item' : ''}`}
            onClick={onClick}
            onContextMenu={handleContextMenu}
            data-id={item?.id || item?.identifier}
        >
            <img src={image} className="lib-item-img" alt={title} />
            <div className="lib-item-info">
                <h4>{title}</h4>
                <p>{subtitle}</p>
            </div>

            {type === 'song' && (
                <button
                    className="lib-item-menu-btn"
                    onClick={handleMenuClick}
                >
                    <FaEllipsisH />
                </button>
            )}
        </div>
    );
}
