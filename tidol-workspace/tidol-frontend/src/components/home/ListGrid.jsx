import React from 'react';
import UniversalCard from '../cards/UniversalCard';

export default function ListGrid({ items, onPlay }) {
    if (!items || items.length === 0) return null;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 px-4 md:px-0">
            {items.map((item, index) => (
                <UniversalCard
                    key={item.id || index}
                    data={item}
                    type="song"
                    variant="grid"
                    onPlay={() => onPlay && onPlay(item, index)}
                />
            ))}
        </div>
    );
}
