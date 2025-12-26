import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../../../context/PlayerContext';
import { useAuth } from '../../../context/AuthContext';
import Shelf from '../../Shelf';
import QuickSelectionCard from '../../cards/QuickSelectionCard';
import ListenAgainCard from '../../cards/ListenAgainCard';

export default function HomeAllView({ data, onPlay }) {
    const { recentListenings, quickSelection, recommendations, albums, coversRemixes, iaDiscoveries } = data || {};
    const { currentSong, isPlaying } = usePlayer();
    const { user } = useAuth();
    const navigate = useNavigate();

    const isCurrentSong = (item) => currentSong?.id === item.id;
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

            {/* Sección 2: Volver a escuchar */}
            {recentListenings && recentListenings.length > 0 && (
                <section className="px-4 md:px-0">
                    <Shelf title="Volver a escuchar" subtitle={user?.username || 'ROUTEL'}>
                        {recentListenings.map((item, index) => (
                            <ListenAgainCard
                                key={`${item.id}-${index}`}
                                item={item}
                                isActive={isCurrentSong(item)}
                                isPlaying={isSongPlaying(item)}
                                onClick={() => onPlay(item, index, recentListenings)}
                                onPlay={() => onPlay(item, index, recentListenings)}
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
                                isActive={isCurrentSong(item)}
                                isPlaying={isSongPlaying(item)}
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
                                isActive={false}
                                isPlaying={false}
                                onClick={() => navigate(`/ia-album/${item.identifier || item.id}`)}
                            />
                        ))}
                    </Shelf>
                </section>
            )}
        </div>
    );
}
