import React from 'react';
import { usePlayer } from '../context/PlayerContext';
import { useHome } from '../hooks/useHome';
import ChipsCarousel from '../components/home/ChipsCarousel';
import HomeAllView from '../components/home/views/HomeAllView';
import '../styles/glass.css';

export default function HomePage() {
  const { playSongList } = usePlayer();
  const { selectedChip, setSelectedChip, isLoading, data } = useHome();

  const handlePlaySong = (song, index, songList) => {
    const playlist = songList.slice(index);
    playSongList(playlist, 0);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen w-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen pb-32 overflow-x-hidden">

      {/* Header / Chips Section */}
      {/* Mobile: px-4, Desktop: px-12. Top padding adjusted. */}
      <div className="pt-24 px-4 md:px-12 mb-6 md:mb-8">
        <div className="w-full">
          <ChipsCarousel selectedChip={selectedChip} onSelectChip={setSelectedChip} />
        </div>
      </div>

      {/* Content Section */}
      {/* Mobile: px-0 (full width), Desktop: px-12 */}
      <div className="flex flex-col gap-8 md:gap-12 px-0 md:px-12">
        {selectedChip === 'all' && (
          <HomeAllView data={data} onPlay={handlePlaySong} />
        )}

        {selectedChip !== 'all' && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500 gap-4 px-4">
            <p className="text-lg">Explorando {selectedChip}...</p>
            <HomeAllView data={data} onPlay={handlePlaySong} />
          </div>
        )}
      </div>
    </div>
  );
}

