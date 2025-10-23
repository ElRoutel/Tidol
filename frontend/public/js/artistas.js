// ===== Autenticación =====
const token = localStorage.getItem('token');
if (!token) {
  window.location.href = `login.html?redirect=artistas.html`;
}

// ===== Cargar artistas desde la API =====
async function loadArtists() {
  const container = document.getElementById("artists-container");
  container.innerHTML = "";

  try {
    const res = await fetch("/api/artists", { headers: { "x-token": token } });
    const artists = await res.json();

    artists.forEach(artist => {
      const photo = artist.foto && artist.foto.trim() !== ""
        ? artist.foto
        : "img/default-artist.png";

      const card = document.createElement("div");
      card.classList.add("artist-card");

      card.innerHTML = `
        <img src="${photo}" alt="${artist.nombre}" class="artist-photo">
        <h3>${artist.nombre}</h3>
      `;

      card.addEventListener("click", () => {
        window.location.href = `artist.html?id=${artist.id}`;
      });

      container.appendChild(card);
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = "<p>Error cargando artistas.</p>";
  }
}

// ===== Inicialización =====
document.addEventListener("DOMContentLoaded", () => {
  loadArtists();
});
