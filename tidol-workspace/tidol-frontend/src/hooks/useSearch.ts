// src/hooks/useSearch.ts
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/axiosConfig';
import { UnifiedTrack, SourceType } from '../types/music';
import { canonicalPlatform } from '../engine/embedResolver';

export interface SearchResults {
    canciones: UnifiedTrack[];
    albums: any[];
    artists: any[];
    archive: UnifiedTrack[];
    canonicalHit: UnifiedTrack | null;
}

export const useSearch = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const queryParam = searchParams.get('q') || '';

    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<SearchResults>({
        canciones: [],
        albums: [],
        artists: [],
        archive: [],
        canonicalHit: null
    });
    const [searchHistory, setSearchHistory] = useState<string[]>([]);

    // --- LOAD HISTORY ---
    useEffect(() => {
        const savedHistory = localStorage.getItem('tidol_search_history');
        if (savedHistory) {
            setSearchHistory(JSON.parse(savedHistory));
        }
    }, []);

    // --- MAP TO UNIFIED TRACK ---
    const mapToUnifiedTrack = (track: any, source: SourceType): UnifiedTrack => {
        const trackId = track.trackId || track.track_id || track.identifier || track.id || `unknown-${Math.random()}`;
        const trackName = track.title || track.trackName || track.track_name || track.titulo || track.name || "Pista Desconocida";
        const artistName = track.artist || track.artistName || track.artist_name || track.artista || track.creator || "Artista Desconocido";
        const coverArtUrl = track.coverUrl || track.coverArtUrl || track.cover_art_url || track.portada || track.thumbnail || "/default-album.png";
        const durationInSeconds = track.duration || track.durationSeconds || track.duration_seconds || track.duracion || 0;
        // La reproducción legal se resuelve en tiempo de play (embed de YouTube /
        // audio CC de Internet Archive). Solo conservamos audio directo legal.
        const directAudio: string | undefined = track.preview_url || track.previewUrl
            || (typeof track.url === 'string' && track.url.startsWith('http') ? track.url : undefined);

        return {
            trackId,
            trackName,
            artistName,
            coverArtUrl,
            sourceType: track.source || source,
            platform: canonicalPlatform(track.platform) as any,
            videoId: canonicalPlatform(track.platform) === 'youtube' ? track.id : undefined,
            embedUrl: track.embed_url || track.embedUrl,
            externalUrl: track.external_url || track.externalUrl,
            previewUrl: track.preview_url || track.previewUrl,
            playbackUrl: directAudio,
            durationInSeconds,
            id: trackId,
            // Keep attributes for backward compatibility
            attributes: {
                name: trackName,
                artistName,
                artwork: {
                    url: coverArtUrl,
                },
                durationInSeconds,
                hasLyrics: track.hasLyrics || track.has_lyrics || false,
                isLiked: track.isLiked || track.is_liked || false,
            }
        };
    };

    // --- PERFORM SEARCH ---
    const performSearch = useCallback(async (query: string) => {
        if (!query.trim()) return;

        setLoading(true);
        try {
            // GET /api/v1/search/:query?page=1&limit=20
            const response = await api.get(`/search/${encodeURIComponent(query)}?page=1&limit=20`);
            const data = response.data;

            // ELIMINAMOS la validación data.status === 'success'.
            // Si Axios no lanzó un error 400/500, asumimos que data es nuestro SearchResponse de Rust.
            if (data && data.query) {
                // Mapeamos el Canonical Hit (usando camelCase: canonicalHit)
                const canonicalTrack = data.canonicalHit
                    ? mapToUnifiedTrack(data.canonicalHit, 'musicbrainz')
                    : null;

                // Mapeamos los resultados locales (usando camelCase: localResults)
                // Por ahora lo dejamos vacío o mapeamos directo si ya tienes datos locales
                const localTracks = (data.localResults || []).map((t: any) =>
                    mapToUnifiedTrack(t, 'local')
                );

                // Mapeamos los resultados del archivo (usando camelCase: archiveResults)
                const archiveTracks = (data.archiveResults || []).map((t: any) =>
                    mapToUnifiedTrack(t, 'musicbrainz')
                );

                setResults({
                    canciones: localTracks,
                    albums: [], // Rust aún no envía esto, podemos dejarlo vacío o extraerlo después
                    artists: data.artists || [], // Mapeamos los artistas recibidos
                    archive: archiveTracks,
                    canonicalHit: canonicalTrack
                });
            } else {
                // Si data viene vacío o es un error tipado de Rust
                console.warn('Respuesta inesperada del servidor:', data);
                setResults({ canciones: [], albums: [], artists: [], archive: [], canonicalHit: null });
            }
        } catch (err) {
            console.error('Error buscando:', err);
            setResults({ canciones: [], albums: [], artists: [], archive: [], canonicalHit: null });
        } finally {
            setLoading(false);
        }
    }, []);

    // --- REGISTER CLICK ---
    const registerClick = useCallback(async (track: UnifiedTrack) => {
        try {
            await api.post('/search/click', {
                query: queryParam,
                track_id: track.id,
                track_name: track.attributes?.name || 'Unknown',
                artist_name: track.attributes?.artistName || 'Unknown',
                cover_art_url: track.attributes?.artwork?.url || '/default_cover.png',
                source_link: track.playbackUrl || ''
            });
        } catch (err) {
            console.warn('Error al registrar click en track:', err);
        }
    }, [queryParam]);

    // --- EFFECT: REACT TO URL ---
    useEffect(() => {
        if (queryParam.trim() !== '') {
            performSearch(queryParam);
        } else {
            setResults({ canciones: [], albums: [], artists: [], archive: [], canonicalHit: null });
        }
    }, [queryParam, performSearch]);

    // --- HISTORY MANAGEMENT ---
    const updateHistory = (term: string) => {
        let newHistory = [term, ...searchHistory.filter(item => item !== term)];
        newHistory = newHistory.slice(0, 10);
        setSearchHistory(newHistory);
        localStorage.setItem('tidol_search_history', JSON.stringify(newHistory));
    };

    const removeFromHistory = (term: string) => {
        const newHistory = searchHistory.filter(item => item !== term);
        setSearchHistory(newHistory);
        localStorage.setItem('tidol_search_history', JSON.stringify(newHistory));
    };

    const handleSearch = (query: string) => {
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
        registerClick,
        hasResults: results.canciones.length > 0 || results.archive.length > 0 || !!results.canonicalHit
    };
};
