// ===== Autenticación =====
const token = localStorage.getItem('token');
if (!token) {
    window.location.href = `login.html?redirect=albumes.html`;
}

// ===== Función para mostrar usuario =====
async function showUser() {
    try {
        const res = await fetch('/validate', { headers: { 'x-token': token } });
        if (!res.ok) throw new Error('Token inválido');
        const data = await res.json();
        document.getElementById('user-name').textContent = data.username;
    } catch (err) {
        console.error(err);
        localStorage.removeItem('token');
        window.location.href = `login.html?redirect=albumes.html`;
    }
}

// ===== Logout =====
function logout() {
    localStorage.removeItem('token');
    window.location.href = 'login.html';
}

// ===== Cargar álbumes desde la API =====
async function loadAlbums() {
    const container = document.getElementById("albums-container");
    container.innerHTML = "";

    try {
        const res = await fetch("/api/albums", { headers: { 'x-token': token } });
        const albums = await res.json();

        for (const album of albums) {
            const cover = album.portada && album.portada.trim() !== "" 
                ? album.portada 
                : "img/default-cover.png";

            let qualityText = "";
            try {
                const songsRes = await fetch(`/api/albums/${album.id}/canciones`, { headers: { 'x-token': token } });
                const songs = await songsRes.json();

                if (songs.length > 0) {
                    // Calcular calidad promedio o máxima
                    const maxSampleRate = Math.max(...songs.map(s => s.sample_rate || 44100));
                    const maxBitDepth = Math.max(...songs.map(s => s.bit_depth || 16));
                    qualityText = `${maxSampleRate/1000}Khz/${maxBitDepth}bit`;
                }
            } catch (err) {
                console.error("Error cargando canciones para álbum", album.id, err);
            }

            const card = document.createElement("div");
            card.classList.add("album-card");

            card.innerHTML = `
                <img src="${cover}" class="album-cover">
                <div class="album-info">
                    <h3>${album.titulo}</h3>
                    <p>${album.autor}</p>
                    ${qualityText ? `<p class="album-quality">${qualityText}</p>` : ''}
                </div>
            `;

            card.addEventListener("click", () => {
                window.location.href = `album.html?id=${album.id}`;
            });

            container.appendChild(card);
        }
    } catch (err) {
        console.error(err);
        container.innerHTML = "<p>Error cargando álbumes.</p>";
    }
}

// ===== Inicialización =====
document.addEventListener("DOMContentLoaded", () => {
    showUser();
    loadAlbums();
    document.getElementById('logout-btn')?.addEventListener('click', logout);
});
