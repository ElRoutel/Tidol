import React from 'react';
import { usePlayer } from '../context/PlayerContext';
import { useHome } from '../hooks/useHome';
import useLazyCaching from '../hooks/useLazyCaching';
import api from '../api/axiosConfig';
import ChipsCarousel from '../components/home/ChipsCarousel';
import HomeAllView from '../components/home/views/HomeAllView';
import '../styles/glass.css';

export default function HomePage() {
  const { playSongList } = usePlayer();
  const { selectedChip, setSelectedChip, isLoading, data } = useHome();
  const { handlePlayTrack, handlePlayList } = useLazyCaching();

  const handlePlaySong = (song, index, songList) => {
    // Detectar si es una canción de Internet Archive
    // Las canciones de IA pueden venir de varias fuentes:
    // 1. Con campo 'type' = 'ia' (desde getHistory)
    // 2. Con campo 'identifier' (desde búsqueda/Search)
    // 3. URL contiene 'archive.org'
    const isInternetArchive =
      song.type === 'ia' ||
      song.identifier ||
      song.url?.includes('archive.org');

    console.log('🎵 Playing song:', {
      titulo: song.titulo,
      isIA: isInternetArchive,
      type: song.type,
      id: song.id,
      identifier: song.identifier,
      url: song.url?.substring(0, 50) + '...'
    });

    if (isInternetArchive) {
      // Usar lazy caching para canciones de IA
      // Esto reproduce inmediatamente Y dispara descarga en background
      if (index === 0) {
        handlePlayList(songList, 0);
      } else {
        handlePlayList(songList.slice(index), 0);
      }
    } else {
      // CANCIONES LOCALES: Reproducir + Sincronizar a Spectra
      const playlist = songList.slice(index);
      playSongList(playlist, 0);

      // Sincronizar canción local a Spectra para análisis
      syncLocalToSpectra(song);
    }
  };

  // Sincronizar canción local a Spectra
  const syncLocalToSpectra = async (song) => {
    try {
      // Use api instance instead of fetch to handle base URL and headers automatically
      // Endpoint is now /music/sync-local-song (mounted at /api/music)
      const response = await api.post('/music/sync-local-song', {
        songId: song.id,
        title: song.titulo || song.title,
        artist: song.artista || song.artist || 'Unknown',
        album: song.album || 'Local Music',
        filepath: song.archivo || song.url,
        coverpath: song.portada || null,
        duration: song.duracion || song.duration || 0,
        bitrate: song.bit_rate || 0
      });

      const data = response.data;
      if (data.success && !data.alreadyExists) {
        console.log('📊 Canción local sincronizada a Spectra para análisis:', song.titulo);
      }
    } catch (error) {
      console.warn('⚠️  No se pudo sincronizar a Spectra:', error.message);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen w-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="pb-32">

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
        <HomeAllView data={data} onPlay={handlePlaySong} />
      </div>
    </div>
  );
}

