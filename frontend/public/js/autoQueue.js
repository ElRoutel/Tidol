import { addToQueue, reproducidas } from './queue.js';

// Añade hasta N tracks similares (local + IA simple) usando artist/album metadata
export async function addSimilarTracks(track, albumIdentifier, max = 5) {
  if (!track) return [];
  const similares = [];

  // 1) Buscar local por artista (usa tu API /api/search)
  try {
    const q = encodeURIComponent(track.artist || track.name || '');
    const res = await fetch(`/api/search?q=${q}`);
    const data = await res.json();
    (data.canciones || []).forEach(s => {
      const id = s.id || s.url;
      if (!reproducidas.has(id)) similares.push({
        id,
        name: s.titulo || s.name,
        artist: s.artista || s.artist,
        url: s.url || s.archivo,
        format: s.formato || s.format || 'local'
      });
    });
  } catch (err) {
    console.warn('autoQueue: error buscando local', err);
  }

  // 2) Buscar en el mismo item de IA (albumIdentifier)
  if (albumIdentifier) {
    try {
      const res = await fetch(`https://archive.org/metadata/${albumIdentifier}`);
      const meta = await res.json();
      const files = Object.values(meta.files || {}).filter(f => f.name && f.name.match(/\.(mp3|flac|wav|m4a|ogg)$/i));
      files.forEach(f => {
        const url = `https://archive.org/download/${albumIdentifier}/${encodeURIComponent(f.name)}`;
        const id = `${albumIdentifier}_${f.name}`;
        if (!reproducidas.has(id)) similares.push({
          id,
          name: f.name,
          artist: meta.metadata?.creator || track.artist || 'Desconocido',
          url,
          format: f.format || 'IA'
        });
      });
    } catch (err) {
      console.warn('autoQueue: error buscando IA', err);
    }
  }

  // Mezclar, dedup y tomar max
  const seen = new Set();
  const shuffled = similares.sort(() => Math.random() - 0.5)
    .filter(s => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    })
    .slice(0, max);

  // Agregar a la cola
  shuffled.forEach(s => addToQueue(s));
  return shuffled;
}

// Helper para usar en albumIA.js y mantener compatibilidad
export async function addSimilarTracksToQueue(track, albumIdentifier, max = 5) {
  const similares = await addSimilarTracks(track, albumIdentifier, max);
  return similares;
}
