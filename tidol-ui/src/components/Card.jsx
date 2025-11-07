// src/components/Card.jsx
import { IoPlay } from "react-icons/io5";

export default function Card({ image, title, subtitle }) {
  return (
    // 1. Contenedor principal con estilos de grupo y posicionamiento relativo
    <div className="group relative bg-surface hover:bg-interactive-bg 
                    transition-colors duration-300 rounded-lg p-4 cursor-pointer">
      
      {/* 2. Contenedor de la imagen */}
      <div className="relative w-full h-auto mb-4">
        <img 
          src={image} 
          alt={`${title} cover`} 
          className="w-full h-full object-cover rounded-md shadow-lg"
        />
        
        {/* 3. Botón de Play (aparece en hover) */}
        <div className="absolute bottom-2 right-2 
                        opacity-0 group-hover:opacity-100 transform group-hover:translate-y-0 translate-y-2
                        transition-all duration-300">
          <button className="w-12 h-12 bg-primary rounded-full text-black flex items-center justify-center 
                           shadow-xl hover:scale-105">
            <IoPlay size={24} className="ml-1"/>
          </button>
        </div>
      </div>

      {/* 4. Textos */}
      <div>
        <h3 className="font-bold text-text truncate">{title}</h3>
        <p className="text-sm text-text-subdued truncate">{subtitle}</p>
      </div>

    </div>
  );
}
