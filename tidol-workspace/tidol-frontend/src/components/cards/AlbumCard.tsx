import { useNavigate } from 'react-router-dom';
import { IoPlay } from 'react-icons/io5';
import api from '../../api/axiosConfig';

interface AlbumCardProps {
  id: string;
  title: string;
  artistName?: string;
  coverUrl?: string;
  releaseYear?: number;
  type?: string;
}

/**
 * AlbumCard — Tarjeta de álbum para la discografía de un artista.
 * Navega a /album/:id al hacer clic.
 * Diseño: portada cuadrada con zoom en hover + botón play + título + subtítulo.
 */
export default function AlbumCard({
  id,
  title,
  artistName,
  coverUrl,
  releaseYear,
  type,
}: AlbumCardProps) {
  const navigate = useNavigate();

  const label = type?.toLowerCase().includes('album')
    ? 'Álbum'
    : type?.toLowerCase().includes('ep')
    ? 'EP'
    : 'Sencillo';

  return (
    <div
      className="group/card flex flex-col gap-3 cursor-pointer flex-shrink-0 transition-all duration-200"
      onClick={() => navigate(`/album/${id}`)}
    >
      {/* Cover */}
      <div className="relative aspect-square w-full overflow-hidden rounded-xl shadow-lg shadow-black/40">
        <img
          src={coverUrl || '/default-artwork.png'}
          alt={title}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = '/default-album.png';
            if (id) {
              api.post(`/albums/${id}/report-cover-404`).catch(() => {});
            }
          }}
          className="w-full h-full object-cover transition-transform duration-300 group-hover/card:scale-105"
        />

        {/* Hover overlay with play button */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/card:opacity-100 transition-all duration-200 flex items-center justify-center">
          <div className="w-12 h-12 bg-[#1db954] rounded-full flex items-center justify-center shadow-xl transform scale-90 group-hover/card:scale-100 transition-transform duration-200">
            <IoPlay className="text-black ml-0.5" size={22} />
          </div>
        </div>
      </div>

      {/* Text */}
      <div className="flex flex-col px-0.5">
        <h3 className="text-white font-semibold text-sm md:text-base truncate leading-tight">
          {title}
        </h3>
        <p className="text-[#aaa] text-xs md:text-sm truncate mt-0.5">
          {releaseYear ? `${releaseYear} · ` : ''}
          {label}
          {artistName ? ` · ${artistName}` : ''}
        </p>
      </div>
    </div>
  );
}
