import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import api from '../api/axiosConfig';

const PlaylistContext = createContext();

export const usePlaylist = () => useContext(PlaylistContext);

export function PlaylistProvider({ children }) {
    const [playlists, setPlaylists] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [songToAdd, setSongToAdd] = useState(null);
    const [loading, setLoading] = useState(false);

    // Fetch all user playlists
    const fetchPlaylists = useCallback(async () => {
        try {
            const { data } = await api.get('/playlists');
            setPlaylists(data || []);
        } catch (error) {
            console.error('Error fetching playlists:', error);
        }
    }, []);

    // Load playlists on mount
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) fetchPlaylists();
    }, [fetchPlaylists]);

    // Create new playlist
    const createPlaylist = useCallback(async (nombre) => {
        if (!nombre || !nombre.trim()) return false;

        setLoading(true);
        try {
            const { data } = await api.post('/playlists', { nombre });
            setPlaylists(prev => [...prev, data]);
            console.log('✅ Playlist creada:', data);
            return data;
        } catch (error) {
            console.error('Error creating playlist:', error);
            return null;
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

            console.log('✅ Canción agregada a playlist');
            return true;
        } catch (error) {
            console.error('Error adding song to playlist:', error);
            return false;
        } finally {
            setLoading(false);
        }
    }, []);

    // Remove song from playlist
    const removeSongFromPlaylist = useCallback(async (playlistId, cancionId) => {
        setLoading(true);
        try {
            await api.delete(`/playlists/${playlistId}/songs/${cancionId}`);
            console.log('✅ Canción eliminada de playlist');
            return true;
        } catch (error) {
            console.error('Error removing song from playlist:', error);
            return false;
        } finally {
            setLoading(false);
        }
    }, []);

    // Delete playlist
    const deletePlaylist = useCallback(async (playlistId) => {
        setLoading(true);
        try {
            await api.delete(`/playlists/${playlistId}`);
            setPlaylists(prev => prev.filter(p => p.id !== playlistId));
            console.log('✅ Playlist eliminada');
            return true;
        } catch (error) {
            console.error('Error deleting playlist:', error);
            return false;
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
