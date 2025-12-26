// src/components/MobileHeader.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { IoMenu, IoSearch, IoArrowBack, IoClose, IoCloudUploadOutline } from "react-icons/io5";
import MobileDrawer from './MobileDrawer';
import api from '../api/axiosConfig';

const MobileHeader = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const searchInputRef = useRef(null);

  // Focus input when search opens
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  // Handle search suggestions
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchQuery.length < 2) {
        setSuggestions([]);
        return;
      }
      try {
        const response = await api.get(`/search/suggestions?q=${encodeURIComponent(searchQuery)}`);
        setSuggestions(response.data || []);
      } catch (error) {
        console.error("Error fetching suggestions:", error);
      }
    };

    const timeoutId = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
      setIsSearchOpen(false);
    }
  };

  if (!user) return <div className="h-16 md:hidden"></div>;

  return (
    <>
      <header className="md:hidden fixed top-0 left-0 right-0 flex justify-between items-center px-4 h-16 bg-[#030303] z-40 border-b border-white/5">

        {/* Left: Hamburger & Logo */}
        <div className="flex items-center gap-4">
          <button onClick={() => setIsDrawerOpen(true)} className="text-white p-1">
            <IoMenu size={28} />
          </button>
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.svg" alt="Logo" className="h-6 w-6" />
            <span className="font-bold text-xl tracking-tight">Music</span>
          </Link>
        </div>

        {/* Right: Upload, Search & Profile */}
        <div className="flex items-center gap-4">
          <Link to="/upload" className="text-white p-2">
            <IoCloudUploadOutline size={26} />
          </Link>
          <button onClick={() => setIsSearchOpen(true)} className="text-white p-2">
            <IoSearch size={24} />
          </button>
          <Link to="/profile" className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center font-bold text-black text-sm">
            {user.username.charAt(0).toUpperCase()}
          </Link>
        </div>
      </header>

      {/* Mobile Drawer */}
      <MobileDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />

      {/* Search Overlay */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 bg-[#030303] flex flex-col animate-fade-in">
          {/* Search Header */}
          <div className="flex items-center gap-2 p-2 border-b border-white/10">
            <button onClick={() => setIsSearchOpen(false)} className="p-3 text-white">
              <IoArrowBack size={24} />
            </button>
            <form onSubmit={handleSearchSubmit} className="flex-1 relative">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar canciones, artistas..."
                className="w-full bg-[#212121] text-white rounded-full py-2 pl-4 pr-10 outline-none focus:ring-1 focus:ring-white/20"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  <IoClose size={18} />
                </button>
              )}
            </form>
          </div>

          {/* Search Results / Suggestions */}
          <div className="flex-1 overflow-y-auto p-4">
            {suggestions.length > 0 ? (
              <ul className="space-y-4">
                {suggestions.map((suggestion, index) => (
                  <li key={index} onClick={() => {
                    setSearchQuery(suggestion);
                    navigate(`/search?q=${encodeURIComponent(suggestion)}`);
                    setIsSearchOpen(false);
                  }}>
                    <div className="flex items-center gap-4 text-white">
                      <IoSearch size={20} className="text-gray-400" />
                      <span>{suggestion}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center text-gray-500 mt-10">
                <p>Busca tus canciones favoritas</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default MobileHeader;