// src/components/SearchInput.jsx
import { useState } from 'react';
import { IoSearch } from 'react-icons/io5';

export default function SearchInput({ onSearch, loading }) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query) {
      onSearch(query);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md">
      <div className="relative">
        <IoSearch 
          className="absolute left-4 top-1/2 -translate-y-1/2 text-text-subdued"
          size={20} 
        />
        <input 
          type="text" 
          placeholder="¿Qué quieres escuchar?"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-interactive-bg text-text placeholder-text-subdued 
                     py-3 pl-12 pr-4 rounded-full border-2 border-transparent 
                     focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
        {/* Opcional: mostrar un spinner de carga */}
        {loading && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <div className="w-5 h-5 border-t-2 border-primary rounded-full animate-spin"></div>
            </div>
        )}
      </div>
    </form>
  );
}
