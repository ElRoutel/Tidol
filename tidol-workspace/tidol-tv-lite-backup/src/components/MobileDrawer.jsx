import React from 'react';
import { NavLink } from 'react-router-dom';
import { IoHomeSharp, IoSearch, IoLibrarySharp, IoClose } from "react-icons/io5";
import { createPortal } from 'react-dom';

export default function MobileDrawer({ isOpen, onClose }) {
    if (!isOpen) return null;

    const linkClass = ({ isActive }) =>
        `flex items-center gap-5 px-6 py-4 text-lg font-medium transition-all duration-200 ${isActive
            ? 'text-white bg-[#212121]'
            : 'text-[#aaaaaa] hover:text-white'
        }`;

    return createPortal(
        <div className="fixed inset-0 z-[60] flex">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Drawer Content */}
            <div className="relative w-[80%] max-w-[300px] h-full bg-[#030303] shadow-2xl flex flex-col animate-slide-in-left">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <img src="/logo.svg" alt="Tidol" className="h-8 w-8" />
                        <span className="text-xl font-bold text-white">Tidol</span>
                    </div>
                    <button onClick={onClose} className="text-white p-2">
                        <IoClose size={24} />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex flex-col py-4">
                    <NavLink to="/" className={linkClass} onClick={onClose}>
                        <IoHomeSharp size={24} />
                        <span>Principal</span>
                    </NavLink>

                    <NavLink to="/search" className={linkClass} onClick={onClose}>
                        <IoSearch size={24} />
                        <span>Explorar</span>
                    </NavLink>

                    <NavLink to="/library" className={linkClass} onClick={onClose}>
                        <IoLibrarySharp size={24} />
                        <span>Biblioteca</span>
                    </NavLink>
                </nav>
            </div>
        </div>,
        document.body
    );
}
