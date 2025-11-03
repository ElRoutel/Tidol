import React from 'react';

export default function PlayerBar() {
  // Este reproductor NUNCA se recargará
  return (
    <footer style={{ background: '#222', padding: '1rem', color: 'white', position: 'fixed', bottom: 0, width: '100%' }}>
      <h3>Reproductor Global</h3>
      <audio id="global-player" controls style={{ width: '100%' }} />
    </footer>
  );
}