import { useState, useEffect, useCallback } from 'react';
import api from '../api/axiosConfig';

export const useLibrary = () => {
    const [currentView, setCurrentView] = useState('favorites');
    const [layout, setLayout] = useState('grid');
    const [data, setData] = useState({
        favorites: [],
        iaLikes: [],
        playlists: []
    });
    const [isLoading, setIsLoading] = useState(false);

    const fetchData = useCallback(async (view) => {
        setIsLoading(true);
        try {
            let endpoint = '';
            let key = '';

            switch (view) {
                case 'favorites':
                    endpoint = '/music/songs/likes';
                    key = 'favorites';
                    break;
                case 'ia-likes':
                    endpoint = '/music/ia/likes';
                    key = 'iaLikes';
                    break;
                case 'playlists':
                    endpoint = '/playlists';
                    key = 'playlists';
                    break;
                default:
                    return;
            }

            // Evitar refetch si ya tenemos datos (opcional, por ahora refetch para frescura)
            const res = await api.get(endpoint);
            setData(prev => ({ ...prev, [key]: res.data || [] }));

        } catch (error) {
            console.error(`Error fetching library data for ${view}:`, error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData(currentView);
    }, [currentView, fetchData]);

    return {
        currentView,
        setCurrentView,
        layout,
        setLayout,
        data: data[currentView === 'favorites' ? 'favorites' : currentView === 'ia-likes' ? 'iaLikes' : 'playlists'],
        isLoading,
        refresh: () => fetchData(currentView)
    };
};
