// src/components/Sidebar.jsx
import { NavLink } from 'react-router-dom';

// 1. Importamos los iconos que necesitamos de react-icons
import { 
  IoHomeSharp, 
  IoSearch, 
  IoLibrary, 
  IoCloudUploadOutline, // Un icono ligeramente diferente para "Subir"
  IoAdd,             // Icono para "Crear Playlist"
  IoArrowForward     // Icono para la sección de biblioteca
} from "react-icons/io5";

// El logo de tu app. ¡Puedes cambiarlo por un SVG o una imagen!
function Logo() {
  return (
    <NavLink to="/" className="flex items-center gap-2 px-2 mb-4">
      <img src="/logo.svg" alt="Tidol Logo" className="h-10 w-10" />
      <span className="text-2xl font-bold text-text">Tidol</span>
    </NavLink>
  );
}

// Componente para los enlaces de navegación principales
function MainNav() {
  const activeLinkStyle = {
    color: '#FFFFFF', // Blanco para el texto
    // No necesitamos fondo aquí, el hover se encarga
  };

  return (
    <nav>
      <NavLink 
        to="/" 
        className="flex items-center gap-4 px-2 py-2 text-text-subdued hover:text-text font-bold transition-colors"
        style={({ isActive }) => isActive ? activeLinkStyle : undefined}
      >
        <IoHomeSharp size={28} />
        <span>Inicio</span>
      </NavLink>
      <NavLink 
        to="/search" 
        className="flex items-center gap-4 px-2 py-2 text-text-subdued hover:text-text font-bold transition-colors"
        style={({ isActive }) => isActive ? activeLinkStyle : undefined}
      >
        <IoSearch size={28} />
        <span>Buscar</span>
      </NavLink>
       <NavLink 
        to="/upload" 
        className="flex items-center gap-4 px-2 py-2 text-text-subdued hover:text-text font-bold transition-colors"
        style={({ isActive }) => isActive ? activeLinkStyle : undefined}
      >
        <IoCloudUploadOutline size={28} />
        <span>Subir</span>
      </NavLink>
    </nav>
  );
}

// Componente para la sección de la biblioteca del usuario
function UserLibrary() {
  return (
    <div className="flex flex-col mt-4">
      <div className="flex justify-between items-center px-2 py-2">
        <button className="flex items-center gap-4 text-text-subdued hover:text-text font-bold transition-colors">
          <IoLibrary size={28} />
          <span>Tu Biblioteca</span>
        </button>
        <button className="text-text-subdued hover:text-text transition-colors">
          <IoAdd size={24} />
        </button>
      </div>
      
      {/* Aquí podrías mapear y listar las playlists del usuario */}
      <div className="mt-4 space-y-2 px-2 overflow-y-auto">
        <p className="text-sm text-text-subdued">Crea tu primera playlist</p>
        <p className="text-xs text-text-subdued">¡Es fácil! Te ayudaremos.</p>
        <button className="mt-4 px-4 py-1 bg-primary text-black font-semibold rounded-full text-sm hover:bg-primary-hover">
          Crear playlist
        </button>
      </div>
    </div>
  );
}


export default function Sidebar() {
  return (
    // Contenedor principal de la barra lateral
    // hidden en móvil, flex en escritorio (md:)
    <aside className="hidden md:flex flex-col gap-y-2 bg-background p-2">
      
      {/* Primer bloque: Logo y Navegación Principal */}
      <div className="bg-surface rounded-lg p-4">
        <Logo />
        <MainNav />
      </div>

      {/* Segundo bloque: Biblioteca del Usuario */}
      <div className="bg-surface rounded-lg p-2 flex-grow">
        <UserLibrary />
      </div>

    </aside>
  );
}
