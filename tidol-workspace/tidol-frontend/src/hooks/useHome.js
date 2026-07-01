import { useState, useEffect, useCallback } from 'react';
import api from '../api/axiosConfig';
import { normalizeTrackList } from '../utils/trackNormalization';

// Caché en memoria de la Home por chip: evita el skeleton de 4-7s en navegaciones
// repetidas. Se muestra al instante y se revalida en segundo plano (stale-while-revalidate).
const homeCache = {};

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
        recommendations: [],
        albums: [],
        coversRemixes: [],
        iaDiscoveries: []
    });

    const fetchHomeData = useCallback(async (chipId) => {
        // Si hay caché para este chip, se muestra al instante (sin skeleton) y se
        // revalida en segundo plano. Si no, mostramos el skeleton normal.
        if (homeCache[chipId]) {
            setData(homeCache[chipId]);
            setIsLoading(false);
        } else {
            setIsLoading(true);
        }
        try {
            // 1. Dashboard unificado (Historial, Artistas Top, Recomendaciones)
            const dashboardPromise = api.get('/home', { timeout: 8000 }).catch(() => ({ data: {} }));
            
            // 2. Albums (Populares o filtrados)
            const albumsPromise = api.get('/music/albums', { timeout: 5000 }).catch(() => ({ data: [] }));

            const [dashboardRes, albumsRes] = await Promise.all([
                dashboardPromise,
                albumsPromise,
            ]);

            const dashboard = dashboardRes.data || {};
            
            // Mapeo adaptativo porque el backend Rust devuelve track_id y cover_url
            const mapRustTrack = (t) => ({
                ...t,
                id: t.track_id || t.trackId,
                name: t.title,
                artista: t.artist,
                coverArtUrl: t.cover_url || t.coverUrl || '/default-album.png'
            });

            const historyData = normalizeTrackList((dashboard.listenAgain || []).map(mapRustTrack), 'local');
            const quickSelData = normalizeTrackList((dashboard.recentlyPlayed || []).map(mapRustTrack), 'local');
            const recsData = normalizeTrackList((dashboard.recommendations || []).map(mapRustTrack), 'local');
            
            // Albums
            const albumsData = (albumsRes.data || []).map(a => ({
                id: a.id,
                title: a.title || a.titulo,
                titulo: a.title || a.titulo,
                artist: a.artistName || a.artist_name || a.autor || 'Desconocido',
                artista: a.artistName || a.artist_name || a.autor || 'Desconocido',
                autor: a.artistName || a.artist_name || a.autor,
                artworkUrl: a.coverUrl || a.cover_url || a.coverFull || a.portada || '/default-album.png',
                image: a.coverUrl || a.cover_url || a.coverThumb || a.portada || '/default-album.png',
                portada: a.coverUrl || a.cover_url || a.portada || '/default-album.png',
                type: 'album'
            }));

            // Top Artists transformados para simular Covers & Remixes o Descubrimientos IA
            const topArtistsAsTracks = (dashboard.topArtists || []).map(a => ({
                id: a.mbid,
                title: a.name,
                artista: 'Tus Artistas Favoritos',
                coverArtUrl: a.cover_url || a.coverUrl || '/default-album.png',
                type: 'artist'
            }));

            let combinedQuick = [...quickSelData.slice(0, 6), ...recsData.slice(0, 6)];
            // Garantizar que "Selección rápida" nunca quede vacía (desaparecía en "Todo"
            // cuando recentlyPlayed y recommendations venían vacíos). Rellenamos con
            // recomendaciones, historial o álbumes populares como fallback.
            if (combinedQuick.length === 0) {
                combinedQuick = [...recsData, ...historyData, ...albumsData].slice(0, 6);
            }

            const built = {
                recentListenings: historyData.slice(0, 20),
                quickSelection: shuffleArray(combinedQuick).slice(0, 6),
                recommendations: recsData.slice(0, 15),
                albums: albumsData.slice(0, 15),
                coversRemixes: normalizeTrackList(topArtistsAsTracks, 'local').slice(0, 10),
                iaDiscoveries: []
            };
            homeCache[chipId] = built;
            setData(built);

        } catch (error) {
            console.error("Error fetching home data:", error);
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
