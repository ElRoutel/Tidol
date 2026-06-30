import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoSearch, IoClose } from "react-icons/io5";
import api from '../api/axiosConfig';

export default function DesktopSearch() {
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    // Fetch suggestions
    useEffect(() => {
        const fetchSuggestions = async () => {
            if (query.length < 2) {
                setSuggestions([]);
                return;
            }
            try {
                const response = await api.get(`/search/suggestions?q=${encodeURIComponent(query)}`);
                setSuggestions(response.data || []);
            } catch (error) {
                console.error("Error fetching suggestions:", error);
            }
        };

        const timeoutId = setTimeout(fetchSuggestions, 300);
        return () => clearTimeout(timeoutId);
    }, [query]);

    const handleSearch = (e) => {
        e.preventDefault();
        if (query.trim()) {
            navigate(`/search?q=${encodeURIComponent(query)}`);
            setIsOpen(false);
        }
    };

    return (
        <>
            {/* Backdrop Overlay - Visible when searching */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300"
                    onClick={() => setIsOpen(false)}
                />
            )}

            <div ref={wrapperRef} className={`relative w-full max-w-[600px] mx-auto z-50 transition-all duration-300 ${isOpen ? 'scale-105' : ''}`}>
                {/* Search Input */}
                <form onSubmit={handleSearch} className="relative flex items-center">
                    <div className={`absolute left-4 transition-colors ${isOpen ? 'text-white' : 'text-[#aaaaaa]'}`}>
                        <IoSearch size={20} />
                    </div>
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setIsOpen(true);
                        }}
                        onFocus={() => setIsOpen(true)}
                        placeholder="Buscar canciones, álbumes, artistas..."
                        className={`w-full bg-[#212121] text-white placeholder-[#aaaaaa] rounded-t-lg ${isOpen ? 'rounded-b-none border-b border-white/10' : 'rounded-lg'} py-3 pl-12 pr-10 outline-none border border-transparent focus:bg-[#212121] transition-all shadow-lg`}
                    />
                    {query && (
                        <button
                            type="button"
                            onClick={() => setQuery('')}
                            className="absolute right-3 text-[#aaaaaa] hover:text-white"
                        >
                            <IoClose size={18} />
                        </button>
                    )}
                </form>

                {/* Suggestions Dropdown - Connected to Input */}
                {isOpen && (query.length > 0 || suggestions.length > 0) && (
                    <div className="absolute top-full left-0 right-0 bg-[#212121] rounded-b-lg shadow-2xl border-x border-b border-white/5 overflow-hidden">
                        {suggestions.length > 0 ? (
                            <ul className="py-2">
                                {suggestions.map((suggestion, index) => (
                                    <li
                                        key={index}
                                        onClick={() => {
                                            setQuery(suggestion);
                                            navigate(`/search?q=${encodeURIComponent(suggestion)}`);
                                            setIsOpen(false);
                                        }}
                                        className="px-4 py-3 hover:bg-white/10 cursor-pointer flex items-center gap-4 text-white transition-colors"
                                    >
                                        <IoSearch size={18} className="text-[#aaaaaa]" />
                                        <span className="font-medium text-sm">{suggestion}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : query.length > 1 ? (
                            <div className="p-4 text-center text-[#aaaaaa] text-sm">
                                No se encontraron resultados
                            </div>
                        ) : null}
                    </div>
                )}
            </div>
        </>
    );
}
