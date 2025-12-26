import { useState, useEffect, useCallback } from 'react';
import api from '../api/axiosConfig';

// Función para barajar un array (algoritmo de Fisher-Yates)
const shuffleArray = (array) => {
    if (!Array.isArray(array)) return [];
    const newArray = [...array];
    let currentIndex = newArray.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [newArray[currentIndex], newArray[randomIndex]] = [newArray[randomIndex], newArray[currentIndex]];
    }
    return newArray;
};

export const useHome = () => {
    const [selectedChip, setSelectedChip] = useState('all');
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState({
        recentListenings: [],
        quickSelection: [],
        albums: [],
        coversRemixes: []
    });

    const fetchHomeData = useCallback(async (chipId) => {
        setIsLoading(true);
        try {
            // Definir queries basadas en el chip seleccionado
            const querySuffix = chipId === 'all' ? '' : ` ${chipId}`;

            // 1. Recent Listenings (Historial)
            const historyPromise = api.get('/history', { timeout: 5000 }).catch(() => ({ data: [] }));

            // 2. Quick Selection (Recomendaciones + Historial reciente)
            const recsPromise = api.get('/music/home-recommendations', { timeout: 5000 }).catch(() => ({ data: [] }));

            // 3. Albums (Populares o filtrados)
            const albumsPromise = api.get('/music/albums', { timeout: 5000 }).catch(() => ({ data: [] }));

            // 4. Covers & Remixes (Búsqueda general)
            const coversQuery = `cover remix${querySuffix}`;
            const coversPromise = api.get(`/music/search?q=${encodeURIComponent(coversQuery)}`, { timeout: 5000 }).catch(() => ({ data: { canciones: [] } }));

            // 5. Descubrimientos IA (Personalized Engine)
            const iaPromise = api.get('/music/ia/discoveries', { timeout: 8000 }).catch(() => ({ data: [] }));

            const [historyRes, recsRes, albumsRes, coversRes, iaRes] = await Promise.all([
                historyPromise,
                recsPromise,
                albumsPromise,
                coversPromise,
                iaPromise
            ]);

            // Procesar datos
            const historyData = historyRes.data || [];
            const recsData = recsRes.data || [];
            const albumsData = albumsRes.data || [];
            const coversData = coversRes.data?.canciones || [];
            const iaData = iaRes.data || [];

            // Combinar para Quick Selection
            const combinedQuick = [...historyData.slice(0, 6), ...recsData.slice(0, 6)];

            setData({
                recentListenings: historyData.slice(0, 20),
                quickSelection: shuffleArray(combinedQuick).slice(0, 6),
                recommendations: recsData.slice(0, 15), // Exponer recomendaciones puras
                albums: albumsData.slice(0, 15),
                coversRemixes: coversData.slice(0, 10),
                iaDiscoveries: iaData.slice(0, 15) // Nueva sección
            });

        } catch (error) {
            console.error("Error fetching home data:", error);
            // Mantener datos anteriores o mostrar error (aquí optamos por log y no romper UI)
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Efecto para cargar datos al cambiar el chip
    useEffect(() => {
        fetchHomeData(selectedChip);
    }, [selectedChip, fetchHomeData]);

    return {
        selectedChip,
        setSelectedChip,
        isLoading,
        data,
        fetchHomeData
    };
};
