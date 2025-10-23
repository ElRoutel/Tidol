// album.js
import { initPlayer, setPlaylist, playSongByIndex } from './albumPlayer.js';

const token = localStorage.getItem("token");
if (!token) window.location.href = "login.html?redirect=album.html";

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

// Mostrar usuario
async function showUser() {
  try {
    const res = await fetch("/validate", { headers: { "x-token": token } });
    if (!res.ok) throw new Error("Token inválido");
    const data = await res.json();
    document.getElementById("user-name").textContent = data.username;
  } catch {
    localStorage.removeItem("token");
    window.location.href = "login.html?redirect=album.html";
  }
}

// Logout
function logout() {
  localStorage.removeItem("token");
  window.location.href = "login.html";
}

// Obtener ID del álbum desde URL
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

function renderAlbumDetails(album) {
    const infoEl = document.getElementById("album-info");

    // Renderizamos el HTML del banner
    infoEl.innerHTML = `
        <section class="album-banner">
            <img id="banner-cover" src="${album.portada || '/default_cover.png'}" alt="Portada del álbum">
            <div class="album-info-overlay">
                <h1>${album.titulo}</h1>
                <p>${album.autor || 'Desconocido'}</p>
                
            </div>
        </section>
    `;

    // Opcional: si quieres actualizar dinámicamente más adelante
    const bannerImg = infoEl.querySelector("#banner-cover");
    const overlayTitle = infoEl.querySelector(".album-info-overlay h1");
    const overlayArtist = infoEl.querySelector(".album-info-overlay p");

    // Actualización dinámica (por si recargas datos)
    bannerImg.src = album.portada || '/default_cover.png';
    overlayTitle.textContent = album.titulo;
    overlayArtist.textContent = album.autor || 'Desconocido';
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

    // Conectar lista con player
    setPlaylist(songs);
// Reproducir canción si viene en la URL
const urlParams = new URLSearchParams(window.location.search);
const songId = urlParams.get("song");

if (songId) {
  const index = songs.findIndex(s => s.id == songId);
  if (index !== -1) {
    // Reproduce la canción exacta
    playSongByIndex(index);
  }
}

    songsContainer.innerHTML = "";
    songs.forEach((song, index) => {
      const card = document.createElement('article');
      card.className = "card";

      // Validar campos por si vienen null
      const sample_rate = song.sample_rate || 'test'
      const titulo = song.titulo || 'Sin título';
      const autor = song.autor || 'Desconocido';
      const portada = song.portada || '/default_cover.png';

      card.innerHTML = `
        <img class="cover" src="${portada}" alt="Portada">
        <div class="overlay"><button class="play-btn">▶</button></div>
        <div class="card-info">
          <h3>${titulo}</h3>
          <p>${song.artista}</p>
          <p>${song.album || 'Desconocido'}</p>
          <p>${sample_rate/1000}Khz/${song.bit_depth}bit</p>
        </div>
      `;

      // Play al click en botón o card
      card.querySelector('.play-btn').addEventListener('click', () => playSongByIndex(index));
      card.addEventListener('click', () => playSongByIndex(index));

      songsContainer.appendChild(card);
    });

  } catch (err) {
    console.error(err);
    songsContainer.innerHTML = "<p>Error cargando canciones</p>";
  }
}
// albumPlayer.js

// Inicialización
document.addEventListener("DOMContentLoaded", () => {
  showUser();
  loadAlbum();
  document.getElementById("logout-btn")?.addEventListener("click", logout);
});
