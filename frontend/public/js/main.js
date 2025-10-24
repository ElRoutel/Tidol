// ===== IMPORTS =====
import { showUser, logout } from './auth.js';
import { initVolumeControls } from './volume.js';
import { initPlayer } from './player.js';
import { initProgress } from './progress.js';
import { initRouter } from './router.js';

// ===== ELEMENTOS DEL PLAYER =====
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
  playerContainer: document.getElementById('player-container')
};

const volumeSlider = document.getElementById('volumeSlider');
const muteBtn = document.getElementById('mute');
const progressBar = document.getElementById('player');
const currentTimeEl = document.getElementById('currentTime');
const durationEl = document.getElementById('duration');

// ===== INICIALIZACIÓN =====
showUser(); // Bloquea acceso si no hay token
document.getElementById('logout-btn')?.addEventListener('click', logout);

initVolumeControls(audio, volumeSlider, muteBtn);
initPlayer(elements);
initProgress(audio, progressBar, currentTimeEl, durationEl);
initRouter(); // SPA router
