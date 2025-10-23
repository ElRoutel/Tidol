// player.js
import { songs } from './songs.js';

let currentIndex = -1;
let audio, coverImg, trackTitle, trackAlbum, trackArtist, trackQuality, playPauseBtn, playerContainer;

export function initPlayer(elements) {
  ({ audio, coverImg, trackTitle, trackAlbum, trackArtist, trackQuality, playPauseBtn, playerContainer } = elements);

  // Botón play/pause
  playPauseBtn.addEventListener('click', () => {
    if (audio.paused) { 
      audio.play(); 
      playPauseBtn.textContent = '⏸'; 
    } else { 
      audio.pause(); 
      playPauseBtn.textContent = '▶'; 
    }
  });

  // Siguiente/anterior
  document.getElementById('prev')?.addEventListener('click', () => {
    if (currentIndex > 0) playSongByIndex(currentIndex - 1);
  });
  document.getElementById('next')?.addEventListener('click', () => {
    if (currentIndex < songs.length - 1) playSongByIndex(currentIndex + 1);
  });

  // Ocultar player al terminar
  audio.addEventListener('ended', () => { playerContainer.style.display = 'none'; });
}

export function playSongByIndex(index) {
  if (index < 0 || index >= songs.length) return;
  currentIndex = index;
  playSong(songs[index]);
}

function playSong(song) {
  if (!song || !song.url) return;

  // Mostrar player
  playerContainer.style.display = 'flex';

  // Actualizar UI del player
  coverImg.src = song.portada || '/uploads/covers/default_cover.png';
  trackTitle.textContent = song.titulo;
  trackAlbum.textContent = song.album;
  trackArtist.textContent = song.artista;
  trackQuality.textContent = [
    song.bit_depth ? `${song.bit_depth}-bit` : null,
    song.sample_rate ? `${(song.sample_rate / 1000).toFixed(1)} kHz` : null,
  ].filter(Boolean).join(" ") || "N/A";

  // Actualizar título de la pestaña
  document.title = `${song.titulo} – ${song.artista} | Tidol`;

  // ===== Actualizar mini player iOS =====
  const portadaPath = song.portada ? song.portada : '/uploads/covers/default_cover.png';

  // 1️⃣ Apple touch icon
  let appleIcon = document.getElementById('apple-touch-icon');
  if (!appleIcon) {
    appleIcon = document.createElement('link');
    appleIcon.id = 'apple-touch-icon';
    appleIcon.rel = 'apple-touch-icon';
    document.head.appendChild(appleIcon);
  }
  appleIcon.href = portadaPath;

  // 2️⃣ Meta tag og:image (para mini player y compartidos)
  let ogImage = document.querySelector('meta[property="og:image"]');
  if (!ogImage) {
    ogImage = document.createElement('meta');
    ogImage.setAttribute('property', 'og:image');
    document.head.appendChild(ogImage);
  }
  ogImage.content = portadaPath;

  // 3️⃣ Habilitar web app en iOS si no existe
  let webAppMeta = document.querySelector('meta[name="apple-mobile-web-app-capable"]');
  if (!webAppMeta) {
    webAppMeta = document.createElement('meta');
    webAppMeta.name = "apple-mobile-web-app-capable";
    webAppMeta.content = "yes";
    document.head.appendChild(webAppMeta);
  }

  // Reproducir audio
  audio.pause();
  audio.src = encodeURI(song.url);
  audio.load();
  audio.play().then(() => playPauseBtn.textContent = '⏸')
    .catch(err => console.warn("Autoplay bloqueado", err));
}

