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
    // Un fallo de red no es una biblioteca vacía: sin esto, un 500 se veía como
    // "Aún no tienes playlists".
    const [error, setError] = useState(null);
    const latestView = useRef(currentView);

    const fetchData = useCallback(async (view) => {
        latestView.current = view;
        setIsLoading(true);
        setError(null);
        setItems([]); // no mostrar contenido de la pestaña anterior

        let endpoint = '';
        switch (view) {
            // likes/detailed devuelve título/artista/portada; los endpoints
            // antiguos (/music/songs/likes) solo devuelven IDs y la Library
            // mostraba "Sin título" en todo.
            case 'favorites': endpoint = '/music/likes/detailed?source=local'; break;
            case 'ia-likes': endpoint = '/music/likes/detailed?source=archive'; break;
            case 'playlists': endpoint = '/playlists'; break;
            default:
                setIsLoading(false);
                return;
        }

        try {
            const res = await api.get(endpoint);
            if (latestView.current === view) setItems(res.data || []);
        } catch (err) {
            if (latestView.current === view) {
                setItems([]);
                setError(err?.response
                    ? 'El servidor respondió con un error.'
                    : 'Comprueba tu conexión e inténtalo de nuevo.');
            }
        } finally {
            if (latestView.current === view) setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchData(currentView);
    }, [currentView, fetchData]);

    return {
        currentView,
        setCurrentView,
        layout,
        setLayout,
        data: items,
        isLoading,
        error,
        refresh: () => fetchData(currentView)
    };
};
