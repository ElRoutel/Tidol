import React from 'react';
import { usePlayer } from '../context/PlayerContext';
import { useHome } from '../hooks/useHome';
import ChipsCarousel from '../components/home/ChipsCarousel';
import SectionBlock from '../components/home/SectionBlock';
import MediaCarousel from '../components/home/MediaCarousel';
import ListGrid from '../components/home/ListGrid';
import './HomePage.css';

export default function HomePage() {
  const { playSongList } = usePlayer();
  const { selectedChip, setSelectedChip, isLoading, data } = useHome();

  const handlePlaySong = (song, index, songList) => {
    // Si es una lista de canciones (MediaCarousel o ListGrid)
    // pasamos la lista completa y el índice de inicio
    const playlist = songList.slice(index);
    playSongList(playlist, 0);
  };

  if (isLoading) {
    return (
      <div className="tidol-home-container flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="tidol-home-container pb-32">
      {/* Chips Carousel */}
      <div className="sticky top-0 z-20 bg-[#0a0a0a]/95 backdrop-blur-xl pt-4 pb-2 -mx-4 px-4 md:mx-0 md:px-0">
        <ChipsCarousel selectedChip={selectedChip} onSelectChip={setSelectedChip} />
      </div>

      <div className="tidol-home-content space-y-8">

        {/* Selección Rápida (Grid) */}
        {data.quickSelection.length > 0 && (
          <SectionBlock
            title="Selección rápida"
            subtitle="PARA EMPEZAR"
            onMore={() => console.log('Ver más selección rápida')}
          >
            <ListGrid
              items={data.quickSelection}
              onPlay={(song, index) => handlePlaySong(song, index, data.quickSelection)}
            />
          </SectionBlock>
        )}

        {/* Volver a escuchar (Carousel) */}
        {data.recentListenings.length > 0 && (
          <SectionBlock
            title="Volver a escuchar"
            subtitle="ROUTEL"
            onMore={() => console.log('Ver más historial')}
            showControls
          >
            <MediaCarousel
              items={data.recentListenings}
              type="song"
              onPlay={(song, index) => handlePlaySong(song, index, data.recentListenings)}
            />
          </SectionBlock>
        )}

        {/* Programas para ti (Podcasts) */}
        {data.programs.length > 0 && (
          <SectionBlock
            title="Programas para ti"
            subtitle="PODCASTS"
            showControls
          >
            <MediaCarousel
              items={data.programs}
              type="song" // Tratamos podcasts como songs por ahora
              onPlay={(song, index) => handlePlaySong(song, index, data.programs)}
            />
          </SectionBlock>
        )}

        {/* Álbumes recomendados */}
        {data.albums.length > 0 && (
          <SectionBlock
            title="Álbumes recomendados"
            subtitle="NUEVOS LANZAMIENTOS"
            showControls
          >
            <MediaCarousel
              items={data.albums}
              type="album"
            />
          </SectionBlock>
        )}

        {/* Covers y Remixes */}
        {data.coversRemixes.length > 0 && (
          <SectionBlock
            title="Covers y Remixes"
            subtitle="DESCUBRE MÁS"
            showControls
          >
            <MediaCarousel
              items={data.coversRemixes}
              type="song"
              onPlay={(song, index) => handlePlaySong(song, index, data.coversRemixes)}
            />
          </SectionBlock>
        )}

      </div>
    </div>
  );
}
