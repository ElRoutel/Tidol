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
            const historyPromise = api.get('/history');

            // 2. Quick Selection (Recomendaciones + Historial reciente)
            const recsPromise = api.get('/music/home-recommendations');

            // 3. Albums (Populares o filtrados)
            const albumsPromise = api.get('/music/albums');

            // 4. Covers & Remixes (Búsqueda general)
            // NOTA: Podcasts removidos para evitar bloqueo de IP por exceso de requests
            const coversQuery = `cover remix${querySuffix}`;
            const coversPromise = api.get(`/music/search?q=${encodeURIComponent(coversQuery)}`);

            const [historyRes, recsRes, albumsRes, coversRes] = await Promise.all([
                historyPromise,
                recsPromise,
                albumsPromise,
                coversPromise
            ]);

            // Procesar datos
            const historyData = historyRes.data || [];
            const recsData = recsRes.data || [];
            const albumsData = albumsRes.data || [];
            const coversData = coversRes.data?.canciones || [];

            // Combinar para Quick Selection
            const combinedQuick = [...historyData.slice(0, 6), ...recsData.slice(0, 6)];

            setData({
                recentListenings: historyData.slice(0, 20),
                quickSelection: shuffleArray(combinedQuick).slice(0, 6),
                recommendations: recsData.slice(0, 15), // Exponer recomendaciones puras
                albums: albumsData.slice(0, 15),
                coversRemixes: coversData.slice(0, 10)
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
