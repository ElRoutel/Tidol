// search.js - Versión mejorada con autoplay
import { agregarACola } from '/js/queue.js';

const token = localStorage.getItem('token') || '';
const input = document.getElementById('search-input');
const btn = document.getElementById('search-btn');
const resultsContainer = document.getElementById('search-results');
const progressEl = document.getElementById('search-progress');

btn.addEventListener('click', handleSearch);
input.addEventListener('keypress', e => { if(e.key === 'Enter') handleSearch(); });

async function handleSearch() {
  const query = input.value.trim();
  if(!query) return;

  resultsContainer.innerHTML = '<p class="loading">🔍 Buscando...</p>';
  progressEl.textContent = '';

  // 1️⃣ Resultados locales
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
      headers: { 'x-token': token }
    });
    const data = await res.json();
    renderLocalResults(data);
  } catch (err) {
    console.error('Error en búsqueda local:', err);
  }

  // 2️⃣ Resultados Internet Archive
  await buscarInternetArchive(query);
}

function renderLocalResults({ canciones = [], albums = [], artists = [] }) {
  resultsContainer.innerHTML = '';

  const renderGroup = (title, items, renderItem) => {
    if(!items.length) return;
    const h = document.createElement('h3'); 
    h.textContent = title;
    h.style.marginTop = '20px';
    resultsContainer.appendChild(h);
    const grid = document.createElement('div'); 
    grid.className = 'result-grid';
    items.forEach(item => grid.appendChild(renderItem(item)));
    resultsContainer.appendChild(grid);
  };

  renderGroup('🎤 Artistas (Locales)', artists, artista => 
    createCard(
      artista.nombre, 
      '', 
      'Artista', 
      artista.imagen, 
      () => location.href = `artista_dev.html?id=${artista.id}`,
      null,
      'local'
    )
  );
  
  renderGroup('💿 Álbumes (Locales)', albums, album => 
    createCard(
      album.titulo, 
      album.autor, 
      'Álbum', 
      album.portada, 
      () => location.href = `album_dev.html?id=${album.id}`,
      null,
      'local'
    )
  );
  
  renderGroup('🎵 Canciones (Locales)', canciones, song => 
    createCard(
      song.titulo, 
      song.artista, 
      song.formato?.toUpperCase() || 'LOCAL', 
      song.portada, 
      () => {
        agregarACola(song);
        mostrarNotificacion(`Añadido: ${song.titulo}`, 2000);
      },
      null,
      'local'
    )
  );
}

// ============================================
// FUNCIONES PARA MANEJAR AUTOPLAY
// ============================================

function abrirAlbumIA(identifier) {
  window.location.href = `/protected/albumIA.html?id=${identifier}`;
}

function reproducirAlbumIA(identifier, trackIndex = 0) {
  // SOLUCIÓN 2: Guardar intención de autoplay en localStorage
  localStorage.setItem('autoplay-pending', JSON.stringify({
    identifier: identifier,
    trackIndex: trackIndex,
    timestamp: Date.now()
  }));
  
  window.location.href = `/protected/albumIA.html?id=${identifier}`;
}

// ============================================
// CREAR CARD CON BOTÓN DE PLAY OVERLAY
// ============================================

function createCard(title, subtitle, tag, imgSrc, onClick, identifier = null, tipo = 'ia') {
  const div = document.createElement('div');
  div.classList.add('result-card');
  
  // Si es de IA, agregar botón de play overlay
  if (tipo === 'ia' && identifier) {
    div.innerHTML = `
      <div class="result-cover-wrapper">
        <img src="${imgSrc}" alt="${title}" class="result-img">
        <div class="play-overlay">
          <button class="play-overlay-btn" title="Reproducir ahora">
            <span class="play-icon">▶</span>
          </button>
        </div>
      </div>
      <div class="result-info">
        <h3>${title}</h3>
        <p>${subtitle}</p>
        <span class="format-tag">${tag}</span>
      </div>
    `;
    
    // Click en la card: abrir sin autoplay
    const coverWrapper = div.querySelector('.result-cover-wrapper');
    coverWrapper.addEventListener('click', (e) => {
      if (!e.target.closest('.play-overlay-btn')) {
        abrirAlbumIA(identifier);
      }
    });
    
    // Click en botón play: reproducir con autoplay
    const playBtn = div.querySelector('.play-overlay-btn');
    playBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      reproducirAlbumIA(identifier, 0);
    });
    
  } else {
    // Card normal (local o sin identifier)
    div.innerHTML = `
      <img src="${imgSrc}" alt="${title}" class="result-img">
      <div class="result-info">
        <h3>${title}</h3>
        <p>${subtitle}</p>
        <span class="format-tag">${tag}</span>
      </div>
    `;
    div.onclick = onClick;
  }
  
  return div;
}

// ============================================
// NOTIFICACIÓN VISUAL
// ============================================

function mostrarNotificacion(mensaje, duracion = 3000) {
  const notif = document.createElement('div');
  notif.className = 'search-notification';
  notif.textContent = mensaje;
  
  if (!document.querySelector('#notification-style')) {
    const style = document.createElement('style');
    style.id = 'notification-style';
    style.textContent = `
      .search-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        z-index: 9999;
        animation: slideInNotif 0.3s ease;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      }
      
      @keyframes slideInNotif {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      
      .result-cover-wrapper {
        position: relative;
        overflow: hidden;
        border-radius: 8px;
      }
      
      .result-cover-wrapper .result-img {
        width: 100%;
        height: auto;
        display: block;
        transition: filter 0.3s, transform 0.3s;
      }
      
      .play-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0);
        opacity: 0;
        transition: all 0.3s;
        pointer-events: none;
      }
      
      .result-cover-wrapper:hover .play-overlay {
        opacity: 1;
        background: rgba(0, 0, 0, 0.4);
        pointer-events: all;
      }
      
      .result-cover-wrapper:hover .result-img {
        filter: brightness(0.7);
        transform: scale(1.05);
      }
      
      .play-overlay-btn {
        background: rgba(29, 185, 84, 0.95);
        border: none;
        width: 70px;
        height: 70px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
        transform: scale(0.8);
      }
      
      .result-cover-wrapper:hover .play-overlay-btn {
        transform: scale(1);
      }
      
      .play-overlay-btn:hover {
        transform: scale(1.1) !important;
        background: rgba(29, 185, 84, 1);
        box-shadow: 0 6px 20px rgba(29, 185, 84, 0.6);
      }
      
      .play-overlay-btn:active {
        transform: scale(0.95) !important;
      }
      
      .play-icon {
        color: white;
        font-size: 28px;
        margin-left: 4px;
      }
      
      .search-card {
        cursor: pointer;
        transition: transform 0.2s;
      }
      
      .search-card:hover {
        transform: translateY(-5px);
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(notif);
  
  setTimeout(() => {
    notif.style.animation = 'slideInNotif 0.3s ease reverse';
    setTimeout(() => notif.remove(), 300);
  }, duracion);
}

// ===================== INTERNET ARCHIVE =====================
export async function buscarInternetArchive(query) {
  progressEl.textContent = '🌐 Buscando en Internet Archive...';

  const palabras = query.trim().split(/\s+/);
  const combinaciones = [];
  
  // Generar todas las combinaciones de palabras
  for (let i = 0; i < palabras.length; i++) {
    for (let j = i; j < palabras.length; j++) {
      combinaciones.push(palabras.slice(i, j + 1).join(' '));
    }
  }

  const formatos = ['mp3', 'flac', 'wav', 'm4a'];
  const todosResultados = [];
  let count = 0;

  // Buscar cada combinación en cada formato
  for (const combo of combinaciones) {
    count++;
    progressEl.textContent = `🔍 Buscando combinaciones (${count}/${combinaciones.length})...`;

    const keywords = `"${combo}"`;
    const fetches = formatos.map(f =>
      fetch(`https://archive.org/advancedsearch.php?q=(title:${keywords} OR creator:${keywords}) AND mediatype:audio AND format:${f}&fl[]=identifier,title,creator,format&sort[]=downloads+desc&rows=30&page=1&output=json`)
        .then(res => res.json())
        .then(data => data.response?.docs || [])
        .catch(err => {
          console.warn(`Error buscando formato ${f}:`, err);
          return [];
        })
    );

    const resultadosPorFormato = await Promise.all(fetches);
    todosResultados.push(...[].concat(...resultadosPorFormato));
  }

  // Eliminar duplicados y ordenar por relevancia
  const contador = {};
  todosResultados.forEach(item => contador[item.identifier] = (contador[item.identifier] || 0) + 1);
  
  const resultadosUnicos = Object.values(
    todosResultados.reduce((acc, item) => { 
      if (!acc[item.identifier]) acc[item.identifier] = item; 
      return acc; 
    }, {})
  );
  
  resultadosUnicos.sort((a, b) => contador[b.identifier] - contador[a.identifier]);
  
  // Limitar a 50 resultados para mejor performance
  const resultadosLimitados = resultadosUnicos.slice(0, 50);
  
  progressEl.textContent = '';

  if (!resultadosLimitados.length) { 
    resultsContainer.innerHTML += '<p class="no-results">❌ No se encontraron resultados en Internet Archive.</p>'; 
    return; 
  }

  const h = document.createElement('h3');
  h.textContent = `🌍 Internet Archive (${resultadosLimitados.length} resultados)`;
  h.style.marginTop = '30px';
  resultsContainer.appendChild(h);

  const grid = document.createElement('div');
  grid.className = 'result-grid';

  resultadosLimitados.forEach(item => {
    const ext = item.format ? item.format.join(', ') : 'Desconocido';
    const identifier = item.identifier;
    const card = createCard(
      item.title || 'Sin título',
      item.creator || 'Autor desconocido',
      ext,
      `https://archive.org/services/img/${identifier}`,
      null, // onClick se maneja internamente en createCard para IA
      identifier,
      'ia'
    );
    card.classList.add('search-card');
    grid.appendChild(card);
  });

  resultsContainer.appendChild(grid);
  
  // Mostrar notificación de resultados
  mostrarNotificacion(`✓ ${resultadosLimitados.length} álbumes encontrados`, 2000);
}

// ============================================
// FUNCIÓN AUXILIAR PARA BUSCAR SIMILARES
// ============================================

export async function fetchSimilarTracksFromIA(track) {
  if (!track) return [];
  
  const artist = track.artist || track.artista || '';
  if (!artist) return [];
  
  try {
    const query = `creator:"${artist}" AND mediatype:audio`;
    const searchUrl = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}&fl[]=identifier,title,creator&sort[]=downloads+desc&rows=5&page=1&output=json`;
    
    const response = await fetch(searchUrl);
    const data = await response.json();
    
    if (!data.response?.docs?.length) return [];
    
    const tracks = [];
    
    for (const doc of data.response.docs) {
      const identifier = doc.identifier;
      
      try {
        const metadataUrl = `https://archive.org/metadata/${identifier}`;
        const metaResponse = await fetch(metadataUrl);
        const metaData = await metaResponse.json();
        
        const audioFiles = Object.values(metaData.files || {})
          .filter(f => f.name.match(/\.(mp3|flac|wav|m4a|ogg)$/i))
          .slice(0, 2); // 2 tracks por álbum
        
        audioFiles.forEach(file => {
          tracks.push({
            name: file.name.split('/').pop().replace(/^\d+\.\s*/, ''),
            format: (file.format || 'unknown').replace('Audio', '').trim(),
            url: `https://archive.org/download/${identifier}/${encodeURIComponent(file.name)}`,
            artist: metaData.metadata?.creator || artist,
            album: metaData.metadata?.title || doc.title,
            id: `${identifier}_${file.name}`,
            cover: `https://archive.org/services/img/${identifier}`
          });
        });
        
        if (tracks.length >= 10) break;
      } catch (err) {
        console.warn('Error procesando álbum:', identifier, err);
      }
    }
    
    return tracks;
  } catch (err) {
    console.error('Error buscando tracks similares:', err);
    return [];
  }
}