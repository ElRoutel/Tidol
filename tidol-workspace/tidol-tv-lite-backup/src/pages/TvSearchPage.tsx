import { useEffect, useRef, useState } from 'react';
import { useSearch } from '../hooks/useSearch';
import { usePlayer } from '../context/PlayerContext';
import { UnifiedTrack } from '../types/music';

export default function TvSearchPage() {
    const {
        query,
        loading,
        results,
        handleSearch,
        registerClick,
        hasResults
    } = useSearch();

    const { playSongList, setIsFullScreenOpen } = usePlayer();
    const [inputValue, setInputValue] = useState(query);
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-focus input on mount if empty
    useEffect(() => {
        if (!query && inputRef.current) {
            inputRef.current.focus();
        }
    }, [query]);

    const handlePlaySong = (songs: UnifiedTrack[], index: number) => {
        const song = songs[index];
        registerClick(song);
        playSongList(songs, index);
        setIsFullScreenOpen(true);
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSearch(inputValue);
            // Move focus down to results if any
            setTimeout(() => {
                const firstResult = document.querySelector('.tv-search-result') as HTMLElement;
                if (firstResult) firstResult.focus();
            }, 500);
        }
    };

    return (
        <div className="space-y-16 pb-32">
            <h1 className="text-6xl font-extrabold mb-8">Buscar</h1>
            
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Escribe y presiona Enter..."
                    className="w-full bg-neutral-900 text-white text-4xl p-8 rounded-full focus:outline-none focus:ring-[6px] focus:ring-white transition-all shadow-xl"
                    tabIndex={0}
                />
            </div>

            {loading && <div className="text-4xl text-neutral-400 mt-12 text-center">Buscando...</div>}

            {!loading && !hasResults && query && (
                <div className="text-4xl text-neutral-400 mt-12 text-center">No se encontraron resultados para "{query}"</div>
            )}

            {!loading && hasResults && (
                <div className="space-y-16 mt-12">
                    {/* Artistas */}
                    {results.artists && results.artists.length > 0 && (
                        <section>
                            <h2 className="text-4xl font-bold mb-8">Artistas</h2>
                            <div className="flex overflow-x-auto snap-x snap-mandatory gap-8 pb-8" style={{ scrollbarWidth: 'none' }}>
                                {results.artists.map((artist) => (
                                    <div
                                        key={artist.mbid}
                                        tabIndex={0}
                                        className="tv-search-result snap-start flex-none w-[320px] text-center bg-neutral-900 rounded-[32px] p-8 cursor-pointer focus:outline-none focus:ring-[6px] focus:ring-white focus:bg-neutral-800 focus:scale-105 transition-all"
                                    >
                                        <img
                                            src={artist.coverUrl || '/default-artist.png'}
                                            className="w-full aspect-square object-cover rounded-full shadow-2xl mb-6"
                                            alt={artist.name}
                                        />
                                        <h3 className="text-[32px] leading-tight font-bold truncate text-white">{artist.name}</h3>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Canciones Locales */}
                    {results.canciones && results.canciones.length > 0 && (
                        <section>
                            <h2 className="text-4xl font-bold mb-8">Biblioteca</h2>
                            <div className="flex overflow-x-auto snap-x snap-mandatory gap-8 pb-8" style={{ scrollbarWidth: 'none' }}>
                                {results.canciones.map((song, idx) => (
                                    <div
                                        key={song.id}
                                        tabIndex={0}
                                        onClick={() => handlePlaySong(results.canciones, idx)}
                                        className="tv-search-result snap-start flex-none w-[360px] bg-neutral-900 rounded-[32px] p-8 cursor-pointer focus:outline-none focus:ring-[6px] focus:ring-white focus:bg-neutral-800 focus:scale-105 transition-all"
                                    >
                                        <img
                                            src={song.attributes?.artwork?.url || '/default-album.png'}
                                            className="w-full aspect-square object-cover rounded-2xl shadow-2xl mb-6"
                                            alt={song.attributes?.name}
                                        />
                                        <h3 className="text-[32px] leading-tight font-bold truncate text-white mb-2">{song.attributes?.name}</h3>
                                        <p className="text-[24px] text-neutral-400 truncate">{song.attributes?.artistName}</p>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Archive */}
                    {results.archive && results.archive.length > 0 && (
                        <section>
                            <h2 className="text-4xl font-bold mb-8">Internet Archive</h2>
                            <div className="flex overflow-x-auto snap-x snap-mandatory gap-8 pb-8" style={{ scrollbarWidth: 'none' }}>
                                {results.archive.map((song, idx) => (
                                    <div
                                        key={song.id}
                                        tabIndex={0}
                                        onClick={() => handlePlaySong(results.archive, idx)}
                                        className="tv-search-result snap-start flex-none w-[360px] bg-neutral-900 rounded-[32px] p-8 cursor-pointer focus:outline-none focus:ring-[6px] focus:ring-white focus:bg-neutral-800 focus:scale-105 transition-all"
                                    >
                                        <img
                                            src={song.attributes?.artwork?.url || '/default-album.png'}
                                            className="w-full aspect-square object-cover rounded-2xl shadow-2xl mb-6"
                                            alt={song.attributes?.name}
                                        />
                                        <h3 className="text-[32px] leading-tight font-bold truncate text-white mb-2">{song.attributes?.name}</h3>
                                        <p className="text-[24px] text-neutral-400 truncate">{song.attributes?.artistName}</p>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            )}
        </div>
    );
}
