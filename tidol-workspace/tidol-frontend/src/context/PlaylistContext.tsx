// src/context/PlaylistContext.tsx
import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import api from '../api/axiosConfig';
import { useAuth } from './AuthContext';
import { UnifiedTrack } from '../types/music';

export interface Playlist {
    id: number | string;
    nombre: string;
    songs: UnifiedTrack[];
}

interface PlaylistContextType {
    playlists: Playlist[];
    loading: boolean;
    isModalOpen: boolean;
    songToAdd: UnifiedTrack | null;
    fetchPlaylists: () => Promise<void>;
    createPlaylist: (nombre: string) => Promise<Playlist | false>;
    renamePlaylist: (playlistId: number | string, nombre: string) => Promise<boolean>;
    addSongToPlaylist: (playlistId: number | string, song: UnifiedTrack) => Promise<boolean>;
    removeSongFromPlaylist: (playlistId: number | string, cancionId: string | number) => Promise<boolean>;
    deletePlaylist: (playlistId: number | string) => Promise<boolean>;
    openAddToPlaylistModal: (song: UnifiedTrack) => void;
    closeAddToPlaylistModal: () => void;
}

const PlaylistContext = createContext<PlaylistContextType | undefined>(undefined);

export const usePlaylist = () => {
    const context = useContext(PlaylistContext);
    if (!context) throw new Error('usePlaylist debe usarse dentro de un PlaylistProvider');
    return context;
};

export function PlaylistProvider({ children }: { children: ReactNode }) {
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [songToAdd, setSongToAdd] = useState<UnifiedTrack | null>(null);
    const [loading, setLoading] = useState(false);

    const { isAuthenticated } = useAuth();

    const getLocalPlaylists = (): Playlist[] => {
        try {
            const local = localStorage.getItem('tidol_playlists');
            return local ? JSON.parse(local) : [];
        } catch (e) {
            return [];
        }
    };

    const saveLocalPlaylists = (newPlaylists: Playlist[]) => {
        localStorage.setItem('tidol_playlists', JSON.stringify(newPlaylists));
        setPlaylists(newPlaylists);
    };

    const fetchPlaylists = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/playlists');
            setPlaylists(data || []);
            localStorage.setItem('tidol_playlists', JSON.stringify(data || []));
        } catch (error) {
            setPlaylists(getLocalPlaylists());
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isAuthenticated) {
            fetchPlaylists();
        } else {
            setPlaylists([]);
        }
    }, [fetchPlaylists, isAuthenticated]);

    const createPlaylist = useCallback(async (nombre: string): Promise<Playlist | false> => {
        if (!nombre || !nombre.trim()) return false;
        setLoading(true);
        try {
            const { data } = await api.post('/playlists', { nombre });
            setPlaylists(prev => {
                const updated = [...prev, data];
                localStorage.setItem('tidol_playlists', JSON.stringify(updated));
                return updated;
            });
            return data;
        } catch (error) {
            const tempPlaylist: Playlist = { id: Date.now(), nombre, songs: [] };
            const current = getLocalPlaylists();
            saveLocalPlaylists([...current, tempPlaylist]);
            return tempPlaylist;
        } finally {
            setLoading(false);
        }
    }, []);

    const renamePlaylist = useCallback(async (playlistId: number | string, nombre: string) => {
        const nuevo = (nombre || '').trim();
        if (!nuevo) return false;
        const applyLocal = () => {
            setPlaylists(prev => {
                const updated = prev.map(p => p.id === playlistId ? { ...p, nombre: nuevo } : p);
                localStorage.setItem('tidol_playlists', JSON.stringify(updated));
                return updated;
            });
        };
        try {
            await api.patch(`/playlists/${playlistId}`, { nombre: nuevo });
            applyLocal();
            return true;
        } catch (error) {
            // Fallback local (playlists creadas offline / sin conexión).
            applyLocal();
            return true;
        }
    }, []);

    const addSongToPlaylist = useCallback(async (playlistId: number | string, song: UnifiedTrack) => {
        if (!song || !playlistId) return false;
        setLoading(true);
        try {
            await api.post(`/playlists/${playlistId}/songs`, {
                cancion_id: song.id,
                song_source: song.sourceType,
                titulo: song.title || song.attributes?.name || '',
                artista: song.artist || song.attributes?.artistName || '',
                portada: song.artworkUrl || song.attributes?.artwork?.url || '',
                url: song.playbackUrl,
                duracion: song.attributes?.durationInSeconds || 0
            });
            fetchPlaylists();
            return true;
        } catch (error) {
            const current = getLocalPlaylists();
            const idx = current.findIndex(p => p.id === playlistId);
            if (idx !== -1) {
                if (!current[idx].songs) current[idx].songs = [];
                const exists = current[idx].songs.some(s => s.id === song.id);
                if (!exists) {
                    current[idx].songs.push(song);
                    saveLocalPlaylists(current);
                    return true;
                }
            }
            return false;
        } finally {
            setLoading(false);
        }
    }, [fetchPlaylists]);

    const removeSongFromPlaylist = useCallback(async (playlistId: number | string, cancionId: string | number) => {
        setLoading(true);
        try {
            await api.delete(`/playlists/${playlistId}/songs/${cancionId}`);
            fetchPlaylists();
            return true;
        } catch (error) {
            const current = getLocalPlaylists();
            const idx = current.findIndex(p => p.id === playlistId);
            if (idx !== -1) {
                current[idx].songs = current[idx].songs.filter(s => s.id !== cancionId);
                saveLocalPlaylists(current);
                return true;
            }
            return false;
        } finally {
            setLoading(false);
        }
    }, [fetchPlaylists]);

    const deletePlaylist = useCallback(async (playlistId: number | string) => {
        setLoading(true);
        try {
            await api.delete(`/playlists/${playlistId}`);
            setPlaylists(prev => prev.filter(p => p.id !== playlistId));
            return true;
        } catch (error) {
            const current = getLocalPlaylists();
            saveLocalPlaylists(current.filter(p => p.id !== playlistId));
            return true;
        } finally {
            setLoading(false);
        }
    }, []);

    const openAddToPlaylistModal = useCallback((song: UnifiedTrack) => {
        setSongToAdd(song);
        setIsModalOpen(true);
    }, []);

    const closeAddToPlaylistModal = useCallback(() => {
        setIsModalOpen(false);
        setSongToAdd(null);
    }, []);

    return (
        <PlaylistContext.Provider value={{
            playlists, loading, isModalOpen, songToAdd,
            fetchPlaylists, createPlaylist, renamePlaylist, addSongToPlaylist,
            removeSongFromPlaylist, deletePlaylist,
            openAddToPlaylistModal, closeAddToPlaylistModal
        }}>
            {children}
        </PlaylistContext.Provider>
    );
}
