// src/components/Sidebar.jsx
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1>Tidol</h1>
        <p>{user?.username || 'Usuario'}</p>
      </div>

      <nav>
        <NavLink
          to="/"
          className={({ isActive }) => 
            `nav-link ${isActive ? 'active' : ''}`
          }
        >
          🏠 Inicio
        </NavLink>
        <NavLink to="/search" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          🔍 Buscar
        </NavLink>
        <NavLink to="/upload" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          ⬆️ Subir
        </NavLink>
      </nav>

      <div className="logout-container">
        <button
          onClick={logout}
          className="logout-button"
        >
          Cerrar Sesión
        </button>
      </div>
    </aside>
  );
}