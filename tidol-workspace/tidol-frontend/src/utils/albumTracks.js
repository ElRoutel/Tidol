// src/utils/albumTracks.js
import api from '../api/axiosConfig';

/**
 * Normaliza los tracks de un AlbumDetailsResponse (GET /albums/:id) a la forma
 * que espera el player (misma forma que usaba AlbumPage inline).
 */
export function normalizeAlbumTracks(album, albumId) {
    if (!album?.tracks?.length) return [];
    return album.tracks.map((t) => ({
        id: t.trackId,
        trackId: t.trackId,
        trackName: t.title,
        artistName: album.artistName,
        albumName: album.title,
        albumId,
        coverArtUrl: album.coverUrl,
        sourceType: 'musicbrainz',
        type: 'songs',
        attributes: {
            name: t.title,
            artistName: album.artistName,
            albumName: album.title,
            durationInSeconds: t.duration || 0,
            artwork: { url: album.coverUrl }
        }
    }));
}

/** Carga lazy de las canciones de un álbum (para acciones desde cards). */
export async function fetchAlbumTracks(albumId) {
    const res = await api.get(`/albums/${albumId}`);
    return normalizeAlbumTracks(res.data, albumId);
}
