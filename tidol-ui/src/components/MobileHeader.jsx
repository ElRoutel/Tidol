// src/components/MobileHeader.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const MobileHeader = () => {
  const { user } = useAuth();

  // Muestra un estado de carga o nulo si el usuario aún no está disponible
  if (!user) {
    return <div className="h-16 md:hidden"></div>; // Placeholder para mantener el layout
  }

  return (
    <header className="md:hidden flex justify-between items-center p-4 bg-background sticky top-0 z-40">
      {/* Espacio a la izquierda, podrías poner un logo si quisieras */}
      <div></div>

      {/* Icono de perfil a la derecha */}
      <Link to="/profile" className="w-10 h-10 rounded-full bg-primary flex items-center justify-center font-bold text-black text-lg">
        {user.username.charAt(0).toUpperCase()}
      </Link>
    </header>
  );
};

export default MobileHeader;