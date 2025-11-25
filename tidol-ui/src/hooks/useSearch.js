import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/axiosConfig';

export const useSearch = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const queryParam = searchParams.get('q') || '';

    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState({
        canciones: [], albums: [], artists: [], archive: []
    });
    const [searchHistory, setSearchHistory] = useState([]);

    // --- LOAD HISTORY ---
    useEffect(() => {
        const savedHistory = localStorage.getItem('tidol_search_history');
        if (savedHistory) {
            setSearchHistory(JSON.parse(savedHistory));
        }
    }, []);

    // --- NORMALIZE ARCHIVE ---
    const normalizeArchiveResults = (archiveItems) => {
        if (!archiveItems || archiveItems.length === 0) return [];
        return archiveItems.map((item) => {
            const identifier = item.identifier || (item.id && item.id.startsWith('ia_') ? item.id.replace('ia_', '') : item.id);
            return {
                id: item.id || `ia_${identifier}`,
                identifier,
                titulo: item.titulo || item.title || 'Sin título',
                artista: item.artista || item.artist || item.creator || 'Autor desconocido',
                url: item.url || `https://archive.org/details/${identifier}`,
                portada: `https://archive.org/services/img/${identifier}`,
                duracion: item.duracion || item.duration || null,
                album: item.album || null,
                year: item.year || null,
            };
        });
    };

    // --- PERFORM SEARCH ---
    const performSearch = useCallback(async (query) => {
        setLoading(true);
        try {
            const res = await api.get(`/music/searchAll?q=${encodeURIComponent(query)}`);
            const data = res.data || {};

            setResults({
                canciones: data.canciones || [],
                albums: data.albums || [],
                artists: data.artists || [],
                archive: normalizeArchiveResults(data.archive || [])
            });
        } catch (err) {
            console.error('Error buscando:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // --- EFFECT: REACT TO URL ---
    useEffect(() => {
        if (queryParam.trim() !== '') {
            performSearch(queryParam);
        } else {
            setResults({ canciones: [], albums: [], artists: [], archive: [] });
        }
    }, [queryParam, performSearch]);

    // --- HISTORY MANAGEMENT ---
    const updateHistory = (term) => {
        let newHistory = [term, ...searchHistory.filter(item => item !== term)];
        newHistory = newHistory.slice(0, 10);
        setSearchHistory(newHistory);
        localStorage.setItem('tidol_search_history', JSON.stringify(newHistory));
    };

    const removeFromHistory = (term) => {
        const newHistory = searchHistory.filter(item => item !== term);
        setSearchHistory(newHistory);
        localStorage.setItem('tidol_search_history', JSON.stringify(newHistory));
    };

    const handleSearch = (query) => {
        if (!query || query.trim() === '') {
            setSearchParams({});
            return;
        }
        setSearchParams({ q: query });
        updateHistory(query);
    };

    return {
        query: queryParam,
        loading,
        results,
        searchHistory,
        handleSearch,
        removeFromHistory,
        hasResults: results.canciones.length > 0 || results.albums.length > 0 || results.artists.length > 0 || results.archive.length > 0
    };
};
