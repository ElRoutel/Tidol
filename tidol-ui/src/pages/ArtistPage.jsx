```javascript
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/axiosConfig';
import { usePlayerActions } from '../context/PlayerContext';
import UniversalCard from '../components/cards/UniversalCard';
import Slider from 'react-slick';
import { IoPlaySharp, IoCheckmarkCircle } from 'react-icons/io5';
import '../styles/glass.css';

import "slick-carousel/slick/slick.css"; 
import "slick-carousel/slick/slick-theme.css";

export default function ArtistPage() {
  const { id } = useParams();
  const { playSongList } = usePlayerActions();

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
        const artistRes = await api.get(`/ music / artists / ${ id } `);
        setArtist(artistRes.data);
        setAlbums(artistRes.data.albums || []);

        const songsRes = await api.get(`/ music / artists / ${ id }/songs`);
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

if (loading) return (
  <div className="flex justify-center items-center h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
  </div>
);

if (error) return (
  <div className="flex justify-center items-center h-screen text-red-400">
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
    { breakpoint: 1024, settings: { slidesToShow: 4, slidesToScroll: 2, infinite: false } },
    { breakpoint: 768, settings: { slidesToShow: 2, slidesToScroll: 1, infinite: false } },
    { breakpoint: 480, settings: { slidesToShow: 1, slidesToScroll: 1, infinite: false } },
  ]
};

return (
  <div className="relative min-h-screen pb-40 overflow-x-hidden">
    {/* Fondo ambiental */}
    <div
      className="fixed inset-0 z-0 bg-cover bg-top blur-3xl opacity-40 scale-110 pointer-events-none transition-all duration-1000"
      style={{ backgroundImage: `url(${artist?.imagen})` }}
    />
    <div className="fixed inset-0 z-0 bg-gradient-to-b from-black/20 via-[#0a0a0a]/80 to-[#0a0a0a] pointer-events-none" />

    {/* Hero Section */}
    <div className="relative z-10 pt-32 pb-12 px-8 max-w-7xl mx-auto flex flex-col justify-end min-h-[50vh]">
      <div className="flex flex-col md:flex-row items-end gap-12">
        {/* Artist Image */}
        <div className="w-48 h-48 md:w-64 md:h-64 rounded-full overflow-hidden shadow-2xl border-4 border-white/10 hidden md:block">
          <img src={artist?.imagen} alt={artist?.nombre} className="w-full h-full object-cover" />
        </div>

        <div className="flex-1">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/20 border border-blue-500/20 text-blue-400 text-sm font-medium mb-4 backdrop-blur-md">
            <IoCheckmarkCircle size={16} />
            <span>Artista Verificado</span>
          </div>

          <h1 className="text-6xl md:text-8xl font-black text-white mb-6 tracking-tighter leading-none shadow-lg">
            {artist?.nombre}
          </h1>

          <div className="flex items-center gap-4 text-gray-300 mb-8">
            <span>{artist?.canciones} canciones</span>
            {artist?.biografia && (
              <>
                <span>•</span>
                <span className="max-w-2xl line-clamp-2">{artist.biografia}</span>
              </>
            )}
          </div>

          <div className="flex gap-4">
            <button
              onClick={handlePlayTopSongs}
              className="px-8 py-3 rounded-full bg-white text-black font-bold flex items-center gap-2 hover:scale-105 transition-transform shadow-xl hover:shadow-white/20"
            >
              <IoPlaySharp size={20} />
              Reproducir
            </button>
          </div>
        </div>
      </div>
    </div>

    {/* Main Content */}
    <div className="relative z-10 px-8 max-w-7xl mx-auto space-y-16">

      {/* Popular Songs */}
      {topSongs.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold text-white mb-6">Populares</h2>
          <div className="flex flex-col gap-2">
            {topSongs.map((song, idx) => (
              <UniversalCard
                key={song.id}
                data={song}
                type="song"
                variant="list"
                index={idx}
                onPlay={() => playSongList(topSongs, idx)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Albums Carousel */}
      {albums.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold text-white mb-6">Álbumes y sencillos</h2>
          <div className="-mx-4 px-4">
            <Slider {...albumSliderSettings}>
              {albums.map(album => (
                <div key={album.id} className="px-3 pb-8">
                  <UniversalCard
                    data={album}
                    type="album"
                    variant="shelf"
                  />
                </div>
              ))}
            </Slider>
          </div>
        </section>
      )}
    </div>
  </div>
);
}
```