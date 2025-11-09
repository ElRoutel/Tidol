import { NavLink } from 'react-router-dom';
import { useEffect, useState } from "react";
import api from '../api/axiosConfig'; // Importar axios

// Iconos
import { 
  IoHomeSharp, 
  IoSearch, 
  IoLibrary, 
  IoCloudUploadOutline,
  IoAdd
} from "react-icons/io5";

// ✅ Logo
function Logo() {
  return (
    <NavLink to="/" className="flex items-center gap-2 px-2 mb-4">
      <img src="/logo.svg" alt="Tidol Logo" className="h-10 w-10" />
      <span className="text-2xl font-bold text-text">Tidol</span>
    </NavLink>
  );
}

// ✅ Navegación principal
function MainNav() {
  const activeLinkStyle = {
    color: '#FFFFFF'
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

// ✅ Biblioteca del usuario
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

// ✅ Sidebar con perfil dinámico
export default function Sidebar() {
  const [username, setUsername] = useState("Cargando…");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setUsername("Invitado");
      return;
    }

    // Usar la instancia de axios
    api.get("/auth/validate")
      .then(res => {
        if (res.data && res.data.username) {
          setUsername(res.data.username);
        } else {
          setUsername("Invitado 🤨");
        }
      })
      .catch(() => {
        setUsername("Error de autenticación");
        // Opcional: desloguear si el token es inválido
      });
  }, []);

  return (
    <aside className="hidden md:flex flex-col gap-y-2 bg-background p-2">
      
      <div className="bg-surface rounded-lg p-4">
        <Logo />
        <MainNav />
      </div>

      <div className="bg-surface rounded-lg p-2 flex-grow">
        <UserLibrary />
      </div>

      {/* ✅ Perfil con nombre real */}
      <div className="bg-surface rounded-lg p-4 flex items-center gap-3 cursor-pointer hover:bg-surface hover:text-text transition-colors">
        
        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center font-bold text-black">
          { username.charAt(0).toUpperCase() }
        </div>

        <NavLink 
          to="/profile"
          className="flex flex-col leading-tight text-text-subdued hover:text-text transition-colors w-full"
        >
          <span className="font-semibold">{ username }</span>
          <span className="text-xs">Ver detalles</span>
        </NavLink>
      </div>

    </aside>
  );
}
