import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import DesktopSearch from './DesktopSearch';
import { IoChevronBack, IoChevronForward, IoPerson, IoLogOutOutline } from 'react-icons/io5';

export default function DesktopHeader() {
    const { user, logout } = useAuth(); // Asumo que tienes una función logout
    const navigate = useNavigate();
    const location = useLocation();
    const [isScrolled, setIsScrolled] = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);

    // Efecto para detectar scroll y cambiar la opacidad del fondo
    useEffect(() => {
        const handleScroll = () => {
            const offset = window.scrollY;
            setIsScrolled(offset > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Ocultar buscador en ciertas rutas si es necesario (opcional)
    const isSearchPage = location.pathname === '/search';

    return (
        <header
            className={`
                hidden md:flex fixed top-0 right-0 z-[60] h-16 px-8 items-center justify-between transition-all duration-300 ease-in-out
                md:left-72 /* Comienza DESPUÉS del sidebar (ancho 18rem/72) */
                ${isScrolled ? 'bg-[#030303]/90 backdrop-blur-xl shadow-lg' : 'bg-transparent'}
            `}
        >
            {/* 1. NAVEGACIÓN (Izquierda) */}
            <div className="flex items-center gap-4 w-1/3">
                <div className="flex gap-2">
                    <button
                        onClick={() => navigate(-1)}
                        className="w-8 h-8 rounded-full bg-black/40 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors disabled:opacity-30 cursor-pointer"
                        title="Volver"
                    >
                        <IoChevronBack size={20} />
                    </button>
                    <button
                        onClick={() => navigate(1)}
                        className="w-8 h-8 rounded-full bg-black/40 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors disabled:opacity-30 cursor-pointer"
                        title="Avanzar"
                    >
                        <IoChevronForward size={20} />
                    </button>
                </div>
            </div>

            {/* 2. BUSCADOR (Centro - Opcional o Contextual) */}
            <div className="flex-1 flex justify-center max-w-md transition-opacity duration-300">
                {/* Si quieres que el buscador siempre esté visible, quita la condición !isSearchPage */}
                {!isSearchPage && (
                    <div className="w-full transform hover:scale-[1.02] transition-transform">
                        <DesktopSearch />
                    </div>
                )}
            </div>

            {/* 3. PERFIL Y ACCIONES (Derecha) */}
            <div className="flex items-center justify-end gap-4 w-1/3">
                {user ? (
                    <div className="relative">
                        <button
                            onClick={() => setShowProfileMenu(!showProfileMenu)}
                            className="flex items-center gap-2 bg-black/60 hover:bg-[#282828] p-1 pr-3 rounded-full transition-all border border-white/5 hover:border-white/10 group"
                        >
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-xs shadow-inner">
                                {user.username?.charAt(0).toUpperCase() || <IoPerson />}
                            </div>
                            <span className="text-sm font-bold text-white max-w-[100px] truncate group-hover:text-white/90">
                                {user.username}
                            </span>
                        </button>

                        {/* Menú Desplegable de Perfil */}
                        {showProfileMenu && (
                            <div className="absolute top-full right-0 mt-2 w-48 bg-[#181818] border border-white/10 rounded-lg shadow-2xl overflow-hidden animate-fade-in origin-top-right">
                                <Link to="/profile" className="block px-4 py-3 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors">
                                    Ver Perfil
                                </Link>
                                <Link to="/settings" className="block px-4 py-3 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors">
                                    Configuración
                                </Link>
                                <div className="h-[1px] bg-white/10 my-1"></div>
                                <button
                                    onClick={logout}
                                    className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-white/10 hover:text-red-300 transition-colors flex items-center gap-2"
                                >
                                    <IoLogOutOutline size={16} /> Cerrar Sesión
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center gap-6">
                        <Link
                            to="/signup"
                            className="text-gray-400 hover:text-white font-bold text-sm tracking-wide uppercase hover:scale-105 transition-all"
                        >
                            Registrarse
                        </Link>
                        <Link
                            to="/login"
                            className="bg-white text-black px-8 py-3 rounded-full font-bold text-sm hover:scale-105 hover:bg-gray-200 transition-transform shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                        >
                            Iniciar Sesión
                        </Link>
                    </div>
                )}
            </div>

            {/* Backdrop click handler para cerrar menú */}
            {showProfileMenu && (
                <div
                    className="fixed inset-0 z-[-1]"
                    onClick={() => setShowProfileMenu(false)}
                />
            )}
        </header>
    );
}