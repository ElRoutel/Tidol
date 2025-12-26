import React from 'react';
import { NavLink } from 'react-router-dom';
import { IoHome, IoSearch, IoLibrary, IoCloudUpload, IoHeart } from 'react-icons/io5';

const MobileNav = () => {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-gray-800 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex justify-around items-center h-14">
        <NavLink to="/" className="flex flex-col items-center justify-center text-text-subdued hover:text-text">
          <IoHome size={22} />
          <span className="text-[10px]">Inicio</span>
        </NavLink>
        <NavLink to="/search" className="flex flex-col items-center justify-center text-text-subdued hover:text-text">
          <IoSearch size={22} />
          <span className="text-[10px]">Buscar</span>
        </NavLink>
        <NavLink to="/library" className="flex flex-col items-center justify-center text-text-subdued hover:text-text">
          <IoHeart size={22} />
          <span className="text-[10px]">Biblioteca</span>
        </NavLink>
        <NavLink to="/upload" className="flex flex-col items-center justify-center text-text-subdued hover:text-text">
          <IoCloudUpload size={22} />
          <span className="text-[10px]">Subir</span>
        </NavLink>
      </div>
    </nav>
  );
};

export default MobileNav;