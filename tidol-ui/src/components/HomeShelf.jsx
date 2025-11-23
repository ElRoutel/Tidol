import React, { useState, useEffect } from 'react';
import api from '../api/axiosConfig';

const Shelf = ({ title, endpoint, items: propItems, renderItem }) => {
  const [items, setItems] = useState(propItems || []);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!endpoint) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const response = await api.get(endpoint);
        setItems(response.data);
      } catch (error) {
        console.error(`Error cargando la shelf "${title}":`, error);
        setItems([]); 
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [endpoint, title]); 

  if (loading) {
    return (
      <div className="mb-8">
        <h2 className="text-3xl font-bold mb-4 text-white">{title}</h2>
        <div className="h-48 animate-pulse bg-white/5 rounded-xl w-full"></div>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="mb-12"> {/* Margen inferior aumentado para espacio */}
      <h2 className="text-2xl md:text-3xl font-bold mb-4 text-white pl-2">{title}</h2>
      
      {/* ENVOLTORIO CLAVE PARA EL EFECTO */}
      <div className="tidol-shelf-wrapper">
        <div className="flex gap-6 pb-4 tidol-shelf-scroll">
          {items.map((item, index) => renderItem(item, index, items))}
        </div>
      </div>
      
    </div>
  );
};

export default Shelf;