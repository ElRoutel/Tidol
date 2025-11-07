// src/MobileNav.jsx
import React from 'react';
// Importamos los mismos iconos
import { IoHomeSharp, IoSearch, IoLibrary, IoCloudUpload } from "react-icons/io5";

// Un sub-componente diferente, optimizado para móvil (solo icono)
function MobileNavLink({ icon, label }) {
  return (
    <a 
      href="#" 
      className="flex flex-col items-center gap-1 text-neutral-400 
                 hover:text-white transition-colors duration-200"
    >
      {React.createElement(icon, { size: "24" })}
      <span className="text-xs">{label}</span>
    </a>
  );
}

function MobileNav() {
  return (
    // LA MAGIA DE TAILWIND:
    // md:hidden: Oculto en pantallas medianas (md) y superiores. Visible en móvil.
    // bg-neutral-900: Un fondo oscuro, ligeramente diferente al negro puro
    <nav className="md:hidden bg-neutral-900 text-white p-4
                    flex justify-around items-center
                    border-t border-neutral-700">
      
      <MobileNavLink icon={IoHomeSharp} label="Inicio" />
      <MobileNavLink icon={IoSearch} label="Buscar" />
      <MobileNavLink icon={IoLibrary} label="Biblioteca" />
      <MobileNavLink icon={IoCloudUpload} label="Subir" />
      
    </nav>
  );
}

export default MobileNav;