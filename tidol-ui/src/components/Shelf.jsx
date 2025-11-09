// src/components/Shelf.jsx

import React from 'react';

/**
 * Este es el componente "Wrapper" para tu SearchPage.
 * Solo recibe un 'title' y los 'children' (los componentes que
 * ya mapeaste en SearchPage) y los envuelve en el layout de scroll.
 */
const Shelf = ({ title, children }) => {
  return (
    <div className="mb-8">
      <h2 className="text-3xl font-bold mb-4 text-white">{title}</h2>
      <div className="flex overflow-x-auto gap-4 pb-4">
        {children} {/* <-- Aquí simplemente renderiza lo que le pasaste */}
      </div>
    </div>
  );
};

export default Shelf;