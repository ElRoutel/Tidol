import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import DesktopSearch from './DesktopSearch';

export default function DesktopHeader() {
    const { user } = useAuth();

    return (
        <header className="hidden md:flex fixed top-0 left-0 right-0 h-16 items-center justify-between px-8 md:pl-72 z-[60] bg-[#030303]/90 backdrop-blur-sm border-b border-white/5">
            {/* Search Bar (Centered) */}
            <div className="flex-1 max-w-2xl">
                <DesktopSearch />
            </div>

            {/* Right Actions (Profile) */}
            <div className="flex items-center gap-4 ml-4">
                {user ? (
                    <Link to="/profile" className="w-9 h-9 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center font-bold text-black text-sm shadow-lg hover:scale-105 transition-transform">
                        {user.username.charAt(0).toUpperCase()}
                    </Link>
                ) : (
                    <Link to="/login" className="text-sm font-bold text-white hover:text-green-400 transition-colors">
                        Iniciar Sesión
                    </Link>
                )}
            </div>
        </header>
    );
}
