// playerControl.js
const audio = document.getElementById('audio');
const coverImg = document.getElementById('cover');
const trackTitle = document.getElementById('track-title');
const trackAlbum = document.getElementById('track-album');
const trackArtist = document.getElementById('track-artist');
const playPauseBtn = document.getElementById('playPause');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');
const progressBar = document.getElementById('player');
const currentTimeEl = document.getElementById('currentTime');
const durationEl = document.getElementById('duration');
const volumeSlider = document.getElementById('volumeSlider');
const muteBtn = document.getElementById('mute');

let tracks = [];
let currentTrackIndex = 0;

// ================== FUNCIONES ==================
async function loadTracks() {
  try {
    const res = await fetch("/uploads/musica");
    const data = await res.json();
    tracks = data.map(track => ({
      title: track.titulo,
      artist: track.artista,
      album: track.album,
      url: track.url,        // viene directo de tu DB
      cover: track.portada || '/default_cover.jpg'
    }));

    if(tracks.length) loadTrack(0, false);
  } catch (err) {
    console.error("Error cargando tracks:", err);
  }
}

function loadTrack(index, autoplay = false) {
  if(tracks.length === 0) return;

  if(index < 0) index = tracks.length - 1;
  if(index >= tracks.length) index = 0;
  currentTrackIndex = index;

  const track = tracks[currentTrackIndex];
  audio.src = track.url;
  coverImg.src = track.cover;
  trackTitle.textContent = track.title;
  trackAlbum.textContent = track.album;
  trackArtist.textContent = track.artist;

  if('mediaSession' in navigator){
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: track.album,
      artwork: [{ src: track.cover, sizes: '512x512', type: 'image/png' }]
    });
    navigator.mediaSession.setActionHandler('play', ()=>audio.play());
    navigator.mediaSession.setActionHandler('pause', ()=>audio.pause());
    navigator.mediaSession.setActionHandler('previoustrack', ()=>loadTrack(currentTrackIndex-1));
    navigator.mediaSession.setActionHandler('nexttrack', ()=>loadTrack(currentTrackIndex+1));
  }

  if(autoplay){
    audio.play().catch(() => {
      console.warn('Reproducción bloqueada hasta que el usuario interactúe.');
    });
  }
}

// ================== CONTROLES ==================
playPauseBtn.addEventListener('click', () => {
  if(audio.src !== tracks[currentTrackIndex]?.url) loadTrack(currentTrackIndex, false);
  audio.paused ? audio.play() : audio.pause();
});

prevBtn.addEventListener('click', () => loadTrack(currentTrackIndex-1, true));
nextBtn.addEventListener('click', () => loadTrack(currentTrackIndex+1, true));

audio.addEventListener('timeupdate', ()=>{
  const progress = (audio.currentTime/audio.duration)*100 || 0;
  progressBar.value = progress;
  currentTimeEl.textContent = `${Math.floor(audio.currentTime/60)}:${Math.floor(audio.currentTime%60).toString().padStart(2,'0')}`;
  durationEl.textContent = `${Math.floor(audio.duration/60)}:${Math.floor(audio.duration%60).toString().padStart(2,'0')}`;
});

progressBar.addEventListener('input', e=>{
  audio.currentTime = (e.target.value/100)*audio.duration;
});

volumeSlider.addEventListener('input', e=>{
  audio.volume = e.target.value;
});

muteBtn.addEventListener('click', e=>{
  audio.muted = !audio.muted;
  e.target.textContent = audio.muted ? '🔇' : '🔊';
});

