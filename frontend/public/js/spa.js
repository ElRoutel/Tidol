// /js/spa.js
const mainContent = document.getElementById("main-content");
const sidebarButtons = document.querySelectorAll(".sidebar-menu button[data-fragment]");
const logoutBtn = document.getElementById("logout-btn");
const userNameEl = document.getElementById("user-name");
const profilePicEl = document.getElementById("profile-pic");
const token = localStorage.getItem("token"); // o donde guardes el JWT

fetch("/api/me", {
  headers: {
    "Authorization": `Bearer ${token}`
  }
})
.then(res => res.json())
.then(user => {
  document.getElementById("user-name").textContent = user.nombre;
  if(user.profile_img) document.getElementById("profile-pic").src = user.profile_img;
})
.catch(err => console.error("Error cargando info del usuario:", err));

const DEV_ROLES = ["admin", "tester", "owner"];
let currentFragment = null;

// Obtener token de localStorage
function getToken() {
  return localStorage.getItem("token") || null;
}

// Guardar token
function saveToken(token) {
  localStorage.setItem("token", token);
}

// Limpiar token y redirigir
function logout() {
  localStorage.removeItem("token");
  location.href = "/login.html";
}

// Cargar fragmento protegido
async function loadFragment(name) {
  if (currentFragment === name) return;
  currentFragment = name;

  const token = getToken();
  if (!token) return logout();

  try {
    const res = await fetch(`/protected/fragments/${name}.html`, {
      headers: { "x-token": token },
    });

    if (res.status === 401 || res.status === 403) {
      return logout();
    }

    if (!res.ok) throw new Error("Error cargando fragmento");

    const html = await res.text();
    mainContent.innerHTML = html;
    window.scrollTo(0, 0);
  } catch (err) {
    console.error("SPA Load Error:", err);
    mainContent.innerHTML = `<p style="color:red;">No se pudo cargar el contenido.</p>`;
  }
}

// Inicializar sidebar
sidebarButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const fragment = btn.dataset.fragment;
    loadFragment(fragment);
  });
});

// Logout
logoutBtn.addEventListener("click", logout);

// Cargar fragmento inicial
function initSPA() {
  // Validar token y usuario
  const token = getToken();
  if (!token) return logout();

  fetch("/api/me", { headers: { "x-token": token } })
    .then(res => {
      if (!res.ok) throw new Error("Usuario no autorizado");
      return res.json();
    })
    .then(user => {
      userNameEl.textContent = user.nombre;
      if (user.profile_img) profilePicEl.src = user.profile_img;

      // Cargar fragmento inicial
      loadFragment("inicio_dev");
    })
    .catch(err => {
      console.error("Error usuario:", err);
      logout();
    });
}

// Inicializar SPA al cargar la página
document.addEventListener("DOMContentLoaded", initSPA);
