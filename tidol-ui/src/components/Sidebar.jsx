// src/components/Sidebar.jsx
import { NavLink } from 'react-router-dom';
import { useEffect, useState } from "react";
import api from '../api/axiosConfig';

// Iconos
import { 
  IoHomeSharp, 
  IoSearch, 
  IoLibrary, 
  IoCloudUploadOutline,
  IoAdd,
  IoHeartOutline,
  IoDocumentTextOutline
} from "react-icons/io5";

// ✅ Logo
function Logo() {
  return (
    <NavLink to="/" className="flex items-center gap-2 px-2 mb-6">
      <img src="/logo.svg" alt="Tidol Logo" className="h-8 w-8 drop-shadow-md" />
      <span className="text-xl font-bold text-white tracking-wide">Tidol</span>
    </NavLink>
  );
}

// ✅ Navegación principal
function MainNav() {
  const linkClass = ({ isActive }) => 
    `flex items-center gap-4 px-4 py-3 rounded-lg transition-all duration-200 font-bold ${
      isActive 
        ? 'text-white bg-white/10 shadow-lg backdrop-blur-md border border-white/5' 
        : 'text-gray-400 hover:text-white hover:bg-white/5'
    }`;

  return (
    <nav className="flex flex-col gap-1">
      <NavLink to="/" className={linkClass}>
        <IoHomeSharp size={24} />
        <span>Inicio</span>
      </NavLink>

      <NavLink to="/search" className={linkClass}>
        <IoSearch size={24} />
        <span>Buscar</span>
      </NavLink>

      <NavLink to="/upload" className={linkClass}>
        <IoCloudUploadOutline size={24} />
        <span>Subir</span>
      </NavLink>
    </nav>
  );
}

// ✅ Biblioteca del usuario
function UserLibrary() {
  const [playlists, setPlaylists] = useState([]);

  useEffect(() => {
    const fetchPlaylists = async () => {
      try {
        const { data } = await api.get('/playlists');
        setPlaylists(data);
      } catch (error) {
        console.error('Error fetching playlists:', error);
      }
    };
    const token = localStorage.getItem("token");
    if (token) fetchPlaylists();
  }, []);

  const linkClass = ({ isActive }) => 
    `flex items-center gap-4 px-4 py-3 rounded-lg transition-all duration-200 font-bold ${
      isActive 
        ? 'text-white bg-white/10' 
        : 'text-gray-400 hover:text-white hover:bg-white/5'
    }`;

  return (
    <div className="flex flex-col mt-2 h-full">
      {/* FAVORITOS */}
      <NavLink to="/library" className={linkClass}>
        <IoHeartOutline size={24} />
        <span>Favoritos</span>
      </NavLink>

      {/* SEPARADOR */}
      <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-4"></div>

      {/* CABECERA PLAYLISTS */}
      <div className="flex justify-between items-center px-4 mb-2">
        <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">
          Tus playlists
        </span>
        <button className="text-gray-400 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10">
          <IoAdd size={20} />
        </button>
      </div>

      {/* LISTA SCROLLABLE */}
      <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
        {playlists.length > 0 ? (
          <ul className="space-y-1">
            {playlists.map(playlist => (
              <li key={playlist.id}>
                <NavLink 
                  to={`/playlist/${playlist.id}`} 
                  className="block px-4 py-2 rounded-md text-sm text-gray-400 hover:text-white hover:bg-white/5 truncate transition-colors"
                >
                  {playlist.nombre}
                </NavLink>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-4 rounded-lg bg-white/5 border border-white/5 text-center mt-2">
            <p className="text-sm font-semibold text-white">Crea tu primera playlist</p>
            <button className="mt-3 px-4 py-1.5 bg-white text-black font-bold rounded-full text-xs hover:scale-105 transition-transform">
              Crear ahora
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ✅ Sidebar Principal (CORREGIDO Z-INDEX)
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
    // CLASE CLAVE: z-50 para estar encima del fondo fixed de las páginas
    <aside className="hidden md:flex flex-col h-full w-full relative z-50">
      
      {/* FONDO GLASS SIDEBAR: Un negro sutil para que el texto se lea sobre el fondo de colores */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-black/80 backdrop-blur-2xl border-r border-white/5" />

      <div className="relative flex flex-col h-full p-3 gap-3 z-10">
        
        {/* BLOQUE 1: NAVEGACIÓN */}
        <div className="sidebar-panel">
          <Logo />
          <MainNav />
        </div>

        {/* BLOQUE 2: BIBLIOTECA */}
        <div className="sidebar-panel flex-1 min-h-0 overflow-hidden flex flex-col">
          <UserLibrary />
        </div>

        {/* BLOQUE 3: USUARIO */}
        <NavLink 
          to="/profile"
          className="sidebar-panel flex items-center gap-3 p-3 cursor-pointer hover:bg-white/5 transition-colors group"
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

      {/* ESTILOS */}
      <style jsx>{`
        .sidebar-panel {
            background: rgba(255, 255, 255, 0.03); /* Casi transparente */
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 12px;
            padding: 12px;
        }

        /* Scrollbar fina */
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