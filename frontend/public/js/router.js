import { loadSongs } from './songs.js';
import { reloadScripts } from './utils/dom.js';

export function initRouter() {
  const app = document.getElementById('app-content');

  // Cargar la vista inicial según URL
window.addEventListener('DOMContentLoaded', () => {
  loadView('home', false); // siempre carga la vista parcial home.html
});


  // Manejar clicks del sidebar
  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const view = btn.getAttribute('data-view');
      await loadView(view, true);
    });
  });

  // Botón atrás/adelante del navegador
  window.onpopstate = (e) => {
    const view = e.state?.view || 'home';
    loadView(view, false);
  };

  // Función para cargar vistas
  async function loadView(view, push = true) {
    try {
      const res = await fetch(`/protected/views/${view}.html`);
      if (!res.ok) throw new Error(`Vista ${view} no encontrada`);

      const html = await res.text();
      app.innerHTML = html;

      // Volver a ejecutar scripts de la vista
      await reloadScripts(app);

      // Cargar canciones si existe container
      const songsContainer = document.getElementById('songs-container');
      if (songsContainer) loadSongs(songsContainer);

      if (push) history.pushState({ view }, "", `/app/${view}`);
    } catch (err) {
      app.innerHTML = `<p style="color:red;">Error cargando ${view}</p>`;
      console.error(err);
    }
  }
}
