import { playSongByIndex } from './player.js';

export let songs = [];

export async function loadSongs(container) {
    if (!container) return; // ⚠️ prevenir errores en SPA
    try {
        const res = await fetch("/uploads/musica");
        songs = await res.json();
        container.innerHTML = '';

        if (!songs.length) {
            container.innerHTML = '<p>No hay canciones disponibles.</p>';
            return;
        }

        songs.forEach((song, index) => {
            const card = document.createElement('article');
            card.classList.add('card');

            const quality = [
                song.bit_depth ? `${song.bit_depth}-bit` : null,
                song.sample_rate ? `${(song.sample_rate / 1000).toFixed(1)} kHz` : null,
            ].filter(Boolean).join(" ") || "N/A";

            const explicitTag = song.explicit ? `<span class="explicit-tag">E</span>` : '';

            card.innerHTML = `
                <img class="cover" src="${song.portada || '/uploads/covers/default_cover.png'}" alt="${song.titulo}">
                <div class="overlay">
                    <button class="play-btn" aria-label="Reproducir">▶</button>
                </div>
                <div class="card-info">
                    <h3>${song.titulo} ${explicitTag}</h3>
                    <p>${song.artista}</p>
                    <p class="song-quality">${quality}</p>
                </div>
            `;

            card.querySelector('.play-btn')?.addEventListener('click', e => {
                e.stopPropagation();
                playSongByIndex(index);
            });

            card.addEventListener('click', () => playSongByIndex(index));

            container.appendChild(card);
        });

    } catch (err) {
        console.error(err);
        container.innerHTML = '<p>No se pudieron cargar canciones.</p>';
    }
}
