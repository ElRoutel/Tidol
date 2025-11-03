import React from 'react';
import { Link } from 'react-router-dom'; // Link es como <a> pero para SPAs

export default function Sidebar() {
  return (
    <nav style={{ width: '200px', background: '#111', padding: '1rem', color: 'white' }}>
      <h2>Tidol</h2>
      <ul>
        <li><Link to="/">Inicio</Link></li>
        <li><Link to="/search">Buscar</Link></li>
      </ul>
      <hr />
      <h3>Mis Playlists</h3>
      {/* Aquí luego cargaremos las playlists */}
    </nav>
  );
}