import { songs } from './songs.js';

let currentIndex = -1;
let audio, coverImg, trackTitle, trackAlbum, trackArtist, trackQuality, playPauseBtn, playerContainer;

export function initPlayer(elements) {
    ({ audio, coverImg, trackTitle, trackAlbum, trackArtist, trackQuality, playPauseBtn, playerContainer } = elements);

    if (!audio || !playPauseBtn) return;

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
    audio.addEventListener('ended', () => { playerContainer?.style.setProperty('display','none'); });
}

export function playSongByIndex(index) {
    if (index < 0 || index >= songs.length) return;
    currentIndex = index;
    playSong(songs[index]);
}

function playSong(song) {
    if (!song || !song.url || !playerContainer) return;

    // Mostrar player
    playerContainer.style.display = 'flex';

    // Actualizar UI solo si los elementos existen
    if (coverImg) coverImg.src = song.portada || '/uploads/covers/default_cover.png';
    if (trackTitle) trackTitle.textContent = song.titulo;
    if (trackAlbum) trackAlbum.textContent = song.album;
    if (trackArtist) trackArtist.textContent = song.artista;
    if (trackQuality) trackQuality.textContent = [
        song.bit_depth ? `${song.bit_depth}-bit` : null,
        song.sample_rate ? `${(song.sample_rate / 1000).toFixed(1)} kHz` : null,
    ].filter(Boolean).join(" ") || "N/A";

    // Actualizar título de pestaña
    document.title = `${song.titulo} – ${song.artista} | Tidol`;

    // Reproducir audio
    audio.pause();
    audio.src = encodeURI(song.url);
    audio.load();
    audio.play().then(() => { if (playPauseBtn) playPauseBtn.textContent = '⏸'; })
        .catch(err => console.warn("Autoplay bloqueado", err));
}
