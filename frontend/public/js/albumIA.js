import { addToQueue, obtenerCancionSimilar, cola, reproducidas, agregarACola } from '/js/queue.js';

const params = new URLSearchParams(window.location.search);
const identifier = params.get('id');

const albumTitleEl = document.getElementById('album-title');
const albumCreatorEl = document.getElementById('album-creator');
const albumCoverEl = document.getElementById('album-cover');
const tracksListEl = document.getElementById('tracks-list');
const filterFormatEl = document.getElementById('filter-format');
const filterNameEl = document.getElementById('filter-name');

const audio = document.getElementById('audio-player');
const progress = document.getElementById('player-progress');
const volumeSlider = document.getElementById('player-volume');
const titleEl = document.getElementById('player-title');
const albumEl = document.getElementById('player-album');
const artistEl = document.getElementById('player-artist');
const coverEl = document.getElementById('player-cover');
const formatEl = document.getElementById('player-format');
const playBtn = document.getElementById('player-playPause');
const nextBtn = document.getElementById('player-next');
const prevBtn = document.getElementById('player-prev');
const muteBtn = document.getElementById('player-mute');
const currentTimeEl = document.getElementById('player-currentTime');
const durationEl = document.getElementById('player-duration');
const playerContainer = document.querySelector('.player-container');

let tracks = [];
let currentPlaylist = [];
let currentIndex = 0;
let lastTrack = null;
let buscandoSimilares = false;
let currentAlbumIdentifier = identifier; // Guardar el identifier actual

// SOLUCIÓN 2: Detectar autoplay desde localStorage
let shouldAutoplay = false;
let autoplayTrackIndex = 0;

const autoplayData = localStorage.getItem('autoplay-pending');
if (autoplayData) {
  try {
    const data = JSON.parse(autoplayData);
    const age = Date.now() - data.timestamp;
    
    // Solo si es reciente (menos de 5 segundos) y es el mismo álbum
    if (age < 5000 && data.identifier === identifier) {
      shouldAutoplay = true;
      autoplayTrackIndex = data.trackIndex || 0;
    }
    
    // Limpiar después de leer
    localStorage.removeItem('autoplay-pending');
  } catch (err) {
    console.error('Error parsing autoplay data:', err);
  }
}

// ============================================
// FUNCIÓN PARA ACTUALIZAR URL DINÁMICAMENTE
// ============================================

function actualizarURLSiEsNecesario(track) {
  if (!track || !track.id) return;
  
  // Extraer el identifier del track.id (formato: "identifier_filename")
  const nuevoIdentifier = track.id.split('_')[0];
  
  // Solo actualizar si cambió de álbum
  if (nuevoIdentifier && nuevoIdentifier !== currentAlbumIdentifier) {
    currentAlbumIdentifier = nuevoIdentifier;
    
    // Actualizar URL sin recargar la página
    const nuevaURL = `/protected/albumIA.html?id=${nuevoIdentifier}`;
    window.history.pushState({ identifier: nuevoIdentifier }, '', nuevaURL);
    
    console.log(`📝 URL actualizada a: ${nuevoIdentifier}`);
    
    // Actualizar metadatos del álbum en la interfaz
    actualizarMetadatosAlbum(track);
  }
}

// Actualizar la información del álbum en la UI cuando cambia
async function actualizarMetadatosAlbum(track) {
  if (!track.album && !track.cover) return;
  
  // Mostrar notificación de cambio de álbum
  mostrarNotificacion(`🎵 Ahora reproduciendo: ${track.album || 'Nuevo álbum'}`, 3000);
  
  // Actualizar título y portada del álbum
  if (track.album) {
    albumTitleEl.textContent = track.album;
  }
  if (track.artist) {
    albumCreatorEl.textContent = track.artist;
  }
  if (track.cover) {
    albumCoverEl.src = track.cover;
  }
  
  // Opcional: Cargar los tracks del nuevo álbum
  const nuevoIdentifier = track.id.split('_')[0];
  if (nuevoIdentifier && nuevoIdentifier !== identifier) {
    try {
      const response = await fetch(`https://archive.org/metadata/${nuevoIdentifier}`);
      const data = await response.json();
      
      // Actualizar tracks del nuevo álbum (sin reemplazar la reproducción actual)
      const nuevosTracks = Object.values(data.files || {})
        .filter(f => f.name.match(/\.(mp3|flac|wav|m4a|ogg)$/i))
        .map(f => ({
          name: cleanTrackName(f.name),
          format: (f.format || 'unknown').replace('Audio', '').trim(),
          url: `https://archive.org/download/${nuevoIdentifier}/${encodeURIComponent(f.name)}`,
          artist: data.metadata?.creator || track.artist,
          album: data.metadata?.title || track.album,
          id: `${nuevoIdentifier}_${f.name}`,
          cover: `https://archive.org/services/img/${nuevoIdentifier}`
        }));
      
      // Actualizar la lista de tracks (opcional: comentar si no quieres esto)
      tracks = nuevosTracks;
      renderTracks();
      
      console.log(`✅ Álbum actualizado: ${data.metadata?.title || nuevoIdentifier}`);
    } catch (err) {
      console.warn('Error al cargar metadata del nuevo álbum:', err);
    }
  }
}

// Manejar navegación hacia atrás/adelante del navegador
window.addEventListener('popstate', (event) => {
  if (event.state && event.state.identifier) {
    // Usuario presionó atrás/adelante
    console.log('Navegación detectada:', event.state.identifier);
    
    // Opcional: recargar la página con el nuevo identifier
    // O actualizar la interfaz sin recargar
    location.reload();
  }
});

function formatTime(seconds) {
  if (isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function cleanTrackName(fileName) {
  let name = fileName;
  if (name.includes('/')) name = name.split('/').pop();
  return name.replace(/^\d+\.\s*/, '');
}

// SOLUCIÓN 4: Función para mostrar notificación
function mostrarNotificacion(mensaje, duracion = 3000) {
  const notif = document.createElement('div');
  notif.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 15px 25px;
    border-radius: 8px;
    z-index: 9999;
    animation: slideIn 0.3s ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  `;
  notif.textContent = mensaje;
  
  if (!document.querySelector('#notification-style')) {
    const style = document.createElement('style');
    style.id = 'notification-style';
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(notif);
  
  setTimeout(() => {
    notif.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => notif.remove(), 300);
  }, duracion);
}

// SOLUCIÓN 4: Mostrar overlay si autoplay está bloqueado
function mostrarBotonAutoplayBloqueado(trackIndex) {
  const overlay = document.createElement('div');
  overlay.id = 'autoplay-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.95);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    backdrop-filter: blur(10px);
    animation: fadeIn 0.3s ease;
  `;
  
  if (!document.querySelector('#overlay-style')) {
    const style = document.createElement('style');
    style.id = 'overlay-style';
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }
    `;
    document.head.appendChild(style);
  }
  
  overlay.innerHTML = `
    <div style="text-align: center; color: white; max-width: 400px; padding: 20px;">
      <div style="font-size: 80px; margin-bottom: 20px; animation: pulse 2s infinite;">🎵</div>
      <h2 style="margin-bottom: 10px; font-size: 28px;">Listo para reproducir</h2>
      <p style="margin-bottom: 30px; opacity: 0.8; font-size: 16px;">
        ${albumTitleEl.textContent || 'Álbum cargado'}
      </p>
      <button id="start-playback-btn" style="
        background: linear-gradient(135deg, #1db954 0%, #1ed760 100%);
        color: white;
        border: none;
        padding: 18px 50px;
        font-size: 18px;
        border-radius: 50px;
        cursor: pointer;
        font-weight: bold;
        box-shadow: 0 8px 20px rgba(29, 185, 84, 0.4);
        transition: all 0.3s;
        text-transform: uppercase;
        letter-spacing: 1px;
      ">
        ▶ Reproducir Ahora
      </button>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  const btn = document.getElementById('start-playback-btn');
  btn.addEventListener('mouseenter', () => {
    btn.style.transform = 'scale(1.05) translateY(-2px)';
    btn.style.boxShadow = '0 12px 30px rgba(29, 185, 84, 0.6)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.transform = 'scale(1) translateY(0)';
    btn.style.boxShadow = '0 8px 20px rgba(29, 185, 84, 0.4)';
  });
  
  btn.addEventListener('click', async () => {
    overlay.style.animation = 'fadeIn 0.3s ease reverse';
    setTimeout(() => overlay.remove(), 300);
    await playTrack(trackIndex);
    mostrarNotificacion('¡Reproduciendo! 🎶', 2000);
  });
  
  // También permitir click en el overlay para cerrar
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.style.animation = 'fadeIn 0.3s ease reverse';
      setTimeout(() => overlay.remove(), 300);
    }
  });
}

function renderTracks() {
  tracksListEl.innerHTML = '';
  const formatFilter = filterFormatEl.value;
  const nameFilter = filterNameEl.value.toLowerCase().trim();
  
  currentPlaylist = tracks.filter(track => {
    const nameMatch = !nameFilter || track.name.toLowerCase().includes(nameFilter);
    const formatMatch = !formatFilter || track.name.toLowerCase().endsWith(formatFilter);
    return nameMatch && formatMatch;
  });
  
  if (!currentPlaylist.length) {
    tracksListEl.innerHTML = '<p>No se encontraron canciones.</p>';
    return;
  }
  
  currentPlaylist.forEach((track, index) => {
    const row = document.createElement('div');
    row.className = 'track-row';
    row.innerHTML = `
      <div class="track-play">
        <span class="track-number">${index + 1}</span>
        <button class="play-icon">▶</button>
      </div>
      <div class="track-info">
        <h3>${track.name}</h3>
        <p>${albumCreatorEl.textContent}</p>
      </div>
      <div class="track-format">${track.format.toUpperCase()}</div>
      <div class="track-duration">--:--</div>
    `;
    row.addEventListener('click', e => {
      if (e.target.tagName.toLowerCase() !== 'button') {
        playTrack(index);
      }
    });
    row.querySelector('.play-icon').addEventListener('click', e => {
      e.stopPropagation();
      playTrack(index);
    });
    tracksListEl.appendChild(row);
  });
}

// Buscar tracks similares en Internet Archive
async function buscarTracksSimilaresIA(track) {
  if (!track || buscandoSimilares) return [];
  
  buscandoSimilares = true;
  const nuevosTracks = [];
  
  try {
    const artist = track.artist || albumCreatorEl.textContent;
    
    // Construir query de búsqueda en IA
    const queries = [
      `creator:"${artist}" AND mediatype:audio`,
      `${artist} AND mediatype:audio`,
      `subject:"${artist}" AND mediatype:audio`
    ];
    
    for (const query of queries) {
      try {
        const searchUrl = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}&fl[]=identifier,title,creator&sort[]=downloads+desc&rows=10&page=1&output=json`;
        const response = await fetch(searchUrl);
        const data = await response.json();
        
        if (data.response?.docs?.length > 0) {
          for (const doc of data.response.docs) {
            const id = doc.identifier;
            
            // Evitar el álbum actual
            if (id === identifier) continue;
            
            try {
              const metadataUrl = `https://archive.org/metadata/${id}`;
              const metaResponse = await fetch(metadataUrl);
              const metaData = await metaResponse.json();
              
              const audioFiles = Object.values(metaData.files || {})
                .filter(f => f.name.match(/\.(mp3|flac|wav|m4a|ogg)$/i))
                .slice(0, 3);
              
              for (const file of audioFiles) {
                const trackId = `${id}_${file.name}`;
                
                if (reproducidas.has(trackId)) continue;
                
                const newTrack = {
                  name: cleanTrackName(file.name),
                  format: (file.format || 'unknown').replace('Audio', '').trim(),
                  url: `https://archive.org/download/${id}/${encodeURIComponent(file.name)}`,
                  artist: metaData.metadata?.creator || artist,
                  album: metaData.metadata?.title || doc.title,
                  id: trackId,
                  cover: `https://archive.org/services/img/${id}`
                };
                
                nuevosTracks.push(newTrack);
                
                if (nuevosTracks.length >= 10) break;
              }
              
              if (nuevosTracks.length >= 10) break;
            } catch (err) {
              console.warn('Error al procesar álbum:', id, err);
            }
          }
          
          if (nuevosTracks.length >= 5) break;
        }
      } catch (err) {
        console.warn('Error en búsqueda:', query, err);
      }
    }
  } catch (err) {
    console.error('Error buscando tracks similares:', err);
  } finally {
    buscandoSimilares = false;
  }
  
  return nuevosTracks;
}

async function reproducirTrack(track) {
  if (!track) return;
  
  lastTrack = track;
  addToQueue(track);
  
  // ACTUALIZAR URL SI EL TRACK ES DE OTRO ÁLBUM
  actualizarURLSiEsNecesario(track);
  
  audio.src = track.url;
  await audio.play().catch(err => console.warn('play() bloqueado', err));
  
  titleEl.textContent = track.name;
  albumEl.textContent = track.album || albumTitleEl.textContent;
  artistEl.textContent = track.artist || albumCreatorEl.textContent;
  formatEl.textContent = track.format.toUpperCase();
  coverEl.src = track.cover || albumCoverEl.src;
  playBtn.textContent = '⏸';
  document.title = `${track.name} – ${track.album || albumTitleEl.textContent}`;
  
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.name,
      artist: track.artist || albumCreatorEl.textContent,
      album: track.album || albumTitleEl.textContent,
      artwork: [
        { src: track.cover || albumCoverEl.src, sizes: '512x512', type: 'image/png' },
        { src: track.cover || albumCoverEl.src, sizes: '256x256', type: 'image/png' }
      ]
    });
    navigator.mediaSession.setActionHandler('play', () => audio.play());
    navigator.mediaSession.setActionHandler('pause', () => audio.pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      if (currentIndex > 0) playTrack(currentIndex - 1);
    });
    navigator.mediaSession.setActionHandler('nexttrack', async () => {
      await reproducirSiguiente();
    });
  }
  
  // Buscar similares de forma anticipada si la cola está baja
  if (cola.length < 3) {
    buscarTracksSimilaresIA(track).then(tracks => {
      tracks.forEach(t => agregarACola(t));
    });
  }
}

async function playTrack(index) {
  if (index < 0 || index >= currentPlaylist.length) return;
  currentIndex = index;
  await reproducirTrack(currentPlaylist[index]);
}

// SOLUCIÓN 3 y 4: Intentar autoplay con fallback
async function intentarAutoplay(trackIndex = 0) {
  try {
    await playTrack(trackIndex);
    mostrarNotificacion('Reproduciendo automáticamente 🎵', 2000);
  } catch (err) {
    console.warn('Autoplay bloqueado por el navegador:', err);
    mostrarBotonAutoplayBloqueado(trackIndex);
  }
}

async function reproducirSiguiente() {
  if (currentIndex < currentPlaylist.length - 1) {
    currentIndex++;
    await reproducirTrack(currentPlaylist[currentIndex]);
    return;
  }
  
  let siguiente = obtenerCancionSimilar();
  
  if (!siguiente && lastTrack) {
    console.log('Cola vacía, buscando similares en IA...');
    const nuevosTracks = await buscarTracksSimilaresIA(lastTrack);
    
    if (nuevosTracks.length > 0) {
      nuevosTracks.forEach(t => agregarACola(t));
      siguiente = obtenerCancionSimilar();
    }
  }
  
  if (siguiente) {
    currentPlaylist = [siguiente];
    currentIndex = 0;
    await reproducirTrack(siguiente);
  } else {
    playBtn.textContent = '▶';
    console.log('No se encontraron más tracks para reproducir');
  }
}

playBtn.addEventListener('click', () => audio.paused ? audio.play() : audio.pause());
nextBtn.addEventListener('click', async () => await reproducirSiguiente());
prevBtn.addEventListener('click', () => {
  if (currentIndex > 0) playTrack(currentIndex - 1);
});

audio.addEventListener('play', () => {
  playBtn.textContent = '⏸';
  playerContainer.classList.add('active');
});

audio.addEventListener('pause', () => {
  playBtn.textContent = '▶';
  if (audio.currentTime === 0) playerContainer.classList.remove('active');
});

audio.addEventListener('timeupdate', () => {
  const percent = (audio.currentTime / audio.duration) * 100;
  progress.value = percent || 0;
  currentTimeEl.textContent = formatTime(audio.currentTime);
  durationEl.textContent = formatTime(audio.duration);
  document.querySelectorAll('.track-row').forEach((row, i) => {
    if (i === currentIndex) row.querySelector('.track-duration').textContent = formatTime(audio.duration);
  });
});

progress.addEventListener('input', () => audio.currentTime = (progress.value / 100) * audio.duration);
volumeSlider.addEventListener('input', () => audio.volume = volumeSlider.value || 0.5);

audio.addEventListener('ended', async () => await reproducirSiguiente());

filterFormatEl.addEventListener('change', renderTracks);
filterNameEl.addEventListener('input', renderTracks);

if (!identifier) {
  albumTitleEl.textContent = 'Error: No se proporcionó album ID';
} else {
  fetch(`https://archive.org/metadata/${identifier}`)
    .then(res => res.json())
    .then(data => {
      albumTitleEl.textContent = data.metadata?.title || identifier;
      albumCreatorEl.textContent = data.metadata?.creator || 'Autor desconocido';
      albumCoverEl.src = `https://archive.org/services/img/${identifier}`;
      
      tracks = Object.values(data.files || {})
        .filter(f => f.name.match(/\.(mp3|flac|wav|m4a|ogg)$/i))
        .map(f => ({
          name: cleanTrackName(f.name),
          format: (f.format || 'unknown').replace('Audio', '').trim(),
          url: `https://archive.org/download/${identifier}/${encodeURIComponent(f.name)}`,
          artist: data.metadata?.creator || 'Autor desconocido',
          album: data.metadata?.title || identifier,
          id: `${identifier}_${f.name}`,
          cover: albumCoverEl.src
        }));
      
      renderTracks();
      
      // SOLUCIÓN 3: Si hay autoplay pendiente, intentarlo
      if (shouldAutoplay && tracks.length > 0) {
        setTimeout(() => {
          intentarAutoplay(autoplayTrackIndex);
        }, 500);
      } else {
        // Mostrar botón de play normal
        const playAlbumBtn = document.createElement('button');
        playAlbumBtn.textContent = '▶';
        playAlbumBtn.id = 'play-album-btn';
        albumCoverEl.parentElement.appendChild(playAlbumBtn);
        playAlbumBtn.addEventListener('click', async () => {
          if (tracks.length) {
            playTrack(0);
            playAlbumBtn.remove();
          }
        });
      }
    })
    .catch(err => {
      albumTitleEl.textContent = 'Error al cargar álbum';
      console.error(err);
    });

  } 