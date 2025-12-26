import React from 'react';
import { usePlayer } from '../context/PlayerContext';
import { useHome } from '../hooks/useHome';
import useLazyCaching from '../hooks/useLazyCaching';
import api from '../api/axiosConfig';
import axios from 'axios';
import ChipsCarousel from '../components/home/ChipsCarousel';
import HomeAllView from '../components/home/views/HomeAllView';
import SkeletonSongList from '../components/skeletons/SkeletonSongList';
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
      // Use axios directly to hit the /spectra proxy (port 3001)
      // Endpoint is now /spectra/sync-local-song (proxied to port 3001)
      const response = await axios.post('/spectra/sync-local-song', {
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

  // Render First Strategy: No blocking return


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
