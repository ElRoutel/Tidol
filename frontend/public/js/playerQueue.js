// playerQueue.js
import { addToQueue, obtenerCancionSimilar, reproducirSiguiente } from '/js/queue.js';
import { tracks } from './songs.js'; // O donde tengas tus canciones cargadas

let currentTrack = null;

export async function playTrackWithQueue(track, player) {
  currentTrack = track;

  // Reproducir
  player.src = track.url;
  await player.play();

  // Agregar a la cola si no está
  addToQueue(track);

  // Evento al terminar
  player.onended = async () => {
    let nextTrack = obtenerCancionSimilar(track);
    
    // Si no hay canciones similares, recarga de la lista actual
    if (!nextTrack && tracks && tracks.length) {
      const unplayed = tracks.filter(t => t.url !== track.url); // Evita repetir la actual
      if (unplayed.length) {
        const index = Math.floor(Math.random() * unplayed.length);
        nextTrack = unplayed[index];
        addToQueue(nextTrack);
      }
    }

    if (nextTrack) {
      playTrackWithQueue(nextTrack, player);
    } else {
      console.log("No hay más canciones en la cola ni recomendadas.");
    }
  };
}
