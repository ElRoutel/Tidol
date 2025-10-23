// Selección de secciones
const homeSection = document.getElementById("home");
const searchSection = document.getElementById("search");
const uploadSection = document.getElementById("upload"); // si luego agregas upload

// Menú
document.getElementById("menu-home").onclick = () => showSection(homeSection);
document.getElementById("menu-search").onclick = () => showSection(searchSection);

// Función para mostrar sección
function showSection(section) {
  homeSection.classList.add("hidden");
  searchSection.classList.add("hidden");
  uploadSection?.classList.add("hidden"); // opcional
  section.classList.remove("hidden");
}

// 🎵 Player
const player = document.getElementById("player");

// ----------------------
// Buscador
// ----------------------
const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");

searchInput.addEventListener("input", async () => {
  const query = searchInput.value.trim();
  if (!query) {
    searchResults.innerHTML = "";
    return;
  }

  try {
    const res = await fetch(`http://localhost:3000/canciones/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (data.error) {
      searchResults.innerHTML = `<p class="error">${data.error}</p>`;
      return;
    }

    searchResults.innerHTML = data.map(c => `
      <div class="song">
        <p><strong>${c.titulo}</strong> - ${c.artista || "Desconocido"}</p>
        <button onclick="playSong('${c.archivo}')">▶️ Reproducir</button>
      </div>
    `).join("");

  } catch (err) {
    console.error(err);
    searchResults.innerHTML = "<p class='error'>Error al buscar canciones</p>";
  }
});

// Reproducir canción
function playSong(filename) {
  player.src = `http://localhost:3000/uploads/${filename}`;
  player.play();
}

// ----------------------
// Subida de canciones
// ----------------------
const uploadForm = document.getElementById("uploadForm");
const uploadStatus = document.getElementById("uploadStatus");

if (uploadForm) {
  uploadForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData();
    const files = document.getElementById("songFile").files;
    const albumName = document.getElementById("albumName")?.value || "";

    if (!files.length) {
      uploadStatus.textContent = "❌ Selecciona al menos un archivo";
      return;
    }

    formData.append("songFile", files[0]); // por ahora solo uno a la vez
    formData.append("titulo", files[0].name.replace(/\.[^/.]+$/, "")); // nombre sin extensión
    formData.append("album", albumName);
    formData.append("artista", "Desconocido"); // puedes agregar input de artista luego

    try {
      const res = await fetch("http://localhost:3000/canciones/upload", {
        method: "POST",
        body: formData
      });

      const data = await res.json();
      if (data.error) {
        uploadStatus.textContent = `❌ ${data.error}`;
      } else {
        uploadStatus.textContent = `✅ ${data.message}`;
        uploadForm.reset();
      }
    } catch (err) {
      console.error(err);
      uploadStatus.textContent = "❌ Error al subir canción";
    }
  });
}
