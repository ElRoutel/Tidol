import React, { useState, useEffect } from 'react';
import api from '../api/axiosConfig';

const Shelf = ({ title, endpoint, renderItem }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await api.get(endpoint);
        setItems(response.data);
      } catch (error) {
        console.error(`Error cargando la shelf "${title}":`, error);
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
        <p className="text-text-subdued">Cargando...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return null; // No renderizar nada si no hay items
  }

  return (
    <div className="mb-8">
      <h2 className="text-3xl font-bold mb-4 text-white">{title}</h2>
      <div className="flex overflow-x-auto gap-8 pb-4 tidol-shelf-scroll">
        {items.map((item, index) => renderItem(item, index, items))}
      </div>
    </div>
  );
};

export default Shelf;
