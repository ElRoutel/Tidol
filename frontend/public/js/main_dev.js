// main_dev.js
import { initVolumeControls } from './volume.js';
import { initPlayer } from './player.js';
import { initProgress } from './progress.js';
import { fetchSongs, fetchArtists } from './songs.js'; // version dev

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

const devContent = document.getElementById('dev-content');
const volumeSlider = document.getElementById('volumeSlider');
const muteBtn = document.getElementById('mute');
const progressBar = document.getElementById('player');
const currentTimeEl = document.getElementById('currentTime');
const durationEl = document.getElementById('duration');

// ===== USUARIO Y LOGOUT =====
const token = localStorage.getItem('token');
if (!token) window.location.href = 'login.html?redirect=' + window.location.pathname.split('/').pop();

const userNameEl = document.getElementById('user-name');
const userData = JSON.parse(localStorage.getItem('user'));
if(userData) userNameEl.textContent = userData.username || 'Usuario';

document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
});

// ===== PLAYER =====
initVolumeControls(audio, volumeSlider, muteBtn);
initPlayer(elements);
initProgress(audio, progressBar, currentTimeEl, durationEl);

// ===== CARGA DE CONTENIDO DEV =====
async function loadDevPage() {
    const page = window.location.pathname.split('/').pop();

    // Página artistas
    if(page.includes('artistas_dev.html')){
        const artists = await fetchArtists(token);
        if(!artists || !artists.length){
            devContent.innerHTML = '<p>No hay artistas disponibles.</p>';
            return;
        }
        devContent.innerHTML = '';
        artists.forEach(artist => {
            const div = document.createElement('div');
            div.className = 'search-card';
            div.innerHTML = `
                <img src="${artist.imagen || '/img/default-artist.png'}" alt="${artist.nombre}" class="artist-photo">
                <span>${artist.nombre}</span>
                <small>${artist.albums} álbumes - ${artist.canciones} canciones</small>
            `;
            div.addEventListener('click', () => {
                window.location.href = `artista_dev.html?id=${artist.id}`;
            });
            devContent.appendChild(div);
        });
    }

    // Página canciones (index_dev.html u otra)
    if(page.includes('index_dev.html')){
        const songs = await fetchSongs(token);
        if(!songs || !songs.length){
            devContent.innerHTML = '<p>No hay canciones disponibles.</p>';
            return;
        }
        devContent.innerHTML = '';
        songs.forEach(song => {
            const div = document.createElement('div');
            div.className = 'song-card';
            div.innerHTML = `
                <span>${song.titulo} - ${song.artista}</span>
                <button onclick="playSong('${song.url}', '${song.titulo}', '${song.artista}', '${song.album}')">▶</button>
            `;
            devContent.appendChild(div);
        });
    }
}

// ===== FUNCIONES AUXILIARES =====
function playSong(url, titulo, artista, album){
    audio.src = url;
    audio.play();
    elements.trackTitle.textContent = titulo;
    elements.trackArtist.textContent = artista;
    elements.trackAlbum.textContent = album;
}

// ===== INICIO =====
document.addEventListener('DOMContentLoaded', loadDevPage);
