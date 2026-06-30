// src/components/cards/ArtistCard.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';

interface ArtistCardProps {
    mbid: string;
    name: string;
    coverUrl?: string;
}

const ArtistCard: React.FC<ArtistCardProps> = ({ mbid, name, coverUrl }) => {
    const navigate = useNavigate();

    const handleClick = () => {
        navigate(`/artist/${mbid}`);
    };

    return (
        <div 
            className="flex flex-col items-center gap-4 cursor-pointer group w-36 md:w-48"
            onClick={handleClick}
        >
            <div className="relative w-full aspect-square rounded-full overflow-hidden shadow-lg transition-all duration-300 group-hover:scale-105 group-hover:shadow-xl">
                <img 
                    src={coverUrl || '/default-artwork.png'} 
                    alt={name} 
                    onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = '/default-artwork.png';
                    }}
                    className="w-full h-full object-cover"
                />
            </div>
            <h3 className="text-sm font-bold text-white text-center line-clamp-2 w-full px-2">
                {name}
            </h3>
        </div>
    );
};

export default ArtistCard;
