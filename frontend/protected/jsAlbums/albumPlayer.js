// albumPlayer.js

let audio = document.getElementById("audio-player");
let currentPlaylist = [];
let currentIndex = 0;

// Elementos UI
let coverEl, titleEl, artistEl, albumEl, qualityEl, playBtn, progressEl, playerContainer, volumeSlider, muteBtn, currentTimeEl, durationEl;

// Inicializar player con elementos del footer
export function initPlayer(elements) {
  ({
    coverEl, titleEl, artistEl, albumEl, qualityEl, playBtn, progressEl, playerContainer, volumeSlider, muteBtn, currentTimeEl, durationEl
  } = elements);

  // Botón play/pause
  playBtn.addEventListener("click", () => {
    if (audio.paused) audio.play();
    else audio.pause();
  });

  // Prev / Next
  document.getElementById("prev").addEventListener("click", playPrev);
  document.getElementById("next").addEventListener("click", playNext);

  // Mute y volumen
  muteBtn.addEventListener("click", () => {
    audio.muted = !audio.muted;
    muteBtn.textContent = audio.muted ? "🔇" : "🔊";
  });

  volumeSlider.addEventListener("input", () => {
    audio.volume = volumeSlider.value;
  });

  // Barra de progreso
  audio.addEventListener("timeupdate", updateProgress);
  progressEl.addEventListener("input", () => {
    if(audio.duration) audio.currentTime = (progressEl.value / 100) * audio.duration;
  });

  // Actualizar botones play/pause
  audio.addEventListener("play", () => playBtn.textContent = "⏸");
  audio.addEventListener("pause", () => playBtn.textContent = "▶");

  // Fin de canción
  audio.addEventListener("ended", playNext);
}

// Conectar lista de canciones
export function setPlaylist(songs) {
  currentPlaylist = songs;
  currentIndex = 0;
}

// Reproducir canción por índice
export function playSongByIndex(index) {
  if(index < 0 || index >= currentPlaylist.length) return;
  currentIndex = index;
  const song = currentPlaylist[index];
  playSong(song);
}

// Reproducir canción
function playSong(song) {
  if (!song || !song.url) return;

  playerContainer.classList.add("show");

  coverEl.src = song.portada || '/default_cover.png';
  titleEl.textContent = song.titulo;
  artistEl.textContent = song.artista || '';
  albumEl.textContent = song.album || 'Aqui va el album xd';
  qualityEl.textContent = [
    song.bit_depth ? `${song.bit_depth}-bit /` : null,
    song.sample_rate ? `${(song.sample_rate / 1000).toFixed(1)} kHz` : null,
  ].filter(Boolean).join(" ") || "N/A";


  audio.src = song.url;
  audio.load();
  audio.play().catch(err => console.warn("Autoplay bloqueado", err));
}

// Siguiente canción
function playNext() {
  if(currentIndex < currentPlaylist.length - 1) currentIndex++;
  else currentIndex = 0; // loop
  playSong(currentPlaylist[currentIndex]);
}

// Canción anterior
function playPrev() {
  if(currentIndex > 0) currentIndex--;
  else currentIndex = currentPlaylist.length - 1;
  playSong(currentPlaylist[currentIndex]);
}

// Actualizar barra de progreso y tiempo
function updateProgress() {
  if(!audio.duration) return;
  const progressPercent = (audio.currentTime / audio.duration) * 100;
  progressEl.value = progressPercent;

  if(currentTimeEl) currentTimeEl.textContent = formatTime(audio.currentTime);
  if(durationEl) durationEl.textContent = formatTime(audio.duration);
}

// Formatear segundos a mm:ss
function formatTime(time) {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds < 10 ? '0'+seconds : seconds}`;
}
