// Sistema de cola y reproducidas
export const cola = [];
export const reproducidas = new Set();

// Añadir track a reproducidas (cuando se está reproduciendo)
export function addToQueue(track) {
  if (!track || !track.id) return;
  
  // Marcar como reproducida
  reproducidas.add(track.id);
  
  console.log(`✓ Track reproducido: ${track.name} (Total: ${reproducidas.size})`);
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
}

// Obtener siguiente canción de la cola
export function obtenerCancionSimilar() {
  while (cola.length > 0) {
    const track = cola.shift();
    
    // Verificar que no haya sido reproducida
    if (!reproducidas.has(track.id)) {
      console.log(`▶ Siguiente de cola: ${track.name} (Quedan: ${cola.length})`);
      return track;
    } else {
      console.log(`⊘ Track en cola ya reproducido, saltando: ${track.name}`);
    }
  }
  
  console.log('✗ Cola vacía'); 
}