import React, { useState, useEffect } from 'react';
import api from '../../api/axiosConfig';

export default function ArchiveAlbumCard({ item, onView, onPlay }) {
  const { identifier, titulo, artista } = item;

  // Empezamos con la miniatura de baja calidad para una carga rápida
  const initialCover = identifier
    ? `https://archive.org/services/img/${identifier}`
    : '/default_cover.png';

  const [coverUrl, setCoverUrl] = useState(initialCover);

  // En segundo plano, pedimos al backend la mejor portada
  useEffect(() => {
    if (!identifier) return;

    const fetchBestCover = async () => {
      try {
        const res = await api.get(`/music/getCover/${identifier}`);
        if (res.data?.portada) {
          setCoverUrl(res.data.portada);
        }
      } catch (err) {
        // Si falla, no hacemos nada y nos quedamos con la miniatura inicial
        console.warn(`No se pudo obtener la portada HD para ${identifier}:`, err.message);
      }
    };

    fetchBestCover();
  }, [identifier]);

  return (
    <div className="card-base cursor-pointer" onClick={onView}>
      <img
        src={coverUrl}
        alt={titulo}
        className="object-cover rounded-md w-full h-40"
        loading="lazy"
      />

      {/* Info */}
      <div className="result-info">
        <h3 className="truncate font-semibold">{titulo}</h3>
        <p className="truncate text-sm text-text-subdued">
          {artista || 'Artista desconocido'}
        </p>
      </div>
    </div>
  );
}
