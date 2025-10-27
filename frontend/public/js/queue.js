// Sistema de cola y reproducidas
export const cola = [];
export const reproducidas = new Set();

// Añadir track a reproducidas (cuando se está reproduciendo)
export function addToQueue(track) {
  if (!track || !track.id) return;
  
  // Marcar como reproducida
  reproducidas.add(track.id);
  
  console.log(`✓ Track reproducido: ${track.name} (Total: ${reproducidas.size})`);
  
  // Notificar al menú si existe
  if (window.actualizarBadge) {
    window.actualizarBadge();
  }
}

// Añadir track a la cola para reproducción futura
export function agregarACola(track) {
  if (!track || !track.id) return;
  
  // Verificar que no esté ya reproducida
  if (reproducidas.has(track.id)) {
    console.log(`⊘ Ya reproducido: ${track.name}`);
    return;
  }
  
  // Verificar que no esté ya en la cola
  const yaEnCola = cola.some(t => t.id === track.id);
  if (yaEnCola) {
    console.log(`⊘ Ya en cola: ${track.name}`);
    return;
  }
  
  cola.push(track);
  console.log(`+ Añadido a cola: ${track.name} (Cola: ${cola.length} tracks)`);
  
  // Notificar al menú si existe
  if (window.actualizarBadge) {
    window.actualizarBadge();
  }
}

// Obtener siguiente canción de la cola
export function obtenerCancionSimilar() {
  while (cola.length > 0) {
    const track = cola.shift();
    
    // Verificar que no haya sido reproducida
    if (!reproducidas.has(track.id)) {
      console.log(`▶ Siguiente de cola: ${track.name} (Quedan: ${cola.length})`);
      
      // Notificar al menú si existe
      if (window.actualizarBadge) {
        window.actualizarBadge();
      }
      
      return track;
    } else {
      console.log(`⊘ Track en cola ya reproducido, saltando: ${track.name}`);
    }
  }
  
  console.log('✗ Cola vacía');
  
  // Notificar al menú si existe
  if (window.actualizarBadge) {
    window.actualizarBadge();
  }
  
  return null;
}

// Limpiar cola y reproducidas (útil para debugging)
export function limpiarCola() {
  cola.length = 0;
  reproducidas.clear();
  console.log('Cola y reproducidas limpiadas');
  
  // Notificar al menú si existe
  if (window.actualizarBadge) {
    window.actualizarBadge();
  }
  if (window.actualizarCola) {
    window.actualizarCola();
  }
}

// Ver estado actual
export function verEstadoCola() {
  console.log('=== ESTADO DE LA COLA ===');
  console.log(`Tracks en cola: ${cola.length}`);
  console.log(`Tracks reproducidos: ${reproducidas.size}`);
  if (cola.length > 0) {
    console.log('Próximos en cola:', cola.slice(0, 5).map(t => t.name));
  }
  console.log('========================');
}

// Exponer para debugging en consola
window.queueDebug = {
  ver: verEstadoCola,
  limpiar: limpiarCola,
  cola: cola,
  reproducidas: reproducidas
};