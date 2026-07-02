import { useState, useEffect } from 'react';
import { IoSearch, IoReload } from 'react-icons/io5';

export default function SearchInput({ onSearch, loading, initialValue = '' }) {
  const [query, setQuery] = useState(initialValue);
  const [isFocused, setIsFocused] = useState(false);

  // Sincroniza el input si cambia la URL o se selecciona algo del historial.
  useEffect(() => {
    setQuery(initialValue);
  }, [initialValue]);

  const handleSubmit = (e) => {
    if (e.key === 'Enter') {
      if (query.trim()) {
        onSearch(query);
      }
      // Cierra el teclado en móviles.
      e.target.blur();
    }
  };

  return (
    <div className="w-full">
      <div
        className={`
          relative flex items-center rounded-full
          bg-white/[0.06] border transition-all duration-300 ease-out
          ${isFocused
            ? 'border-white/40 bg-white/[0.09] shadow-[0_0_0_4px_rgba(255,255,255,0.06)]'
            : 'border-white/10 hover:border-white/20'}
          ${loading ? 'opacity-80' : ''}
        `}
      >
        <div className="absolute left-4 flex items-center pointer-events-none">
          <IoSearch
            className={`transition-colors duration-300 ${isFocused ? 'text-white' : 'text-white/40'}`}
            size={20}
          />
        </div>

        <input
          type="text"
          placeholder="Canciones, artistas o álbumes"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleSubmit}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={loading}
          className="w-full bg-transparent text-white placeholder-white/35 text-base font-medium py-3.5 pl-12 pr-12 outline-none disabled:cursor-not-allowed"
        />

        {loading && (
          <div className="absolute right-4 flex items-center">
            <IoReload className="text-white/70 animate-spin" size={20} />
          </div>
        )}
      </div>
    </div>
  );
}
