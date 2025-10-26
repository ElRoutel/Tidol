// main.js
import { showUser, logout } from './auth.js';
import { initVolumeControls } from './volume.js';
import { loadSongs, songs } from './songs.js';
import { initPlayer, playSongByIndex } from './player.js';
import { initProgress } from './progress.js';


// ===== ELEMENTOS DEL DOM =====
const audio = new Audio();
audio.preload = "metadata";

const elements = {
  audio,
  coverImg: document.getElementById('cover'),
  trackTitle: document.getElementById('track-title'),
  trackAlbum: document.getElementById('track-album'),
  trackArtist: document.getElementById('track-artist'),
  trackQuality: document.getElementById('track-quality'),
  playPauseBtn: document.getElementById('playPause'),
  playerContainer: document.querySelector('.player-container')
};

const songsContainer = document.getElementById('songs-container');
const volumeSlider = document.getElementById('volumeSlider');
const muteBtn = document.getElementById('mute');
const progressBar = document.getElementById('player');
const currentTimeEl = document.getElementById('currentTime');
const durationEl = document.getElementById('duration');

// ===== INICIALIZACIÓN =====
showUser();
document.getElementById('logout-btn').addEventListener('click', logout);

initVolumeControls(audio, volumeSlider, muteBtn);
initPlayer(elements);
initProgress(audio, progressBar, currentTimeEl, durationEl);

// ===== CARGA Y RENDER DE CANCIONES =====
async function init() {
  await loadSongs(songsContainer);

  // Asociar click a cada canción para reproducir y agregar a la cola
  songsContainer.querySelectorAll('.card').forEach((card, index) => {
    card.addEventListener('click', () => {
      const track = songs[index];
      playSongByIndex(index);           // Reproduce
      addToQueue(track);                // Agrega a la cola
    });

    card.querySelector('.play-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const track = songs[index];
      playSongByIndex(index);
      addToQueue(track);
    });
  });
}

// ===== EVENTO END DE CANCION =====
audio.addEventListener('ended', async () => {
  // Primero reproducir siguiente de la cola
  let siguiente = await reproducirSiguiente(audio);

  // Si no hay más, usar recomendación
  if (!siguiente) {
    const actual = {
      id: elements.audio.src,
      artist: elements.trackArtist.textContent
    };
    const recomendado = obtenerCancionSimilar(actual);
    if (recomendado) {
      addToQueue(recomendado);
      reproducirSiguiente(audio);
    } else {
      elements.playPauseBtn.textContent = "▶";
    }
  }
});

// Ejecutar init
init();
