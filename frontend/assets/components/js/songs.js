// songs.js
import { playSongByIndex } from './player.js';

export let songs = [];

export async function loadSongs(container) {
  try {
    const res = await fetch("/uploads/musica");
    songs = await res.json();
    container.innerHTML = '';

    if (!songs.length) {
      container.innerHTML = '<p>No hay canciones disponibles.</p>';
      return;
    }

    songs.forEach((song, index) => {
      const div = document.createElement('div');
      div.classList.add('song-card');

      const quality = [
        song.bit_depth ? `${song.bit_depth}-bit` : null,
        song.sample_rate ? `${(song.sample_rate / 1000).toFixed(1)} kHz` : null,
      ].filter(Boolean).join(" ") || "N/A";

      const explicitTag = song.explicit ? `<span class="explicit-tag">E</span>` : '';

      div.innerHTML = `
        <div class="cover-container">
          <img src="${song.portada || '/frontend/public/default_cover.png'}" alt="${song.titulo}">
          <div class="overlay">
            <button class="play-btn">▶</button>
          </div>
        </div>
        <p class="song-title">${song.titulo} ${explicitTag}</p>
        <p class="song-artist">${song.artista}</p>
        <p class="song-quality">${quality}</p>
      `;

      div.querySelector('.play-btn').addEventListener('click', () => playSongByIndex(index));
      container.appendChild(div);
    });

  } catch (err) {
    console.error(err);
    container.innerHTML = '<p>No se pudieron cargar canciones.</p>';
  }
}
