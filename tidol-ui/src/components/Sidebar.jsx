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
  IoBookOutline,
  IoDocumentTextOutline
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
  const activeLinkStyle = { color: '#FFFFFF' };

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

  return (
    <div className="flex flex-col mt-4">
      
      {/* ✅ FAVORITOS */}
      <NavLink 
        to="/library"
        className="flex items-center gap-4 px-2 py-2 text-text-subdued hover:text-text font-bold transition-colors"
      >
        <IoHeartOutline size={28} />
        <span>Favoritos</span>
      </NavLink>

      {/* ✅ NUEVA SECCIÓN descomentar cuando este lista la seccion*/}
      {/*<NavLink 
        to="/books"
        className="flex items-center gap-4 px-2 py-2 text-text-subdued hover:text-text font-bold transition-colors"
      >
        <IoBookOutline size={28} />
        <span>Biblioteca</span>
      </NavLink>*/}

      {/* Playlists creadas por usuario */}
      <div className="flex justify-between items-center px-2 py-2 mt-4">
        <span className="text-xs text-text-secondary uppercase tracking-wide">
          Tus playlists
        </span>
        <button className="text-text-subdued hover:text-text transition-colors">
          <IoAdd size={24} />
        </button>
      </div>

      <div className="mt-2 space-y-2 px-2 overflow-y-auto">
        {playlists.length > 0 ? (
          <ul>
            {playlists.map(playlist => (
              <li key={playlist.id}>
                <NavLink 
                  to={`/playlist/${playlist.id}`} 
                  className="block p-2 rounded-md text-sm text-text-subdued hover:text-text hover:bg-surface-hover font-semibold"
                >
                  {playlist.nombre}
                </NavLink>
              </li>
            ))}
          </ul>
        ) : (
          <div className="bg-surface-hover p-4 rounded-lg text-center">
            <p className="text-sm font-semibold text-text">Crea tu primera playlist</p>
            <p className="text-xs text-text-subdued mt-1">¡Es fácil! Te ayudamos.</p>
            <button className="mt-4 px-4 py-1 bg-white text-black font-semibold rounded-full text-sm hover:scale-105">
              Crear playlist
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ✅ Sidebar
export default function Sidebar() {
  const [username, setUsername] = useState("Cargando…");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return setUsername("Invitado");

    api.get("/auth/validate")
      .then(res => {
        setUsername(res.data?.username || "Invitado 🤨");
      })
      .catch(() => setUsername("Error de autenticación"));
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

      <div className="bg-surface rounded-lg p-4 flex items-center gap-3 cursor-pointer hover:bg-surface hover:text-text transition-colors">
        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center font-bold text-black">
          {username.charAt(0).toUpperCase()}
        </div>
        <NavLink 
          to="/profile"
          className="flex flex-col leading-tight text-text-subdued hover:text-text transition-colors w-full"
        >
          <span className="font-semibold">{username}</span>
          <span className="text-xs">Ver detalles</span>
        </NavLink>
      </div>

      {/* Términos de Uso */}
      <NavLink 
        to="/terms"
        className="bg-surface rounded-lg p-4 flex items-center gap-3 text-text-subdued hover:text-text hover:bg-surface-hover transition-colors"
      >
        <IoDocumentTextOutline size={24} />
        <span className="font-semibold text-sm">Términos de Uso</span>
      </NavLink>

    </aside>
  );
}
