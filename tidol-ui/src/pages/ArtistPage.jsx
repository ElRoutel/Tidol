import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import { usePlayer } from '../context/PlayerContext';
import AlbumCard from '../components/AlbumCard';
import Slider from 'react-slick';
import { IoPlaySharp, IoPauseSharp, IoRadio } from 'react-icons/io5';

import "slick-carousel/slick/slick.css"; 
import "slick-carousel/slick/slick-theme.css";

export default function ArtistPage() {
  const { id } = useParams();
  const { playSongList, currentSong } = usePlayer();

  const [artist, setArtist] = useState(null);
  const [topSongs, setTopSongs] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchArtistData = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const artistRes = await api.get(`/music/artists/${id}`);
        setArtist(artistRes.data);
        setAlbums(artistRes.data.albums || []);

        const songsRes = await api.get(`/music/artists/${id}/songs`);
        setTopSongs(songsRes.data.slice(0, 5));
      } catch (err) {
        setError("No se pudo encontrar al artista.");
      } finally {
        setLoading(false);
      }
    };
    fetchArtistData();
  }, [id]);

  const handlePlayTopSongs = () => {
    if (topSongs.length > 0) playSongList(topSongs, 0);
  };

  const formatDuration = s => {
    if (!s || isNaN(s)) return '--:--';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (loading) return (
    <div className="flex justify-center items-center h-full min-h-screen bg-gradient-to-b from-gray-900 to-black">
      <div className="loading-spinner" />
    </div>
  );

  if (error) return (
    <div className="text-center p-8 text-white bg-gradient-to-b from-gray-900 to-black h-screen">
      <h2 className="text-2xl font-bold">{error}</h2>
    </div>
  );

  const albumSliderSettings = {
    dots: false,
    infinite: false,
    speed: 400,
    slidesToShow: 5,
    slidesToScroll: 2,
    swipeToSlide: true,
    responsive: [
      { breakpoint: 1024, settings: { slidesToShow: 4, slidesToScroll: 2, infinite: false }},
      { breakpoint: 768, settings: { slidesToShow: 2, slidesToScroll: 1, infinite: false }},
      { breakpoint: 480, settings: { slidesToShow: 1, slidesToScroll: 1, infinite: false }},
    ]
  };

  return (
    <div className="artist-page">
      {/* Fondo ambiental con múltiples capas de gradiente */}
      <div className="ambient-background" style={{ backgroundImage: `url(${artist?.imagen})` }} />
      <div className="gradient-overlay-top" />

      {/* Hero Section */}
      <div className="hero-section">
        <div className="hero-content">
          <div className="artist-image-container">
            <img src={artist?.imagen} alt={artist?.nombre} className="hero-artist-img" />
            <div className="hero-gradient-overlay"></div>
          </div>

          <div className="hero-text-layer">
            <div className="verified-badge">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
              </svg>
              <span>Artista Verificado</span>
            </div>
            
            <h1 className="artist-name">{artist?.nombre}</h1>
            
            <div className="artist-meta">
              <span className="meta-item">{artist?.canciones} canciones</span>
              {artist?.biografia && <span className="meta-divider">•</span>}
              {artist?.biografia && <span className="meta-item bio-text">{artist.biografia}</span>}
            </div>

            <div className="action-buttons">
              <button onClick={handlePlayTopSongs} className="btn-pill primary">
                <IoPlaySharp size={18} />
                Reproducir
              </button>
              {/* <button className="btn-pill secondary">
                <IoRadio size={18} />
                Radio
              </button>
              <button className="btn-pill secondary">
                Suscribirse
              </button> */}
            </div>
          </div>
        </div>
      </div>

      {/* Contenido Principal */}
      <div className="main-content">

        {/* Canciones Populares */}
        {topSongs.length > 0 && (
          <div className="section">
            <h2 className="section-title">Canciones más populares</h2>
            <div className="songs-list">
              {topSongs.map((song, idx) => {
                const isPlaying = currentSong?.id === song.id;
                return (
                  <div key={song.id} className={`song-row ${isPlaying ? 'playing' : ''}`} onClick={() => playSongList(topSongs, idx)}>
                    <div className="col-index">{idx + 1}</div>
                    <div className="col-img">
                      <img src={song.portada} alt={song.titulo} />
                      <div className="overlay-play">
                        {isPlaying ? <IoPauseSharp size={20} /> : <IoPlaySharp size={20} />}
                      </div>
                    </div>
                    <div className="col-title">
                      <span className="song-title-text">{song.titulo}</span>
                      <div className="song-meta">
                        <span className="badge-explicit">E</span>
                        <span className="artist-name-small">{artist?.nombre}</span>
                      </div>
                    </div>
                    <div className="col-duration">{formatDuration(song.duracion)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Álbumes Carrusel */}
        {albums.length > 0 && (
          <div className="section albums-section">
            <h2 className="section-title">Álbumes y sencillos</h2>
            <Slider {...albumSliderSettings}>
              {albums.map(album => (
                <div key={album.id} className="album-slide">
                  <AlbumCard album={album} />
                </div>
              ))}
            </Slider>
          </div>
        )}
      </div>

      <style jsx>{`
        .artist-page {
          background: linear-gradient(180deg, #0a0a0a 0%, #000000 100%);
          min-height: 100vh;
          color: white;
          position: relative;
          overflow-x: hidden;
          font-family: 'Roboto', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        /* Fondos ambientales con degradados suaves */
        .ambient-background {
          position: fixed;
          top: -10%;
          left: -10%;
          width: 120%;
          height: 80vh;
          background-size: cover;
          background-position: center top;
          filter: blur(100px) brightness(0.35) saturate(1.3);
          opacity: 0.6;
          z-index: 0;
          mask-image: radial-gradient(ellipse 80% 60% at 50% 20%, black 0%, transparent 70%);
          -webkit-mask-image: radial-gradient(ellipse 80% 60% at 50% 20%, black 0%, transparent 70%);
          pointer-events: none;
          animation: ambient-pulse 8s ease-in-out infinite;
        }

        @keyframes ambient-pulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.05); opacity: 0.7; }
        }

        .gradient-overlay-top {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100vh;
          background: linear-gradient(
            180deg,
            rgba(0,0,0,0.3) 0%,
            rgba(0,0,0,0.5) 40%,
            rgba(0,0,0,0.9) 70%,
            #000000 100%
          );
          z-index: 0;
          pointer-events: none;
        }

        /* Hero Section mejorado */
        .hero-section {
          position: relative;
          z-index: 1;
          padding: 100px 48px 40px 48px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          min-height: 480px;
        }

        .hero-content {
          display: flex;
          align-items: flex-end;
          gap: 48px;
          max-width: 1400px;
          margin: 0 auto;
          width: 100%;
        }

        .artist-image-container {
          position: absolute;
          top: 0;
          right: 0;
          width: 65%;
          height: 100%;
          z-index: -1;
          opacity: 0.4;
        }

        .hero-artist-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: top center;
          mask-image: linear-gradient(
            to bottom,
            rgba(0,0,0,0.9) 0%,
            rgba(0,0,0,0.5) 50%,
            transparent 95%
          ),
          linear-gradient(
            to left,
            rgba(0,0,0,0.8) 0%,
            transparent 60%
          );
          -webkit-mask-composite: source-in;
          mask-composite: intersect;
        }

        .hero-text-layer {
          width: 100%;
          max-width: 900px;
          position: relative;
        }

        .verified-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(139, 92, 246, 0.15));
          backdrop-filter: blur(10px);
          padding: 6px 16px;
          border-radius: 20px;
          font-size: 0.875rem;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.1);
          margin-bottom: 16px;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
        }

        .verified-badge svg {
          color: #3b82f6;
        }

        .artist-name {
          font-size: clamp(3rem, 7vw, 6rem);
          font-weight: 900;
          margin-bottom: 16px;
          letter-spacing: -2px;
          background: linear-gradient(180deg, #ffffff 0%, rgba(255,255,255,0.85) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          text-shadow: 0 4px 24px rgba(0,0,0,0.4);
          line-height: 1.1;
        }

        .artist-meta {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 28px;
          flex-wrap: wrap;
        }

        .meta-item {
          color: rgba(255, 255, 255, 0.7);
          font-size: 1rem;
          font-weight: 400;
        }

        .meta-divider {
          color: rgba(255, 255, 255, 0.3);
          font-size: 0.875rem;
        }

        .bio-text {
          max-width: 500px;
          line-height: 1.5;
        }

        .action-buttons {
          display: flex;
          gap: 14px;
          margin-top: 28px;
          flex-wrap: wrap;
        }

        .btn-pill {
          border: none;
          padding: 0 28px;
          height: 44px;
          border-radius: 24px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }

        .btn-pill::before {
          content: '';
          position: absolute;
          inset: 0;
          opacity: 0;
          transition: opacity 0.3s;
          border-radius: 24px;
        }

        .btn-pill:hover::before {
          opacity: 1;
        }

        .btn-pill.primary {
          background: linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%);
          color: #000000;
          box-shadow: 0 4px 16px rgba(255, 255, 255, 0.2);
        }

        .btn-pill.primary::before {
          background: linear-gradient(135deg, #f0f0f0 0%, #e0e0e0 100%);
        }

        .btn-pill.primary:hover {
          transform: translateY(-2px) scale(1.02);
          box-shadow: 0 6px 24px rgba(255, 255, 255, 0.3);
        }

        .btn-pill.primary:active {
          transform: translateY(0) scale(0.98);
        }

        .btn-pill.secondary {
          background: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.05) 100%);
          color: #ffffff;
          border: 1px solid rgba(255,255,255,0.12);
          backdrop-filter: blur(10px);
        }

        .btn-pill.secondary::before {
          background: linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.1) 100%);
        }

        .btn-pill.secondary:hover {
          transform: translateY(-2px);
          border-color: rgba(255,255,255,0.2);
        }

        /* Main content */
        .main-content {
          position: relative;
          z-index: 2;
          padding: 32px 48px 120px 48px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .section {
          margin-bottom: 48px;
        }

        .section-title {
          font-size: 1.5rem;
          font-weight: 700;
          margin-bottom: 24px;
          color: white;
          letter-spacing: -0.5px;
        }

        /* Lista de canciones mejorada */
        .songs-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .song-row {
          display: grid;
          grid-template-columns: 40px 56px 1fr 80px;
          align-items: center;
          padding: 12px 16px;
          border-radius: 8px;
          cursor: pointer;
          color: rgba(255, 255, 255, 0.7);
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }

        .song-row::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, 
            rgba(255,255,255,0.05) 0%, 
            rgba(255,255,255,0.08) 50%, 
            rgba(255,255,255,0.05) 100%
          );
          opacity: 0;
          transition: opacity 0.3s;
        }

        .song-row:hover::before {
          opacity: 1;
        }

        .song-row:hover {
          background: linear-gradient(90deg, 
            rgba(255,255,255,0.08) 0%, 
            rgba(255,255,255,0.12) 100%
          );
          transform: translateX(4px);
        }

        .song-row.playing {
          background: linear-gradient(90deg, 
            rgba(59, 130, 246, 0.15) 0%, 
            rgba(139, 92, 246, 0.1) 100%
          );
          color: #3b82f6;
        }

        .col-index {
          font-size: 1rem;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.5);
          text-align: center;
          transition: color 0.2s;
        }

        .song-row:hover .col-index,
        .song-row.playing .col-index {
          color: rgba(255, 255, 255, 0.9);
        }

        .col-img {
          position: relative;
          width: 48px;
          height: 48px;
          border-radius: 6px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }

        .col-img img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.3s;
        }

        .song-row:hover .col-img img {
          transform: scale(1.05);
        }

        .overlay-play {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(0,0,0,0.7), rgba(0,0,0,0.5));
          backdrop-filter: blur(4px);
          display: flex;
          justify-content: center;
          align-items: center;
          color: white;
          opacity: 0;
          transition: opacity 0.3s;
        }

        .song-row:hover .overlay-play {
          opacity: 1;
        }

        .col-title {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding-left: 16px;
          padding-right: 20px;
          min-width: 0;
        }

        .song-title-text {
          color: white;
          font-weight: 500;
          font-size: 1rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          transition: color 0.2s;
        }

        .song-row.playing .song-title-text {
          color: #3b82f6;
        }

        .song-meta {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .badge-explicit {
          background: rgba(255, 255, 255, 0.15);
          color: rgba(255, 255, 255, 0.9);
          font-size: 10px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 3px;
          letter-spacing: 0.5px;
        }

        .artist-name-small {
          font-size: 0.875rem;
          color: rgba(255, 255, 255, 0.6);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .col-duration {
          text-align: right;
          font-size: 0.9rem;
          font-variant-numeric: tabular-nums;
          color: rgba(255, 255, 255, 0.6);
        }

        /* Álbumes */
        .albums-section {
          margin-top: 64px;
        }

        .album-slide {
          padding: 0 0px;
        }

        /* Loading spinner mejorado */
        .loading-spinner {
          width: 64px;
          height: 64px;
          border: 3px solid rgba(59, 130, 246, 0.1);
          border-top: 3px solid #3b82f6;
          border-radius: 50%;
          animation: spin 1s cubic-bezier(0.5, 0, 0.5, 1) infinite;
          box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Responsive */
        @media (max-width: 768px) {
          .hero-section {
            padding: 60px 24px 32px 24px;
            min-height: 380px;
          }

          .hero-content {
            gap: 24px;
          }

          .artist-image-container {
            width: 100%;
            opacity: 0.3;
          }

          .artist-name {
            font-size: 2.5rem;
          }

          .main-content {
            padding: 24px 24px 100px 24px;
          }

          .song-row {
            grid-template-columns: 32px 48px 1fr 70px;
            padding: 10px 12px;
          }

          .col-title {
            padding-left: 12px;
          }

          .artist-name-small {
            display: none;
          }

          .action-buttons {
            width: 100%;
          }

          .btn-pill {
            flex: 1;
            min-width: 0;
          }
        }

        @media (max-width: 480px) {
          .artist-name {
            font-size: 2rem;
          }

          .verified-badge {
            font-size: 0.75rem;
            padding: 4px 12px;
          }

          .col-index {
            font-size: 0.875rem;
          }

          .song-title-text {
            font-size: 0.9rem;
          }
        }
      `}</style>
    </div>
  );
}