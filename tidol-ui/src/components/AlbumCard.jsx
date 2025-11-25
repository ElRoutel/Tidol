// src/components/AlbumCard.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { IoPlay } from "react-icons/io5";

const AlbumCard = React.memo(({ album }) => {
  return (
    <Link to={`/album/${album.id}`} className="album-card-wrapper">
      <div className="album-card">

        {/* Imagen del álbum con efectos */}
        <div className="album-image-container">
          <div className="image-wrapper">
            <img
              src={album.portada}
              alt={album.titulo}
              className="album-cover"
              loading="lazy"
            />
            <div className="image-gradient" />
          </div>

          {/* Overlay con degradado y botón de play */}
          <div className="play-overlay">
            <div className="play-button">
              <IoPlay size={24} className="play-icon" />
            </div>
          </div>

          {/* Efecto de brillo animado */}
          <div className="shine-effect" />
        </div>

        {/* Información del álbum */}
        <div className="album-info">
          <h3 className="album-title">{album.titulo}</h3>
          <p className="album-artist">{album.autor}</p>
        </div>

        {/* Glow effect en hover */}
        <div className="card-glow" />
      </div>

      <style jsx>{`
        .album-card-wrapper {
          display: block;
          text-decoration: none;
        }

        .album-card {
          position: relative;
          background: linear-gradient(135deg, 
            rgba(255, 255, 255, 0.05) 0%,
            rgba(255, 255, 255, 0.02) 100%
          );
          border-radius: 12px;
          padding: 16px;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          border: 1px solid rgba(255, 255, 255, 0.08);
          overflow: hidden;
          cursor: pointer;
        }

        .album-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, 
            rgba(255, 255, 255, 0.1) 0%,
            transparent 60%
          );
          opacity: 0;
          transition: opacity 0.4s;
          pointer-events: none;
        }

        .album-card:hover {
          background: linear-gradient(135deg, 
            rgba(255, 255, 255, 0.08) 0%,
            rgba(255, 255, 255, 0.04) 100%
          );
          border-color: rgba(255, 255, 255, 0.15);
          transform: translateY(-8px);
          box-shadow: 
            0 8px 32px rgba(0, 0, 0, 0.5),
            0 0 0 1px rgba(255, 255, 255, 0.1) inset;
        }

        .album-card:hover::before {
          opacity: 1;
        }

        .album-card:active {
          transform: translateY(-4px);
        }

        /* Contenedor de imagen */
        .album-image-container {
          position: relative;
          width: 100%;
          aspect-ratio: 1;
          margin-bottom: 16px;
          border-radius: 8px;
          overflow: hidden;
          background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%);
        }

        .image-wrapper {
          position: relative;
          width: 100%;
          height: 100%;
        }

        .album-cover {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .album-card:hover .album-cover {
          transform: scale(1.08);
        }

        /* Gradiente sutil sobre la imagen */
        .image-gradient {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            180deg,
            transparent 0%,
            transparent 50%,
            rgba(0, 0, 0, 0.3) 100%
          );
          opacity: 0;
          transition: opacity 0.4s;
          pointer-events: none;
        }

        .album-card:hover .image-gradient {
          opacity: 1;
        }

        /* Overlay del botón de play */
        .play-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(
            135deg,
            rgba(0, 0, 0, 0.3) 0%,
            rgba(0, 0, 0, 0.5) 100%
          );
          opacity: 0;
          transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .album-card:hover .play-overlay {
          opacity: 1;
        }

        /* Botón de play */
        .play-button {
          width: 56px;
          height: 56px;
          background: linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 
            0 8px 24px rgba(0, 0, 0, 0.4),
            0 0 0 1px rgba(255, 255, 255, 0.1) inset;
          transform: scale(0.85) translateY(8px);
          opacity: 0;
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .album-card:hover .play-button {
          transform: scale(1) translateY(0);
          opacity: 1;
        }

        .play-button:hover {
          transform: scale(1.1) translateY(0);
          background: linear-gradient(135deg, #ffffff 0%, #fafafa 100%);
          box-shadow: 
            0 12px 32px rgba(0, 0, 0, 0.5),
            0 0 0 1px rgba(255, 255, 255, 0.2) inset;
        }

        .play-button:active {
          transform: scale(1.05) translateY(0);
        }

        .play-icon {
          color: #000000;
          margin-left: 3px;
        }

        .album-card:hover .shine-effect {
          left: 150%;
          opacity: 1;
        }

        /* Información del álbum */
        .album-info {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .album-title {
          font-size: 1rem;
          font-weight: 600;
          color: #ffffff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          transition: color 0.3s;
          letter-spacing: -0.2px;
        }

        .album-card:hover .album-title {
          color: #ffffff;
        }

        .album-artist {
          font-size: 0.875rem;
          color: rgba(255, 255, 255, 0.6);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          transition: color 0.3s;
        }

        .album-card:hover .album-artist {
          color: rgba(255, 255, 255, 0.8);
        }

        .card-glow {
          position: absolute;
          inset: 0;
          background: radial-gradient(
            circle at 50% 0%,
            rgba(255, 255, 255, 0.1),
            transparent 70%
          );
          border-radius: 14px;
          opacity: 0;
          transition: opacity 0.4s;
          pointer-events: none;
          z-index: -1;
        }

        .album-card:hover .card-glow {
          opacity: 1;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .album-card {
            padding: 12px;
          }

          .album-image-container {
            margin-bottom: 12px;
            border-radius: 6px;
          }

          .play-button {
            width: 48px;
            height: 48px;
          }

          .play-icon {
            font-size: 20px;
          }

          .album-title {
            font-size: 0.9rem;
          }

          .album-artist {
            font-size: 0.8rem;
          }
        }

        @media (max-width: 480px) {
          .album-card {
            padding: 10px;
          }

          .play-button {
            width: 44px;
            height: 44px;
          }
        }
      `}</style>
    </Link>
  );
});

export default AlbumCard;