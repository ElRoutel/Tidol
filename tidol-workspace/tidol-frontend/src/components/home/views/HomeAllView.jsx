import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../../../context/PlayerContext';
import { useAuth } from '../../../context/AuthContext';
import api from '../../../api/axiosConfig';
import Shelf from '../../Shelf';
import QuickSelectionCard from '../../cards/QuickSelectionCard';
import ListenAgainCard from '../../cards/ListenAgainCard';

export const normalizeToUnifiedTrack = (rawTrack) => ({
    trackId: rawTrack.mbid || rawTrack.track_id || rawTrack.id,
    trackName: rawTrack.title || rawTrack.name || rawTrack.trackName || 'Desconocido',
    artistName: rawTrack.artist || rawTrack.artista || rawTrack.artistName || 'Desconocido',
    coverArtUrl: rawTrack.coverUrl || rawTrack.cover_url || rawTrack.artworkUrl || '/default-album.png',
    sourceType: 'heavy_rotation',
    raw: rawTrack 
});

export default function HomeAllView({ data, onPlay }) {
    const { quickSelection, recommendations, albums, coversRemixes, iaDiscoveries } = data || {};
    const { currentSong, isPlaying } = usePlayer();
    const { user } = useAuth();
    const navigate = useNavigate();

    // Estado aislado para Volver a escuchar (Heavy Rotation)
    const [heavyRotation, setHeavyRotation] = useState([]);
    const [loadingRotation, setLoadingRotation] = useState(true);

    useEffect(() => {
        api.get('/tracks/listen-again')
            .then(res => {
                // Mapear los datos de Rust a la interfaz del UI
                const mapped = (res.data || []).map(t => ({
                    ...t,
                    id: t.track_id || t.mbid,
                    title: t.title,
                    name: t.title,
                    artist: t.artist,
                    artista: t.artist,
                    artistName: t.artist,
                    artworkUrl: t.coverUrl || t.cover_url || '/default-album.png',
                    image: t.coverUrl || t.cover_url || '/default-album.png',
                    type: 'track'
                }));
                setHeavyRotation(mapped);
                setLoadingRotation(false);
            })
            .catch(err => {
                console.error("Error al cargar Heavy Rotation:", err);
                setLoadingRotation(false);
            });
    }, []);

    const { playSongList } = usePlayer();

    const handlePlayListenAgain = (clickedIndex) => {
        const normalizedQueue = heavyRotation.map(normalizeToUnifiedTrack);
        // Enviamos la cola completa al contexto y empezamos en el índice clickeado
        // Cortamos el array desde el índice para simular el comportamiento de la Home
        playSongList(normalizedQueue.slice(clickedIndex), 0);
    };

    const isCurrentSong = (item) => {
        if (!currentSong || !item) return false;
        const curId = String(currentSong.id).replace('ia_', '');
        const itemId = String(item.id || item.identifier || '').replace('ia_', '');
        return curId === itemId;
    };
    const isSongPlaying = (item) => isCurrentSong(item) && isPlaying;

    return (
        <div className="flex flex-col gap-16 pb-32 animate-fade-in w-full max-w-[100vw] overflow-x-hidden">

            {/* Sección 1: Selección Rápida (Glass Cards) */}
            {quickSelection && quickSelection.length > 0 && (
                <section className="px-4 md:px-0 mt-8">
                    <div className="mb-6 px-4 md:px-0">
                        <span className="text-white/40 text-xs font-bold uppercase tracking-wider mb-2 block font-mono">
                            PARA EMPEZAR
                        </span>
                        <h2 className="text-white text-2xl md:text-3xl font-bold tracking-tight">Selección rápida</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 px-4 md:px-0">
                        {quickSelection.map((item, index) => (
                            <QuickSelectionCard
                                key={`${item.id}-${index}`}
                                item={item}
                                isActive={isCurrentSong(item)}
                                isPlaying={isSongPlaying(item)}
                                onClick={() => onPlay(item, index, quickSelection)}
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* Sección 2: Volver a escuchar (Endpoint Dedicado) */}
            {!loadingRotation && heavyRotation.length > 0 && (
                <section className="px-4 md:px-0">
                    <Shelf title="Volver a escuchar" subtitle={user?.username || 'HEAVY ROTATION'}>
                        {heavyRotation.map((item, index) => (
                            <ListenAgainCard
                                key={`heavy-${item.id}-${index}`}
                                item={item}
                                isActive={isCurrentSong(item)}
                                isPlaying={isSongPlaying(item)}
                                onClick={() => handlePlayListenAgain(index)}
                                onPlay={() => handlePlayListenAgain(index)}
                            />
                        ))}
                    </Shelf>
                </section>
            )}

            {/* Sección 3: Recomendaciones */}
            {recommendations && recommendations.length > 0 && (
                <section className="px-4 md:px-0">
                    <Shelf title="Recomendado para ti" subtitle="BASADO EN TUS GUSTOS">
                        {recommendations.map((item, index) => (
                            <ListenAgainCard
                                key={`${item.id}-${index}`}
                                item={item}
                                isActive={isCurrentSong(item)}
                                isPlaying={isSongPlaying(item)}
                                onClick={() => onPlay(item, index, recommendations)}
                                onPlay={() => onPlay(item, index, recommendations)}
                            />
                        ))}
                    </Shelf>
                </section>
            )}

            {/* Sección 4: Álbumes Populares */}
            {albums && albums.length > 0 && (
                <section className="px-4 md:px-0">
                    <Shelf title="Álbumes populares" subtitle="TENDENCIAS">
                        {albums.map((item, index) => (
                            <ListenAgainCard
                                key={`${item.id}-${index}`}
                                item={item}
                                isActive={String(currentSong?.albumId) === String(item.id)}
                                isPlaying={String(currentSong?.albumId) === String(item.id) && isPlaying}
                                onClick={() => navigate(`/album/${item.id}`)}
                            />
                        ))}
                    </Shelf>
                </section>
            )}

            {/* Sección 5: Covers y Remixes */}
            {coversRemixes && coversRemixes.length > 0 && (
                <section className="px-4 md:px-0">
                    <Shelf title="Covers y Remixes" subtitle="DESCUBRIMIENTOS">
                        {coversRemixes.map((item, index) => (
                            <ListenAgainCard
                                key={`${item.id}-${index}`}
                                item={item}
                                isActive={isCurrentSong(item)}
                                isPlaying={isSongPlaying(item)}
                                onClick={() => onPlay(item, index, coversRemixes)}
                            />
                        ))}
                    </Shelf>
                </section>
            )}

            {/* Sección 6: Descubrimientos IA */}
            {iaDiscoveries && iaDiscoveries.length > 0 && (
                <section className="px-4 md:px-0">
                    <Shelf title="Descubrimientos IA" subtitle="INTERNET ARCHIVE">
                        {iaDiscoveries.map((item, index) => (
                            <ListenAgainCard
                                key={`${item.id}-${index}`}
                                item={item}
                                isActive={isCurrentSong(item)}
                                isPlaying={isSongPlaying(item)}
                                onClick={() => navigate(`/ia-album/${item.identifier || item.id}`)}
                            />
                        ))}
                    </Shelf>
                </section>
            )}
        </div>
    );
}
