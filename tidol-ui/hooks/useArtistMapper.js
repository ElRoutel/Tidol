// Recibe array songs y hook useArtists para mapear ids
import { useMemo } from "react";

const normalize = (s = '') => s.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export default function useArtistMapper(songs = [], artists = []) {
    // build lookup map name -> artist
    const nameMap = useMemo(() => {
        const m = new Map();
        (artists || []).forEach(a => {
            const key = normalize(a.name || a.nombre || '');
            if (key) m.set(key, a);
        });
        return m;
    }, [artists]);

    const getArtistIdFromSong = (song) => {
        if (!song) return null;
        // common fields
        if (song.artist_id) return song.artist_id;
        if (song.artista_id) return song.artista_id;
        if (song.artist && typeof song.artist === 'object' && song.artist.id) return song.artist.id;
        // sometimes artist is an object with identifier
        if (song.artist && typeof song.artist === 'object' && (song.artist.identifier || song.artist._id)) return song.artist.identifier || song.artist._id;
        // try by name
        const name = song.artista || song.artist || '';
        const found = nameMap.get(normalize(name));
        return found ? found.id : null;
    };

    const getArtistFromSong = (song) => {
        const id = getArtistIdFromSong(song);
        if (id) return artists.find(a => a.id === id) || null;
        // fallback by name
        const name = song.artista || song.artist || '';
        return nameMap.get(normalize(name)) || null;
    };

    return { getArtistIdFromSong, getArtistFromSong };
}
