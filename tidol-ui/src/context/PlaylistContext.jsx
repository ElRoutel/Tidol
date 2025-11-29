import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import api from '../api/axiosConfig';
import { useAuth } from './AuthContext';

const PlaylistContext = createContext();

export const usePlaylist = () => useContext(PlaylistContext);

export function PlaylistProvider({ children }) {
    const [playlists, setPlaylists] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [songToAdd, setSongToAdd] = useState(null);
    const [loading, setLoading] = useState(false);

    // Helper to get local playlists
    const getLocalPlaylists = () => {
        try {
            const local = localStorage.getItem('tidol_playlists');
            return local ? JSON.parse(local) : [];
        } catch (e) {
            console.error("Error parsing local playlists", e);
            return [];
        }
    };

    // Helper to save local playlists
    const saveLocalPlaylists = (newPlaylists) => {
        localStorage.setItem('tidol_playlists', JSON.stringify(newPlaylists));
        setPlaylists(newPlaylists);
    };

    // Fetch all user playlists
    const fetchPlaylists = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/playlists');
            // Merge with local if needed, or just prefer server
            // For now, let's trust the server if it responds
            setPlaylists(data || []);
            // Also update local storage as cache
            localStorage.setItem('tidol_playlists', JSON.stringify(data || []));
        } catch (error) {
            console.error('Error fetching playlists, using fallback:', error);
            // Fallback to local storage
            setPlaylists(getLocalPlaylists());
        } finally {
            setLoading(false);
        }
    }, []);

    // Load playlists on mount
    const { isAuthenticated } = useAuth();

    useEffect(() => {
        if (isAuthenticated) {
            fetchPlaylists();
        } else {
            setPlaylists([]);
        }
    }, [fetchPlaylists, isAuthenticated]);

    // Create new playlist
    const createPlaylist = useCallback(async (nombre) => {
        if (!nombre || !nombre.trim()) return false;

        setLoading(true);
        const tempId = Date.now(); // Temporary ID for local
        const newPlaylist = { id: tempId, nombre, songs: [] };

        try {
            const { data } = await api.post('/playlists', { nombre });
            console.log('✅ Playlist creada en servidor:', data);

            // Update state and local cache with server data
            setPlaylists(prev => {
                const updated = [...prev, data];
                localStorage.setItem('tidol_playlists', JSON.stringify(updated));
                return updated;
            });
            return data;
        } catch (error) {
            console.error('Error creating playlist on server, using local:', error);
            // Fallback: create locally
            const current = getLocalPlaylists();
            const updated = [...current, newPlaylist];
            saveLocalPlaylists(updated);
            return newPlaylist;
        } finally {
            setLoading(false);
        }
    }, []);

    // Add song to playlist
    const addSongToPlaylist = useCallback(async (playlistId, song) => {
        if (!song || !playlistId) return false;

        setLoading(true);
        try {
            // Determine if it's an IA song or local
            const isIa = song.source === 'internet_archive' ||
                (typeof song.id === 'string' && song.id.includes('-'));

            await api.post(`/playlists/${playlistId}/songs`, {
                cancion_id: song.id,
                song_source: isIa ? 'internet_archive' : 'local',
                // Send metadata for caching
                titulo: song.titulo || song.title,
                artista: song.artista || song.artist,
                portada: song.portada || song.cover_url,
                url: song.url,
                duracion: song.duracion || song.duration
            });

            console.log('✅ Canción agregada a playlist en servidor');
            // Update local state is tricky without re-fetching, but we can try
            // Ideally we re-fetch or optimistically update.
            // Let's re-fetch for consistency with server
            fetchPlaylists();
            return true;
        } catch (error) {
            console.error('Error adding song to playlist on server, using local:', error);

            // Fallback: add locally
            const current = getLocalPlaylists();
            const playlistIndex = current.findIndex(p => p.id === playlistId);

            if (playlistIndex !== -1) {
                const playlist = current[playlistIndex];
                if (!playlist.songs) playlist.songs = [];

                // Check for duplicates
                const exists = playlist.songs.some(s => s.id === song.id);
                if (!exists) {
                    playlist.songs.push(song);
                    current[playlistIndex] = playlist;
                    saveLocalPlaylists(current);
                    console.log('✅ Canción agregada a playlist local');
                    return true;
                }
            }
            return false;
        } finally {
            setLoading(false);
        }
    }, [fetchPlaylists]);

    // Remove song from playlist
    const removeSongFromPlaylist = useCallback(async (playlistId, cancionId) => {
        setLoading(true);
        try {
            await api.delete(`/playlists/${playlistId}/songs/${cancionId}`);
            console.log('✅ Canción eliminada de playlist en servidor');
            fetchPlaylists();
            return true;
        } catch (error) {
            console.error('Error removing song from playlist on server, using local:', error);
            // Fallback: remove locally
            const current = getLocalPlaylists();
            const playlistIndex = current.findIndex(p => p.id === playlistId);

            if (playlistIndex !== -1) {
                const playlist = current[playlistIndex];
                if (playlist.songs) {
                    playlist.songs = playlist.songs.filter(s => s.id !== cancionId);
                    current[playlistIndex] = playlist;
                    saveLocalPlaylists(current);
                    console.log('✅ Canción eliminada de playlist local');
                    return true;
                }
            }
            return false;
        } finally {
            setLoading(false);
        }
    }, [fetchPlaylists]);

    // Delete playlist
    const deletePlaylist = useCallback(async (playlistId) => {
        setLoading(true);
        try {
            await api.delete(`/playlists/${playlistId}`);
            setPlaylists(prev => {
                const updated = prev.filter(p => p.id !== playlistId);
                localStorage.setItem('tidol_playlists', JSON.stringify(updated));
                return updated;
            });
            console.log('✅ Playlist eliminada del servidor');
            return true;
        } catch (error) {
            console.error('Error deleting playlist on server, using local:', error);
            // Fallback: delete locally
            const current = getLocalPlaylists();
            const updated = current.filter(p => p.id !== playlistId);
            saveLocalPlaylists(updated);
            console.log('✅ Playlist eliminada localmente');
            return true;
        } finally {
            setLoading(false);
        }
    }, []);

    // Modal controls
    const openAddToPlaylistModal = useCallback((song) => {
        setSongToAdd(song);
        setIsModalOpen(true);
    }, []);

    const closeAddToPlaylistModal = useCallback(() => {
        setIsModalOpen(false);
        setSongToAdd(null);
    }, []);

    return (
        <PlaylistContext.Provider
            value={{
                playlists,
                loading,
                isModalOpen,
                songToAdd,
                fetchPlaylists,
                createPlaylist,
                addSongToPlaylist,
                removeSongFromPlaylist,
                deletePlaylist,
                openAddToPlaylistModal,
                closeAddToPlaylistModal
            }}
        >
            {children}
        </PlaylistContext.Provider>
    );
}
