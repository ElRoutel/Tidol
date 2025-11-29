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
        <div className="flex flex-col gap-12 pb-20 animate-fade-in">

            {/* Volver a escuchar (Listen Again) - Large Cards */}
            {recentListenings && recentListenings.length > 0 && (
                <Shelf title="Volver a escuchar" subtitle={user?.username || 'ROUTEL'}>
                    {recentListenings.map((item, index) => (
                        <ListenAgainCard
                            key={item.id || index}
                            item={item}
                            isActive={isCurrentSong(item)}
                            isPlaying={isSongPlaying(item)}
                            onClick={() => onPlay(item, index, recentListenings)}
                            onPlay={() => onPlay(item, index, recentListenings)}
                        />
                    ))}
                </Shelf>
            )}

            {/* Selección Rápida (Quick Picks) - Grid/List style */}
            {quickSelection && quickSelection.length > 0 && (
                <div className="px-4 md:px-0">
                    <div className="mb-6">
                        <span className="text-[#999] text-xs font-bold uppercase tracking-wider mb-2 block">
                            PARA EMPEZAR
                        </span>
                        <h2 className="text-white text-2xl md:text-3xl font-bold">Selección rápida</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {quickSelection.map((item, index) => (
                            <QuickSelectionCard
                                key={item.id || index}
                                item={item}
                                isActive={isCurrentSong(item)}
                                isPlaying={isSongPlaying(item)}
                                onClick={() => onPlay(item, index, quickSelection)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Recomendaciones - Shelf */}
            {recommendations && recommendations.length > 0 && (
                <Shelf title="Recomendado para ti" subtitle="BASADO EN TUS GUSTOS">
                    {recommendations.map((item, index) => (
                        <ListenAgainCard
                            key={item.id || index}
                            item={item}
                            isActive={isCurrentSong(item)}
                            isPlaying={isSongPlaying(item)}
                            onClick={() => onPlay(item, index, recommendations)}
                            onPlay={() => onPlay(item, index, recommendations)}
                        />
                    ))}
                </Shelf>
            )}

            {/* Álbumes Populares - Shelf */}
            {albums && albums.length > 0 && (
                <Shelf title="Álbumes populares" subtitle="TENDENCIAS">
                    {albums.map((item, index) => (
                        <ListenAgainCard
                            key={item.id || index}
                            item={item}
                            isActive={isCurrentSong(item)}
                            isPlaying={isSongPlaying(item)}
                            onClick={() => navigate(`/album/${item.id}`)}
                        />
                    ))}
                </Shelf>
            )}

            {/* Covers y Remixes - Shelf */}
            {coversRemixes && coversRemixes.length > 0 && (
                <Shelf title="Covers y Remixes" subtitle="DESCUBRIMIENTOS">
                    {coversRemixes.map((item, index) => (
                        <ListenAgainCard
                            key={item.id || index}
                            item={item}
                            isActive={isCurrentSong(item)}
                            isPlaying={isSongPlaying(item)}
                            onClick={() => onPlay(item, index, coversRemixes)}
                        />
                    ))}
                </Shelf>
            )}

            {/* Descubrimientos IA - Shelf */}
            {iaDiscoveries && iaDiscoveries.length > 0 && (
                <Shelf title="Descubrimientos IA" subtitle="INTERNET ARCHIVE">
                    {iaDiscoveries.map((item, index) => (
                        <ListenAgainCard
                            key={item.id || index}
                            item={item}
                            isActive={isCurrentSong(item)}
                            isPlaying={isSongPlaying(item)}
                            onClick={() => onPlay(item, index, iaDiscoveries)}
                        />
                    ))}
                </Shelf>
            )}
        </div>
    );
}
