// album.js
import { initPlayer, setPlaylist, playSongByIndex } from './albumPlayer.js';

const token = localStorage.getItem("token");
if (!token) window.location.href = "login.html?redirect=album_dev.html";

// Inicializar player con elementos del footer
initPlayer({
  coverEl: document.getElementById("cover"),
  titleEl: document.getElementById("track-title"),
  artistEl: document.getElementById("track-artist"),
  albumEl: document.getElementById("track-album"),
  qualityEl: document.getElementById("track-quality"),
  playBtn: document.getElementById("playPause"),
  progressEl: document.getElementById("progress-bar"),
  playerContainer: document.querySelector(".player-container"),
  volumeSlider: document.getElementById("volumeSlider"),
  muteBtn: document.getElementById("mute"),
  currentTimeEl: document.getElementById("currentTime"),
  durationEl: document.getElementById("duration")
});

// ----------------------
// Funciones de usuario
// ----------------------
async function showUser() {
  try {
    const res = await fetch("/validate", { headers: { "x-token": token } });
    if (!res.ok) throw new Error("Token inválido");
    const data = await res.json();
    document.getElementById("user-name").textContent = data.username;
  } catch {
    localStorage.removeItem("token");
    window.location.href = "login.html?redirect=album_dev.html";
  }
}

function logout() {
  localStorage.removeItem("token");
  window.location.href = "login.html";
}

// ----------------------
// Obtener ID del álbum desde URL
// ----------------------
function getAlbumId() {
  return new URLSearchParams(window.location.search).get("id");
}

// ----------------------
// Cargar álbum y canciones
// ----------------------
async function loadAlbum() {
  const albumId = getAlbumId();
  if (!albumId) {
    document.getElementById("album-info").innerHTML = "<p>Álbum no encontrado.</p>";
    return;
  }

  try {
    // Datos del álbum
    const res = await fetch(`/api/albums/${albumId}`, { headers: { "x-token": token } });
    if (!res.ok) throw new Error("No se pudo cargar el álbum");
    const album = await res.json();

    renderAlbumDetails(album);
    await loadSongs(albumId);
  } catch (err) {
    console.error(err);
    document.getElementById("album-info").innerHTML = "<p>Error cargando el álbum.</p>";
  }
}

// Renderiza banner del álbum
function renderAlbumDetails(album) {
  const infoEl = document.getElementById("album-info");
  infoEl.innerHTML = `
    <section class="album-banner">
      <img id="banner-cover" src="${album.portada || '/default_cover.png'}" alt="Portada del álbum">
      <div class="album-info-overlay">
        <h1>${album.titulo}</h1>
        <p>${album.autor || 'Desconocido'}</p>
      </div>
    </section>
  `;
}

// ----------------------
// Cargar canciones y mostrarlas
// ----------------------
async function loadSongs(albumId) {
  const songsContainer = document.getElementById('songs-container');
  try {
    const res = await fetch(`/api/albums/${albumId}/canciones`, { headers: { "x-token": token } });
    if (!res.ok) throw new Error("No se pudieron cargar las canciones");
    const songs = await res.json();

    setPlaylist(songs);

    // Reproducir canción si viene en la URL
    const songId = new URLSearchParams(window.location.search).get("song");
    if (songId) {
      const index = songs.findIndex(s => s.id == songId);
      if (index !== -1) playSongByIndex(index);
    }

    songsContainer.innerHTML = "";
    songs.forEach((song, index) => {
      const card = document.createElement('article');
      card.className = "card";

      const titulo = song.titulo || 'Sin título';
      const autor = song.artista || 'Desconocido';
      const album = song.album || 'Desconocido';
      const portada = song.portada || '/default_cover.png';
      const sample_rate = song.sample_rate ? song.sample_rate/1000+'Khz' : 'Desconocido';
      const bit_depth = song.bit_depth || 'Desconocido';

      card.innerHTML = `
        <img class="cover" src="${portada}" alt="Portada">
        <div class="overlay"><button class="play-btn">▶</button></div>
        <div class="card-info">
          <h3>${titulo}</h3>
          <p>${autor}</p>
          <p>${album}</p>
          <p>${sample_rate}/${bit_depth}bit</p>
        </div>
      `;

      card.querySelector('.play-btn').addEventListener('click', () => playSongByIndex(index));
      card.addEventListener('click', () => playSongByIndex(index));

      songsContainer.appendChild(card);
    });

  } catch (err) {
    console.error(err);
    songsContainer.innerHTML = "<p>Error cargando canciones</p>";
  }
}

// ----------------------
// Inicialización
// ----------------------
document.addEventListener("DOMContentLoaded", () => {
  showUser();
  loadAlbum();
  document.getElementById("logout-btn")?.addEventListener("click", logout);
});
