import { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';

export default function SearchInput({ onSearch, loading }) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query);
    }
  };

  return (
    <div className="w-full">
      <div className="relative">
        <div 
          className={`
            relative flex items-center
            bg-gradient-to-br from-gray-900 to-black
            rounded-full
            shadow-lg hover:shadow-2xl
            transition-all duration-300 ease-out
            ${isFocused ? 'ring-2 ring-green-500 scale-[1.02]' : ''}
            ${loading ? 'opacity-90' : ''}
          `}
        >
          {/* Icono de búsqueda */}
          <div className="absolute left-5 flex items-center pointer-events-none">
            <Search 
              className={`
                transition-all duration-300
                ${isFocused ? 'text-green-500 scale-110' : 'text-gray-400'}
              `}
              size={22}
            />
          </div>

          {/* Input */}
          <input 
            type="text" 
            placeholder="¿Qué quieres escuchar?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            disabled={loading}
            className="
              w-full
              bg-transparent
              text-white
              placeholder-gray-400
              text-base
              font-semibold
              py-3 pl-14 pr-14
              outline-none
              transition-all duration-300
              disabled:cursor-not-allowed
            "
          />

          {/* Indicador de carga */}
          {loading && (
            <div className="absolute right-4 flex items-center">
              <Loader2 
                className="text-green-500 animate-spin" 
                size={24}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}