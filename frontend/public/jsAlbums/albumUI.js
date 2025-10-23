export function renderAlbumDetails(album) {
    const albumSection = document.getElementById("album-info");
    albumSection.innerHTML = `
        <div class="album-cover-container">
            <img src="${album.portada || 'img/default-cover.png'}" class="album-cover-large">
        </div>
        <div class="album-details">
            <h1>${album.titulo}</h1>
            <h2>${album.autor || 'Desconocido'}</h2>
            <p>Bitrate promedio: ${album.bit_rate ? Math.round(album.bit_rate / 1000) : 0} kbps</p>
        </div>
    `;
}

export function renderSongList(songs, playCallback) {
    const container = document.getElementById("songs-container");
    container.innerHTML = "";
    songs.forEach(song => {
        const li = document.createElement("li");
        li.classList.add("song-item");
        li.innerHTML = `
            <span class="song-title">${song.titulo}</span>
            <span class="song-artist">${song.autor}</span>
            <button class="play-btn" data-url="${song.url}">▶</button>
        `;
        li.querySelector(".play-btn").addEventListener("click", () => playCallback(song.url));
        container.appendChild(li);
    });
}
