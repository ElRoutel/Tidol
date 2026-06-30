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
    try {
      let response;
      if (isArchive) {
        const body = {
          identifier: songId,
          title: song.attributes?.name || song.title || song.titulo || 'Unknown',
          artist: song.attributes?.artistName || song.artist || song.artista || 'Unknown',
          source: song.source || 'internet_archive',
          url: song.playbackUrl || song.url,
          portada: song.attributes?.artwork?.url || song.artworkUrl || song.portada || song.cover,
          duration: song.attributes?.durationInSeconds || song.duration
        };
        response = await api.post('/music/ia/likes/toggle', body);
      } else {
        response = await api.post(`/music/songs/${songId}/like`);
      }

      const newLikedState = response.data.liked;
      // Ideally we should update local state here if this was a standalone component,
      // but usually this is controlled by parent.
    } catch (error) {
      const serverMsg = error?.response?.data?.error || error?.message || 'Unknown error';
      console.error("Error al dar/quitar like:", serverMsg, error?.response?.data);
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