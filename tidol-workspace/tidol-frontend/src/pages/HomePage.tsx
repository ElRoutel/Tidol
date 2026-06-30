import { usePlayer } from '../context/PlayerContext';
import { useHome } from '../hooks/useHome';
import useLazyCaching from '../hooks/useLazyCaching';
import ChipsCarousel from '../components/home/ChipsCarousel';
import HomeAllView from '../components/home/views/HomeAllView';
import SkeletonSongList from '../components/skeletons/SkeletonSongList';
import { UnifiedTrack } from '../types/music';
import '../styles/glass.css';

export default function HomePage() {
  const { playSongList } = usePlayer();
  const { selectedChip, setSelectedChip, isLoading, data } = useHome();
  const { handlePlayList } = useLazyCaching();

  const handlePlaySong = (song: UnifiedTrack, index: number, songList: UnifiedTrack[]) => {
    // La data ya viene normalizada por useHome -> normalizeTrackList
    const isInternetArchive = song.sourceType === 'internet-archive';

    if (isInternetArchive) {
      // Usar lazy caching para canciones de IA (Stream + Background Download)
      handlePlayList(songList.slice(index), 0);
    } else {
      // Canciones locales
      playSongList(songList.slice(index), 0);
    }
  };

  return (
    <div className="pb-24 md:pb-32">
      {/* Header / Chips Section */}
      <div className="pt-20 md:pt-24 px-4 md:px-8 mb-8">
        <div className="w-full max-w-[1600px] mx-auto">
          <ChipsCarousel selectedChip={selectedChip} onSelectChip={setSelectedChip} />
        </div>
      </div>

      {/* Content Section */}
      <div className="flex flex-col gap-10 md:gap-14 px-0 md:px-8 max-w-[1600px] mx-auto">
        {isLoading ? (
          <div className="px-4 md:px-0">
            <SkeletonSongList count={8} />
          </div>
        ) : (
          <HomeAllView data={data} onPlay={handlePlaySong} />
        )}
      </div>
    </div>
  );
}
