// src/components/Card.jsx
import { IoPlay } from "react-icons/io5";

export default function Card({ image, title, subtitle }) {
  return (
    <div className="group relative transition-colors duration-200 rounded-lg p-3 cursor-pointer bg-neutral-800/50 hover:bg-neutral-700/70">
      
      <div className="relative w-full mb-4">
        <img 
          src={image} 
          alt={`${title} cover`} 
          className="w-full h-auto object-cover rounded-md shadow-lg"
        />
        
        {/* Overlay and Play Button */}
        <div className="absolute inset-0 bg-black bg-opacity-0 
                        flex items-center justify-center transition-all duration-300">
          <button className="w-14 h-14 bg-primary rounded-full text-black flex items-center justify-center
                           opacity-0 group-hover:opacity-100 transform scale-90 group-hover:scale-100
                           transition-all duration-300 hover:scale-110">
            <IoPlay size={28} className="ml-1"/>
          </button>
        </div>
      </div>

      <div>
        <h3 className="font-bold text-text truncate">{title}</h3>
        <p className="text-sm text-text-subdued truncate">{subtitle}</p>
      </div>

    </div>
  );
}
