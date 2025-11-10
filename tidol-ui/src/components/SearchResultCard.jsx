// src/components/SearchResultCard.jsx
import React from 'react';
import { IoPlay } from 'react-icons/io5';

export default function SearchResultCard({ image, title, subtitle, onClick }) {
  return (
    <div
      onClick={onClick}
      className="search-result-card"
    >
      {/* Imagen con overlay de play */}
      <div className="card-image-wrapper">
        <img
          src={image || '/default_cover.png'}
          alt={title}
          className="card-image"
          loading="lazy"
        />
        <div className="card-overlay">
          <div className="play-button">
            <IoPlay size={20} />
          </div>
        </div>
        {/* Efecto de brillo sutil */}
        <div className="card-shine" />
      </div>

      {/* Información de la canción */}
      <div className="card-content">
        <h3 className="card-title">{title}</h3>
        <p className="card-subtitle">{subtitle}</p>
      </div>

      {/* Barra de acento sutil */}
      <div className="card-accent" />

      <style jsx>{`
        .search-result-card {
          position: relative;
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 12px;
          border-radius: 12px;
          cursor: pointer;
          background: linear-gradient(145deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.01) 100%);
          border: 1px solid rgba(255, 255, 255, 0.03);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          overflow: hidden;
        }

        .search-result-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(29,185,84,0.05) 0%, transparent 100%);
          opacity: 0;
          transition: opacity 0.3s ease;
          pointer-events: none;
        }

        .search-result-card:hover {
          background: linear-gradient(145deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%);
          border-color: rgba(255, 255, 255, 0.1);
          box-shadow: 
            0 8px 32px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
          transform: translateY(-2px);
        }

        .search-result-card:hover::before {
          opacity: 1;
        }

        .search-result-card:active {
          transform: translateY(0px) scale(0.98);
          transition-duration: 0.1s;
        }

        /* Imagen y overlay */
        .card-image-wrapper {
          position: relative;
          flex-shrink: 0;
          width: 60px;
          height: 60px;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .card-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .search-result-card:hover .card-image {
          transform: scale(1.1);
        }

        .card-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .search-result-card:hover .card-overlay {
          opacity: 1;
        }

        .play-button {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #1db954;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          transform: scale(0.8);
          transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
          box-shadow: 0 4px 12px rgba(29, 185, 84, 0.4);
        }

        .search-result-card:hover .play-button {
          transform: scale(1);
        }

        .play-button:hover {
          background: #1ed760;
          box-shadow: 0 6px 16px rgba(29, 185, 84, 0.6);
        }

        /* Efecto de brillo */
        .card-shine {
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: linear-gradient(
            45deg,
            transparent 30%,
            rgba(255, 255, 255, 0.1) 50%,
            transparent 70%
          );
          transform: rotate(45deg);
          opacity: 0;
          transition: opacity 0.5s ease;
          pointer-events: none;
        }

        .search-result-card:hover .card-shine {
          opacity: 1;
          animation: shine 0.8s ease-out;
        }

        @keyframes shine {
          from {
            transform: translateX(-100%) rotate(45deg);
          }
          to {
            transform: translateX(100%) rotate(45deg);
          }
        }

        /* Contenido de texto */
        .card-content {
          flex-grow: 1;
          overflow: hidden;
          min-width: 0;
        }

        .card-title {
          font-size: 16px;
          font-weight: 600;
          color: #ffffff;
          margin: 0 0 4px 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          transition: color 0.2s ease;
          letter-spacing: -0.01em;
        }

        .search-result-card:hover .card-title {
          color: #1db954;
        }

        .card-subtitle {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.6);
          margin: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          transition: color 0.2s ease;
        }

        .search-result-card:hover .card-subtitle {
          color: rgba(255, 255, 255, 0.8);
        }

        /* Barra de acento lateral */
        .card-accent {
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%) scaleY(0);
          width: 3px;
          height: 60%;
          background: linear-gradient(180deg, #1db954 0%, #1ed760 100%);
          border-radius: 0 3px 3px 0;
          transition: transform 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
          box-shadow: 0 0 12px rgba(29, 185, 84, 0.6);
        }

        .search-result-card:hover .card-accent {
          transform: translateY(-50%) scaleY(1);
        }

        /* Responsive */
        @media (max-width: 640px) {
          .search-result-card {
            padding: 10px;
            gap: 12px;
          }

          .card-image-wrapper {
            width: 50px;
            height: 50px;
          }

          .play-button {
            width: 32px;
            height: 32px;
          }

          .card-title {
            font-size: 15px;
          }

          .card-subtitle {
            font-size: 13px;
          }
        }

        /* Dark mode enhancements */
        @media (prefers-color-scheme: dark) {
          .search-result-card {
            background: linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%);
          }
        }

        /* Accesibilidad */
        .search-result-card:focus-visible {
          outline: 2px solid #1db954;
          outline-offset: 2px;
        }

        /* Animación de entrada (opcional) */
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .search-result-card {
          animation: fadeInUp 0.4s ease-out backwards;
        }
      `}</style>
    </div>
  );
}
