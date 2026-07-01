import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/axiosConfig';

export const useLibrary = () => {
    const [currentView, setCurrentView] = useState('favorites');
    const [layout, setLayout] = useState('grid');
    // Una sola lista que SIEMPRE corresponde a la pestaña activa. Antes se guardaba
    // data por clave y se mostraba la caché de la pestaña anterior al cambiar (tabs
    // desfasadas). Ahora se limpia al cambiar y solo se rellena si la vista sigue
    // siendo la solicitada cuando resuelve el fetch (evita carreras entre pestañas).
    const [items, setItems] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const latestView = useRef(currentView);

    const fetchData = useCallback(async (view) => {
        latestView.current = view;
        setIsLoading(true);
        setItems([]); // no mostrar contenido de la pestaña anterior

        let endpoint = '';
        switch (view) {
            case 'favorites': endpoint = '/music/songs/likes'; break;
            case 'ia-likes': endpoint = '/music/ia/likes'; break;
            case 'playlists': endpoint = '/playlists'; break;
            default:
                setIsLoading(false);
                return;
        }

        try {
            const res = await api.get(endpoint);
            if (latestView.current === view) setItems(res.data || []);
        } catch (error) {
            console.error(`Error fetching library data for ${view}:`, error);
            if (latestView.current === view) setItems([]);
        } finally {
            if (latestView.current === view) setIsLoading(false);
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
        data: items,
        isLoading,
        refresh: () => fetchData(currentView)
    };
};
