import React from 'react';
import { NavLink } from 'react-router-dom';
import { IoHome, IoSearch, IoLibrary } from 'react-icons/io5';

const BottomNav = () => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-gray-800 z-50">
      <div className="flex justify-around items-center h-16">
        <NavLink to="/" className="flex flex-col items-center justify-center text-text-subdued hover:text-text">
          <IoHome size={24} />
          <span className="text-xs">Home</span>
        </NavLink>
        <NavLink to="/search" className="flex flex-col items-center justify-center text-text-subdued hover:text-text">
          <IoSearch size={24} />
          <span className="text-xs">Search</span>
        </NavLink>
        <NavLink to="/library" className="flex flex-col items-center justify-center text-text-subdued hover:text-text">
          <IoLibrary size={24} />
          <span className="text-xs">Library</span>
        </NavLink>
      </div>
    </nav>
  );
};

export default BottomNav;
