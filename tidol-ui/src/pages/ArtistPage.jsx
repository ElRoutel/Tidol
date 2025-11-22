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

  if (loading) return <div className="flex justify-center items-center h-full min-h-screen bg-black"><div className="loading-spinner" /></div>;

  if (error) return (
    <div className="text-center p-8 text-white bg-black h-screen">
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
      {/* Fondo ambiental glow desenfocado */}
      <div className="ambient-background" style={{ backgroundImage: `url(${artist?.imagen})` }} />

      {/* Hero Section */}
      <div className="hero-section">
        <div className="hero-content">
          <div className="artist-image-container">
            <img src={artist?.imagen} alt={artist?.nombre} className="hero-artist-img" />
            <div className="hero-gradient-overlay"></div>
          </div>

          <div className="hero-text-layer">
            <h1 className="artist-name">{artist?.nombre}</h1>
            <div className="artist-stats">{artist?.canciones} canciones</div>
            <p className="artist-bio-snippet">Artista verificado {artist?.biografia || ''}</p>

            <div className="action-buttons">
              <button onClick={handlePlayTopSongs} className="btn-pill primary">Reproducir</button>
              <button className="btn-pill secondary"><IoRadio /> Radio</button>
              <button className="btn-pill secondary">Suscribirse</button>
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
                    <div className="col-img">
                      <img src={song.portada} alt={song.titulo} />
                      <div className="overlay-play">{isPlaying ? <IoPauseSharp /> : <IoPlaySharp />}</div>
                    </div>
                    <div className="col-title">
                      <span className="song-title-text">{song.titulo}</span>
                      <span className="badge-explicit">E</span>
                    </div>
                    <div className="col-artist">{artist?.nombre}</div>
                    <div className="col-actions">{formatDuration(song.duracion)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Álbumes Carrusel */}
        {albums.length > 0 && (
          <div className="section" style={{ marginTop: '40px' }}>
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
          background-color: #030303;
          min-height: 100vh;
          color: white;
          position: relative;
          overflow-x: hidden;
          font-family: 'Roboto', sans-serif;
        }

        /* Fondo ambient glow */
        .ambient-background {
          position: fixed;
          top: 0; left: 0;
          width: 100%;
          height: 70vh;
          background-size: cover;
          background-position: center;
          filter: blur(80px) brightness(0.4);
          opacity: 0.5;
          z-index: 0;
          mask-image: linear-gradient(to bottom, black 0%, transparent 100%);
          -webkit-mask-image: linear-gradient(to bottom, black 0%, transparent 100%);
          pointer-events: none;
        }

        /* Hero Section */
        .hero-section {
          position: relative;
          z-index: 1;
          padding: 80px 40px 20px 40px;
          display: flex; flex-direction: column; justify-content: flex-end;
          min-height: 450px;
        }
        .hero-content {
          display: flex; align-items: flex-end; gap: 40px; max-width: 1400px; margin: 0 auto; width: 100%;
        }

        .artist-image-container {
          position: absolute; top: 0; right: 0; width: 60%; height: 100%; z-index: -1; opacity: 0.8;
        }
        .hero-artist-img {
          width: 100%; height: 100%; object-fit: cover; object-position: top center;
          mask-image: linear-gradient(to bottom, black 20%, transparent 90%), linear-gradient(to left, black 20%, transparent 90%);
          -webkit-mask-image: linear-gradient(to bottom, black 20%, transparent 90%), linear-gradient(to left, black 20%, transparent 90%);
        }

        .hero-text-layer {
          width: 100%; max-width: 900px;
        }
        .artist-name {
          font-size: clamp(3rem, 6vw, 5.5rem);
          font-weight: 800; margin-bottom: 10px;
          letter-spacing: -1px;
          text-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }
        .artist-stats {
          color: rgba(255,255,255,0.7);
          font-size: 1rem;
          margin-bottom: 16px;
        }
        .artist-bio-snippet {
          color: #aaaaaa;
          font-size: 0.95rem;
          margin-bottom: 24px;
          max-width: 600px;
          line-height: 1.5;
        }
        .action-buttons {
          display: flex;
          gap: 12px;
          margin-top: 20px;
        }
        .btn-pill {
          border: none;
          padding: 0 24px;
          height: 36px;
          border-radius: 18px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: transform 0.1s, background 0.2s;
        }
        .btn-pill.primary {
          background-color: #ffffff;
          color: #000000;
        }
        .btn-pill.primary:hover {
          background-color: #eeeeee;
        }
        .btn-pill.secondary {
          background-color: rgba(255,255,255,0.1);
          color: #ffffff;
          border: 1px solid rgba(255,255,255,0.1);
        }
        .btn-pill.secondary:hover {
          background-color: rgba(255,255,255,0.2);
        }

        /* Main content */
        .main-content {
          position: relative;
          z-index: 2;
          padding: 20px 40px 100px 40px;
          background: linear-gradient(to bottom, transparent 0%, #030303 10%);
          max-width: 1400px;
          margin: 0 auto;
        }
        .section-title {
          font-size: 1.25rem;
          font-weight: 700;
          margin-bottom: 20px;
          color: white;
        }

        /* Canciones */
        .songs-list {
          display: flex;
          flex-direction: column;
        }
        .song-row {
          display: grid;
          grid-template-columns: 50px 4fr 3fr 60px;
          align-items: center;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          color: #aaaaaa;
          transition: background-color 0.2s;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .song-row:hover {
          background-color: rgba(255,255,255,0.1);
        }
        .song-row:last-child {
          border-bottom: none;
        }
        .col-img {
          position: relative;
          width: 40px;
          height: 40px;
        }
        .col-img img {
          width: 100%;
          height: 100%;
          border-radius: 2px;
          object-fit: cover;
        }
        .overlay-play {
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          color: white;
          opacity: 0;
          transition: opacity 0.2s;
        }
        .song-row:hover .overlay-play {
          opacity: 1;
        }
        .col-title {
          display: flex;
          flex-direction: column;
          padding-left: 16px;
          padding-right: 20px;
        }
        .song-title-text {
          color: white;
          font-weight: 500;
          font-size: 1rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .badge-explicit {
          background: rgba(255,255,255,0.6);
          color: black;
          font-size: 9px;
          padding: 1px 4px;
          border-radius: 2px;
          width: fit-content;
          margin-top: 4px;
        }
        .col-artist {
          font-size: 0.9rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .col-actions {
          text-align: right;
          font-size: 0.9rem;
        }

        /* Álbum grid to slider styling */
        .albums-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 24px;
        }
        .album-slide {
          padding: 0 12px;
        }

        /* Loading spinner */
        .loading-spinner {
          width: 50px;
          height: 50px;
          border: 4px solid rgba(29, 185, 84, 0.2);
          border-top: 4px solid #1db954;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 20px;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Responsive */
        @media (max-width: 768px) {
          .hero-section {
            padding: 40px 20px;
            min-height: 350px;
          }
          .artist-image-container {
            width: 100%;
            opacity: 0.6;
          }
          .artist-name {
            font-size: 2.5rem;
          }
          .main-content {
            padding: 20px;
          }
          .song-row {
            grid-template-columns: 50px 1fr 50px;
            gap: 10px;
          }
          .col-artist {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
