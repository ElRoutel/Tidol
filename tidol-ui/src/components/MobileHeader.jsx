// src/components/MobileHeader.jsx
import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const MobileHeader = () => {
  const { user } = useAuth();

  // Muestra un estado de carga o nulo si el usuario aún no está disponible
  if (!user) {
    return <div className="h-16 md:hidden"></div>; // Placeholder para mantener el layout
  }

  const activeLinkStyle = {
    color: '#FFFFFF',
    fontWeight: '600',
  };

  return (
    <header className="md:hidden fixed top-0 left-0 right-0 flex justify-between items-center px-4 h-16 bg-background/80 backdrop-blur-md z-40">
      {/* Secciones de navegación a la izquierda */}
      {/*Descomentrar cuando este listo todo 
        ( <nav className="flex items-center gap-4">
        <NavLink
          to="/"
          className="text-text-subdued text-lg"
          style={({ isActive }) => (isActive ? activeLinkStyle : undefined)}
        >
          Todo
        </NavLink>
        <NavLink
          to="/AllMusic"
          className="text-text-subdued text-lg"
          style={({ isActive }) => (isActive ? activeLinkStyle : undefined)}
        >
          Música
        </NavLink>
        <NavLink
          to="/podcasts"
          className="text-text-subdued text-lg"
          style={({ isActive }) => (isActive ? activeLinkStyle : undefined)}
        >
          Podcasts
        </NavLink>
      </nav>/*}

      {/* Icono de perfil a la derecha */}
      <Link to="/profile" className="w-10 h-10 rounded-full bg-primary flex items-center justify-center font-bold text-black text-lg">
        {user.username.charAt(0).toUpperCase()}
      </Link>
    </header>
  );
};

export default MobileHeader;