import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/axiosConfig';
import AlbumCard from '../components/cards/AlbumCard';
import '../styles/glass.css';
import { IoChevronBack, IoChevronForward } from 'react-icons/io5';

interface Album {
  id: string;
  title: string;
  artistId: string;
  artistName?: string;
  releaseYear?: number;
  coverUrl?: string;
  type?: string;
}

interface ArtistProfile {
  id: string;
  name: string;
  coverUrl: string;
  biography?: string | null;
  albums: Album[];
}

export default function ArtistPage() {
  const { id } = useParams<{ id: string }>();
  const [artist, setArtist] = useState<ArtistProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchArtistData = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const artistRes = await api.get(`/artists/${id}/discography`);
        setArtist(artistRes.data);
      } catch (err) {
        setError("No se pudo cargar el perfil del artista.");
      } finally {
        setLoading(false);
      }
    };
    fetchArtistData();
  }, [id]);

  if (loading) return (
    <div className="relative min-h-screen pb-40 overflow-x-hidden bg-black animate-pulse">
      <div className="w-full h-[60vh] bg-white/5"></div>
      <div className="relative z-10 -mt-[25vh] px-6 md:px-12 max-w-[1600px] mx-auto flex flex-col justify-end">
        <div className="flex flex-col gap-4 pb-10 border-b border-white/10">
          <div className="h-20 md:h-32 bg-white/10 rounded-lg w-2/3 md:w-1/2"></div>
          <div className="h-4 bg-white/10 rounded w-full max-w-3xl"></div>
          <div className="h-4 bg-white/10 rounded w-5/6 max-w-2xl"></div>
        </div>
        <div className="mt-12 space-y-8">
            <div className="h-8 bg-white/10 rounded w-48 mb-6"></div>
            <div className="flex gap-4 overflow-hidden">
                {[1,2,3,4,5].map(i => (
                    <div key={i} className="w-40 md:w-56 aspect-square bg-white/10 rounded-xl flex-shrink-0"></div>
                ))}
            </div>
        </div>
      </div>
    </div>
  );

  if (error || !artist) return (
    <div className="flex justify-center items-center min-h-screen bg-black text-red-400">
      <h2 className="text-2xl font-bold">{error || "Artista no encontrado"}</h2>
    </div>
  );

  const groupedDiscography = artist.albums?.reduce((acc: any, current) => {
      const type = current.type?.toLowerCase() || 'single';
      if (type.includes('album')) acc.albums.push(current);
      else if (type.includes('ep')) acc.eps.push(current);
      else acc.singles.push(current);
      return acc;
  }, { albums: [], eps: [], singles: [] });

    // Helper to scroll carousel
    const scrollCarousel = (id: string, delta: number) => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollBy({ left: delta, behavior: 'smooth' });
      }
    };

  const renderCarousel = (title: string, items: Album[]) => {
    if (!items || items.length === 0) return null;
    const carouselId = `carousel-${title.replace(/\s+/g, '-').toLowerCase()}`;
    return (
      <section className="py-6 relative group overflow-visible">
        {/* Header: title left, arrows right */}
        <div className="flex items-end justify-between mb-6">
          <h2 className="text-3xl font-bold text-white tracking-tight">{title}</h2>
          <div className="flex gap-2">
            <button
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-all"
              onClick={() => scrollCarousel(carouselId, -300)}
              aria-label="Desplazar izquierda"
            >
              <IoChevronBack size={18} />
            </button>
            <button
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-all"
              onClick={() => scrollCarousel(carouselId, 300)}
              aria-label="Desplazar derecha"
            >
              <IoChevronForward size={18} />
            </button>
          </div>
        </div>
        {/* Scrollable list + visible thin scrollbar */}
        <div
          id={carouselId}
          className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-3 scroll-smooth"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,0.25) transparent',
          } as React.CSSProperties}
        >
          {items.map((album) => {
            return (
              <div key={album.id} className="snap-center shrink-0 w-40 md:w-56">
                <AlbumCard
                  id={album.id}
                  title={album.title}
                  artistName={album.artistName || artist.name}
                  coverUrl={album.coverUrl || '/default-artwork.png'}
                  releaseYear={album.releaseYear}
                  type={album.type}
                  artistId={album.artistId || artist.id}
                />
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <div className="relative min-h-screen pb-40 overflow-x-hidden bg-black">
      
      {/* 4K Hero Background */}
      <div className="absolute top-0 left-0 w-full h-[60vh] z-0 pointer-events-none bg-neutral-900">
        <div 
          className="w-full h-full bg-cover bg-center transition-all duration-1000"
          style={{ backgroundImage: `url(${artist.coverUrl || '/default-artwork.png'})` }}
        ></div>
        {/* Dark Gradient Overlay for seamless blend */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent"></div>
      </div>

      {/* Hero Content Section */}
      <div className="relative z-10 pt-[35vh] px-6 md:px-12 max-w-[1600px] mx-auto flex flex-col justify-end">
        <div className="flex flex-col gap-4 pb-10 border-b border-white/10">
          <h1 className="text-6xl md:text-8xl lg:text-9xl font-black text-white tracking-tighter leading-none drop-shadow-lg">
            {artist.name}
          </h1>
          {artist.biography && (
            <p className="text-sm md:text-base text-white/80 max-w-3xl line-clamp-3 font-medium drop-shadow-md">
              {artist.biography}
            </p>
          )}
        </div>
      </div>

      {/* Discography Carousel Section */}
      <div className="relative z-10 px-6 md:px-12 max-w-[1600px] mx-auto mt-4 space-y-4">
        {renderCarousel("Álbumes", groupedDiscography?.albums)}
        {renderCarousel("EPs", groupedDiscography?.eps)}
        {renderCarousel("Sencillos| Albumes | Colaboraciones", groupedDiscography?.singles)}
      </div>
      
    </div>
  );
}
