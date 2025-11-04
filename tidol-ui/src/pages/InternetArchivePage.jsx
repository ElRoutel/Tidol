// src/pages/InternetArchivePage.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import axios from 'axios'; // Usamos axios normal para APIs EXTERNAS

// --- NUEVO: Ranking de Calidad ---
// (Menor número = Mejor calidad)
const qualityRank = {
  'FLAC': 1,
  'WAV': 2,
  'M4A': 3, // (ALAC suele estar en .m4a)
  'MP3': 4,
  'OGG': 5,
  'unknown': 100
};

export default function InternetArchivePage() {
  const { identifier } = useParams();
  const [searchParams] = useSearchParams();
  const shouldAutoplay = searchParams.get('autoplay') === 'true';

  const [album, setAlbum] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // --- NUEVOS ESTADOS para el filtrado ---
  const [allFiles, setAllFiles] = useState([]); // Guarda todos los archivos de audio
  const [groupedTracks, setGroupedTracks] = useState([]); // Guarda las canciones agrupadas
  const [filteredTracks, setFilteredTracks] = useState([]); // Lo que se va a renderizar
  const [availableFormats, setAvailableFormats] = useState([]); // Para el dropdown
  const [formatFilter, setFormatFilter] = useState('best'); // 'best' es el default

  const { playSongList, currentSong } = usePlayer(); // Traemos 'currentSong' para la UI

  // --- EFECTO 1: Cargar datos de la API (Solo una vez) ---
  useEffect(() => {
    const fetchAlbumData = async () => {
      try {
        setLoading(true);
        const metaRes = await axios.get(`https://archive.org/metadata/${identifier}`);
        const metaData = metaRes.data;

        const albumInfo = {
          title: metaData.metadata?.title || identifier,
          artist: metaData.metadata?.creator || 'Autor desconocido',
          cover: `https://archive.org/services/img/${identifier}`
        };
        setAlbum(albumInfo);

        // 1. Obtener todos los archivos de audio
        const audioFiles = Object.values(metaData.files || {})
          .filter(f => f.name.match(/\.(mp3|flac|wav|m4a|ogg)$/i))
          .map(f => {
            const format = (f.format || 'unknown').replace('Audio', '').trim().toUpperCase();
            return {
              titulo: f.name.split('/').pop().replace(/\.[^/.]+$/, '').replace(/^\d+\.\s*/, ''), // Limpia el nombre y la extensión
              format: format,
              formatRank: qualityRank[format] || 100,
              url: `https://archive.org/download/${identifier}/${encodeURIComponent(f.name)}`,
              artista: albumInfo.artist,
              album: albumInfo.title,
              id: `${identifier}_${f.name}`,
              portada: albumInfo.cover
            };
          });
        
        // 2. Guardar todos los archivos
        setAllFiles(audioFiles);

        // 3. Obtener formatos únicos para el dropdown
        const formats = [...new Set(audioFiles.map(f => f.format))];
        // Ordena los formatos por calidad para el dropdown
        formats.sort((a, b) => (qualityRank[a] || 100) - (qualityRank[b] || 100));
        setAvailableFormats(formats);

      } catch (err) {
        console.error("Error cargando IA Album:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAlbumData();
  }, [identifier]); // Solo depende del 'identifier'

  // --- EFECTO 2: Agrupar y Filtrar Canciones ---
  // Se ejecuta cuando los archivos cargan (allFiles) o cuando el filtro cambia (formatFilter)
  useEffect(() => {
    if (allFiles.length === 0) return;

    // 1. Agrupar archivos por 'titulo'
    const grouped = allFiles.reduce((acc, file) => {
      if (!acc[file.titulo]) {
        acc[file.titulo] = {
          title: file.titulo,
          artist: file.artista,
          formats: [], // Un array para todos los formatos disponibles
        };
      }
      acc[file.titulo].formats.push(file);
      return acc;
    }, {});

    // 2. Ordenar formatos y encontrar el mejor
    const finalGroupedTracks = Object.values(grouped).map(track => {
      // Ordena los formatos de esta canción por calidad
      track.formats.sort((a, b) => a.formatRank - b.formatRank);
      return {
        ...track,
        best: track.formats[0] // El formato de "mejor" calidad es el primero
      };
    });
    setGroupedTracks(finalGroupedTracks); // Guarda las canciones agrupadas

    // 3. Filtrar la lista para mostrar
    let tracksToShow = [];
    if (formatFilter === 'best') {
      // Si es 'best', mostramos el mejor formato de cada canción
      tracksToShow = finalGroupedTracks.map(track => track.best);
    } else {
      // Si es 'FLAC', 'MP3', etc., filtramos
      tracksToShow = finalGroupedTracks
        .map(track => track.formats.find(f => f.format === formatFilter))
        .filter(Boolean); // Elimina canciones que no tengan ese formato
    }

    setFilteredTracks(tracksToShow);

    // 4. Lógica de Autoplay (ahora usa la lista filtrada)
    if (shouldAutoplay && tracksToShow.length > 0) {
      playSongList(tracksToShow, 0);
    }
  }, [allFiles, formatFilter, shouldAutoplay, playSongList]);


  if (loading) return <div>Cargando álbum de Internet Archive...</div>;
  if (!album) return <div>No se encontró el álbum.</div>;

  return (
    <div className="album-page">
      {/* Banner del Álbum (sin cambios) */}
      <section className="album-container" style={{display: 'flex', gap: '24px', alignItems: 'center'}}>
        <img src={album.cover} alt={album.title} style={{width: 200, height: 200, borderRadius: '8px'}} />
        <div>
          <h2 style={{fontSize: '2rem'}}>{album.title}</h2>
          <p style={{fontSize: '1.2rem', color: '#b3b3b3'}}>{album.artist}</p>
          <button 
            onClick={() => playSongList(filteredTracks, 0)}
            style={{background: 'var(--primary)', border: 'none', color: 'white', padding: '12px 24px', borderRadius: '24px', cursor: 'pointer', marginTop: '16px', fontWeight: '600'}}
          >
            Reproducir (Filtro: {formatFilter})
          </button>
        </div>
      </section>

      {/* Panel de Canciones (con filtro) */}
      <section className="panel" style={{marginTop: '32px'}}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2>Canciones ({filteredTracks.length})</h2>
          
          {/* --- NUEVO: Selector de Filtro --- */}
          <div>
            <label htmlFor="format-filter" style={{marginRight: '8px', fontSize: '14px', color: '#b3b3b3'}}>Calidad:</label>
            <select 
              id="format-filter"
              value={formatFilter}
              onChange={(e) => setFormatFilter(e.target.value)}
              style={{background: '#282828', color: 'white', border: 'none', borderRadius: '4px', padding: '8px'}}
            >
              <option value="best">Mejor Calidad</option>
              {availableFormats.map(format => (
                <option key={format} value={format}>{format}</option>
              ))}
            </select>
          </div>
        </div>
        
        {/* --- MODIFICADO: Renderiza 'groupedTracks' en lugar de 'tracks' --- */}
        <div className="songs-wrapper">
          {groupedTracks.map((track, index) => {
            // Busca la canción que coincide con el filtro actual
            const songToShow = (formatFilter === 'best') 
              ? track.best 
              : track.formats.find(f => f.format === formatFilter);

            // Si la canción no existe en este formato, la mostramos 'deshabilitada'
            if (!songToShow) {
              return (
                <div 
                  key={track.title} 
                  className="track-row-disabled"
                  style={{display: 'flex', alignItems: 'center', gap: '16px', padding: '8px', opacity: 0.3}}
                >
                  <div className="track-play">
                    <span className="track-number" style={{color: '#888'}}>{index + 1}</span>
                  </div>
                  <div className="track-info">
                    <h3 style={{fontSize: '16px', color: '#888'}}>{track.title}</h3>
                  </div>
                  <div className="song-quality">{formatFilter} no disponible</div>
                </div>
              );
            }

            // Si la canción SÍ existe, la mostramos normal
            const isPlaying = currentSong?.id === songToShow.id;
            // Necesitamos encontrar el índice de esta canción en la *lista filtrada* para el playSongList
            const filteredIndex = filteredTracks.findIndex(t => t.id === songToShow.id);

            return (
              <div 
                key={songToShow.id} 
                className={`track-row ${isPlaying ? 'playing' : ''}`}
                onClick={() => playSongList(filteredTracks, filteredIndex)}
                style={{display: 'flex', alignItems: 'center', gap: '16px', padding: '8px', borderRadius: '4px', cursor: 'pointer'}}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-light)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div className="track-play">
                  <span className="track-number" style={{color: '#b3b3b3'}}>{index + 1}</span>
                </div>
                <div className="track-info">
                  <h3 style={{fontSize: '16px', color: isPlaying ? 'var(--primary)' : 'white'}}>
                    {songToShow.titulo}
                  </h3>
                </div>
                {/* Muestra todos los formatos disponibles como "tags" */}
                <div className="song-formats-available" style={{display: 'flex', gap: '4px'}}>
                  {track.formats.map(f => (
                    <span 
                      key={f.format} 
                      style={{
                        fontSize: '10px', 
                        background: f.format === songToShow.format ? 'var(--primary)' : '#404040', 
                        color: 'white', 
                        padding: '2px 4px', 
                        borderRadius: '3px'
                      }}
                    >
                      {f.format}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}