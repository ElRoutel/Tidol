import { useState, useEffect } from 'react';
// Usamos react-icons para mantener consistencia con el resto de tu app
import { IoSearch, IoReload } from 'react-icons/io5'; 

export default function SearchInput({ onSearch, loading, initialValue = '' }) {
  // Inicializamos con el valor que viene de la URL
  const [query, setQuery] = useState(initialValue);
  const [isFocused, setIsFocused] = useState(false);

  // ESTO ES LO NUEVO E IMPORTANTE:
  // Sincroniza el input si cambia la URL o seleccionas algo del historial
  useEffect(() => {
    setQuery(initialValue);
  }, [initialValue]);

  const handleSubmit = (e) => {
    // Evitamos submit si es enter pero no hay query nueva
    // Opcional: puedes permitirlo si quieres refrescar
    if (e.key === 'Enter') {
        if (query.trim()) {
            onSearch(query);
        }
        // Quitamos el foco para cerrar teclado en móviles
        e.target.blur();
    }
  };

  return (
    <div className="w-full">
      <div className="relative">
        <div 
          className={`
            relative flex items-center
            bg-gradient-to-br from-[#1a1a1a] to-black /* Ajustado a tu paleta dark */
            border border-white/10
            rounded-full
            shadow-lg hover:shadow-xl
            transition-all duration-300 ease-out
            ${isFocused ? 'ring-1 ring-green-500 scale-[1.01] border-green-500/50' : ''}
            ${loading ? 'opacity-80' : ''}
          `}
        >
          {/* Icono de búsqueda */}
          <div className="absolute left-4 flex items-center pointer-events-none">
            <IoSearch 
              className={`
                transition-all duration-300
                ${isFocused ? 'text-green-500' : 'text-gray-400'}
              `}
              size={20}
            />
          </div>

          {/* Input */}
          <input 
            type="text" 
            placeholder="¿Qué quieres escuchar?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSubmit} // Simplificado
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            disabled={loading}
            className="
              w-full
              bg-transparent
              text-white
              placeholder-gray-500
              text-base
              font-medium
              py-3 pl-12 pr-12 /* Ajustado padding para iconos */
              outline-none
              transition-all duration-300
              disabled:cursor-not-allowed
            "
          />

          {/* Indicador de carga */}
          {loading && (
            <div className="absolute right-4 flex items-center">
              <IoReload 
                className="text-green-500 animate-spin" 
                size={20}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}