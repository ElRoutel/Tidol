// src/components/Sidebar.jsx
import { NavLink } from 'react-router-dom';
import { useEffect, useState } from "react";
import api from '../api/axiosConfig';
import { usePlaylist } from '../context/PlaylistContext';

// Iconos
import {
  IoHomeSharp,
  IoSearch,
  IoCloudUploadOutline,
  IoAdd,
  IoHeartOutline,
  IoLibrarySharp,
} from "react-icons/io5";

// ✅ Logo (Ajustado padding para alinearse al nuevo diseño)
function Logo() {
  return (
    <NavLink to="/" className="flex items-center gap-4 px-7 py-10">
      <img src="/logo.svg" alt="Tidol Logo" className="h-8 w-8 drop-shadow-md" />
      <span className="text-xl font-bold text-white tracking-wide">Tidol</span>
    </NavLink>
  );
}

// ✅ Navegación principal
function MainNav() {
  const linkClass = ({ isActive }) =>
    `flex items-center gap-5 px-6 py-2.5 transition-all duration-200 text-sm ${isActive
      ? 'text-white bg-[#212121] font-bold' // Active: Bold
      : 'text-[#aaaaaa] hover:text-white hover:bg-white/5 font-medium' // Inactive: Medium
    }`;

  return (
    <nav className="flex flex-col mt-2">
      <NavLink to="/" className={linkClass}>
        <IoHomeSharp size={24} />
        <span>Principal</span>
      </NavLink>

      <NavLink to="/search" className={linkClass}>
        <IoSearch size={24} />
        <span>Explorar</span>
      </NavLink>

      <NavLink to="/library" className={linkClass}>
        <IoLibrarySharp size={24} />
        <span>Biblioteca</span>
      </NavLink>
    </nav>
  );
}

// ✅ Biblioteca del usuario
function UserLibrary() {
  const { playlists, createPlaylist } = usePlaylist();

  const handleCreatePlaylist = async () => {
    const name = window.prompt("Nombre de la nueva playlist:");
    if (name) {
      await createPlaylist(name);
    }
  };



  const linkClass = ({ isActive }) =>
    `flex items-center gap-4 px-6 py-3 transition-all duration-200 font-bold border-l-4 ${isActive
      ? 'text-white bg-white/10 border-green-500'
      : 'text-gray-400 hover:text-white hover:bg-white/5 border-transparent'
    }`;

  return (
    <div className="flex flex-col mt-4 h-full">
      {/* FAVORITOS */}
      <NavLink to="/library" className={linkClass}>
        <IoHeartOutline size={24} />
        <span>Favoritos</span>
      </NavLink>

      {/* SEPARADOR SUTIL */}
      <div className="h-px bg-white/10 mx-6 my-4"></div>

      {/* CABECERA PLAYLISTS */}
      <div className="flex justify-between items-center px-6 mb-2">
        <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">
          Tus playlists
        </span>
        <button
          onClick={handleCreatePlaylist}
          className="text-gray-400 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
          title="Crear nueva playlist"
        >
          <IoAdd size={20} />
        </button>
      </div>

      {/* LISTA SCROLLABLE */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-2">
        {playlists.length > 0 ? (
          <ul className="space-y-1">
            {playlists.map(playlist => (
              <li key={playlist.id}>
                <NavLink
                  to={`/playlist/${playlist.id}`}
                  className="block px-4 py-2 mx-2 rounded-md text-sm text-gray-400 hover:text-white hover:bg-white/5 truncate transition-colors"
                >
                  {playlist.nombre}
                </NavLink>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-6 mt-4">
            <p className="text-sm text-gray-500">Aún no tienes playlists.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ✅ Sidebar Principal
export default function Sidebar() {
  const [username, setUsername] = useState("Cargando...");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return setUsername("Invitado");

    api.get("/auth/validate")
      .then(res => {
        setUsername(res.data?.username || "Usuario");
      })
      .catch(() => setUsername("Invitado"));
  }, []);

  return (
    // CAMBIOS CLAVE:
    // 1. 'h-screen': Fuerza altura completa de la pantalla.
    // 2. 'w-64' (o el ancho que prefieras): Ancho fijo.
    // 3. 'fixed left-0 top-16': Se queda pegado a la izquierda, debajo del header.
    // 4. Fondo aplicado directamente aquí, sin bordes redondeados.
    <aside className="hidden md:flex flex-col w-64 h-[calc(100vh-4rem)] fixed left-0 top-16 z-[50] bg-[#030303]">

      {/* Efecto de fondo sutil (opcional, si quieres que no sea negro plano) */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />

      {/* Contenedor de contenido (z-10 para estar sobre el fondo) */}
      <div className="relative flex flex-col h-full z-10">

        {/* SECCIÓN SUPERIOR */}
        <div>
          <Logo />
          <MainNav />
        </div>

        {/* SECCIÓN CENTRAL (Expandible) */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <UserLibrary />
        </div>

        {/* SECCIÓN INFERIOR (Usuario) - Pegado al fondo */}
        <div className="border-t border-white/10 bg-black/20">
          <NavLink
            to="/profile"
            className="flex items-center gap-3 p-4 cursor-pointer hover:bg-white/5 transition-colors group"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center font-bold text-black shadow-lg group-hover:scale-105 transition-transform">
              {username.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="font-bold text-white text-sm truncate">{username}</span>
              <span className="text-xs text-green-400">Ver perfil</span>
            </div>
          </NavLink>
        </div>

      </div>

      {/* ESTILOS SCROLLBAR */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { 
            background: rgba(255, 255, 255, 0.2); 
            border-radius: 4px; 
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.4); }
      `}</style>
    </aside>
  );
}