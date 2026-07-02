import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import { useHome } from '../hooks/useHome';
import useLazyCaching from '../hooks/useLazyCaching';
import HomeAllView from '../components/home/views/HomeAllView';
import SkeletonSongList from '../components/skeletons/SkeletonSongList';
import { UnifiedTrack } from '../types/music';
import '../styles/glass.css';

// Saludo según la hora local: la Home abre con contexto humano, no con chrome.
function greetingForHour(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Buenos días';
  if (hour >= 12 && hour < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

export default function HomePage() {
  const { playSongList } = usePlayer();
  const { user } = useAuth();
  const { isLoading, data } = useHome();
  const { handlePlayList } = useLazyCaching();

  const handlePlaySong = (song: UnifiedTrack, index: number, songList: UnifiedTrack[]) => {
    // La data ya viene normalizada por useHome -> normalizeTrackList
    const isInternetArchive = song.sourceType === 'internet-archive';

    if (isInternetArchive) {
      // Lazy caching para canciones de IA (Stream + Background Download)
      handlePlayList(songList.slice(index), 0);
    } else {
      playSongList(songList.slice(index), 0);
    }
  };

  const greeting = greetingForHour(new Date().getHours());
  const username = user?.username;

  return (
    <div className="pb-24 md:pb-32">
      {/* Cabecera: saludo por hora */}
      <div className="pt-20 md:pt-24 px-4 md:px-8 mb-2 md:mb-4">
        <div className="w-full max-w-[1600px] mx-auto px-4 md:px-0">
          <span className="text-white/40 text-[11px] font-bold uppercase tracking-[1.4px] mb-2 block">
            {new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
          <h1 className="text-white text-3xl md:text-4xl font-bold tracking-tight">
            {greeting}{username ? `, ${username}` : ''}
          </h1>
        </div>
      </div>

      {/* Contenido */}
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
