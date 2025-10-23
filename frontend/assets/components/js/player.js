// player.js
import { songs } from './songs.js';

let currentIndex = -1;
let audio, coverImg, trackTitle, trackAlbum, trackArtist, trackQuality, playPauseBtn, playerContainer;

export function initPlayer(elements) {
  ({ audio, coverImg, trackTitle, trackAlbum, trackArtist, trackQuality, playPauseBtn, playerContainer } = elements);

  playPauseBtn.addEventListener('click', () => {
    if (audio.paused) { audio.play(); playPauseBtn.textContent = '⏸'; }
    else { audio.pause(); playPauseBtn.textContent = '▶'; }
  });

  document.getElementById('prev').addEventListener('click', () => {
    if (currentIndex > 0) playSongByIndex(currentIndex - 1);
  });
  document.getElementById('next').addEventListener('click', () => {
    if (currentIndex < songs.length - 1) playSongByIndex(currentIndex + 1);
  });

  audio.addEventListener('ended', () => { playerContainer.style.display = 'none'; });
}

export function playSongByIndex(index) {
  if (index < 0 || index >= songs.length) return;
  currentIndex = index;
  playSong(songs[index]);
}

function playSong(song) {
  if (!song || !song.url) return;

  playerContainer.style.display = 'flex';
  coverImg.src = song.portada || '/frontend/public/default_cover.png';
  trackTitle.textContent = song.titulo;
  trackAlbum.textContent = song.album;
  trackArtist.textContent = song.artista;
  trackQuality.textContent = [
    song.bit_depth ? `${song.bit_depth}-bit` : null,
    song.sample_rate ? `${(song.sample_rate / 1000).toFixed(1)} kHz` : null,
  ].filter(Boolean).join(" ") || "N/A";

  audio.pause();
  audio.src = encodeURI(song.url);
  audio.load();
  audio.play().then(() => playPauseBtn.textContent = '⏸')
    .catch(err => console.warn("Autoplay bloqueado", err));
}
