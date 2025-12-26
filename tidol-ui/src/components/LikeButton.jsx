import React from 'react';
import { IoHeart, IoHeartOutline } from 'react-icons/io5';
import api from '../api/axiosConfig';

/**
 * Botón para dar "Me Gusta" a una canción.
 * @param {object} props
 * @param {object} props.song - El objeto de la canción.
 * @param {boolean} props.isLiked - Si la canción ya está marcada como "Me Gusta".
 * @param {function} props.onLikeToggle - Callback que se ejecuta cuando el estado cambia.
 * @param {boolean} [props.isArchive=false] - Si la canción es de Internet Archive.
 */
export default function LikeButton({ song, isLiked, onLikeToggle, isArchive = false }) {
  
  const handleLike = async (e) => {
    e.stopPropagation(); // Evita que se reproduzca la canción al hacer clic en el corazón

    const songId = isArchive ? song.identifier : song.id;

    // If a parent handler is provided, delegate the action to it
    if (onLikeToggle) {
      try {
        onLikeToggle(songId, song);
      } catch (err) {
        console.error('Error in parent onLikeToggle:', err);
      }
      return;
    }

    // Fallback: LikeButton will call API itself if no parent handler
    const endpoint = isArchive ? `/music/ia/${songId}/like` : `/music/songs/${songId}/like`;

    try {
      // La API debería devolver el nuevo estado de "like" (true/false)
      const response = await api.post(endpoint);
      const newLikedState = response.data.liked;
      // Notify parent if present
      if (onLikeToggle) onLikeToggle(songId, newLikedState);
    } catch (error) {
      const serverMsg = error?.response?.data?.error || error?.message || 'Unknown error';
      console.error("Error al dar/quitar like:", serverMsg, error?.response?.data);
      alert(`No se pudo actualizar el favorito: ${serverMsg}`);
    }
  };

  return (
    <button onClick={handleLike} className="like-btn" title={isLiked ? 'Quitar de favoritos' : 'Añadir a favoritos'}>
      {isLiked 
        ? <IoHeart className="text-primary" /> 
        : <IoHeartOutline />}
    </button>
  );
}