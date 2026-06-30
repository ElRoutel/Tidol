// src/pages/SearchPage.tsx
import { usePlayer } from '../context/PlayerContext';
import { useSearch } from '../hooks/useSearch';
import SearchInput from '../components/SearchInput';
import UniversalCard from '../components/cards/UniversalCard';
import ArtistCard from '../components/cards/ArtistCard';
import { IoTimeOutline, IoCloseOutline, IoPlaySharp } from 'react-icons/io5';
import { UnifiedTrack } from '../types/music';
import '../styles/glass.css';
import './search.css';

export function SearchPage() {
    const {
        query,
        loading,
        results,
        searchHistory,
        handleSearch,
        removeFromHistory,
        registerClick,
        hasResults
    } = useSearch();

    const { playSongList } = usePlayer();

    const showHistory = !query && searchHistory.length > 0;

    const handlePlaySong = (songs: UnifiedTrack[], index: number) => {
        const song = songs[index];
        registerClick(song);
        playSongList(songs, index);
    };

    const handlePlaySingle = (song: UnifiedTrack) => {
        registerClick(song);
        playSongList([song], 0);
    };

    return (
        <div className="search-page pb-24">
            <div className="search-header glass-card">
                <SearchInput onSearch={handleSearch} loading={loading} initialValue={query} />
            </div>

            {showHistory && (
                <div className="mt-5 px-2">
                    <h3 className="text-sm text-gray-400 mb-3 font-semibold pl-1">Búsquedas recientes</h3>
                    <div className="flex flex-col gap-2">
                        {searchHistory.map((term, index) => (
                            <div
                                key={index}
                                className="flex justify-between items-center p-3 cursor-pointer rounded-lg hover:bg-white/10 transition-colors glass-card"
                                onClick={() => handleSearch(term)}
                            >
                                <div className="flex items-center gap-3">
                                    <IoTimeOutline className="text-lg text-gray-400" />
                                    <span className="text-white text-sm">{term}</span>
                                </div>
                                <button
                                    className="text-gray-400 hover:text-red-400 p-1 rounded-full hover:bg-white/5 transition-colors"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeFromHistory(term);
                                    }}
                                >
                                    <IoCloseOutline size={20} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {!query && searchHistory.length === 0 && (
                <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8 glass-card rounded-2xl mt-10">
                    <div className="text-6xl mb-6 animate-bounce">🔍</div>
                    <h2 className="text-2xl font-bold text-white mb-2">Descubre tu música</h2>
                    <p className="text-gray-400 text-lg">Busca canciones, álbumes y artistas.</p>
                </div>
            )}

            {!loading && query && !hasResults && (
                <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8 glass-card rounded-2xl mt-10">
                    <div className="text-6xl mb-6">😕</div>
                    <h2 className="text-2xl font-bold text-white mb-2">No encontramos "{query}"</h2>
                    <p className="text-gray-400 text-lg">Verifica que la canción esté en el catálogo o escribe otro término.</p>
                </div>
            )}

            <div className="flex flex-col mt-8">
                {/* 1. Mejor Resultado (Canonical Hit) */}
                {!loading && results.canonicalHit && (
                    <div className="animate-fade-in mb-8">
                        <div className="mb-4 px-4 py-2 glass-card rounded-xl inline-block">
                            <h2 className="text-sm font-bold text-primary uppercase tracking-wider">Mejor resultado</h2>
                        </div>
                        <div 
                            onClick={() => handlePlaySingle(results.canonicalHit!)}
                            className="flex flex-col sm:flex-row items-center gap-6 p-6 rounded-2xl glass-card hover:bg-white/10 transition-all cursor-pointer group max-w-2xl"
                        >
                            <img 
                                src={results.canonicalHit.attributes?.artwork?.url || '/default_cover.png'} 
                                alt={results.canonicalHit.attributes?.name} 
                                className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl object-cover shadow-lg group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="flex-1 text-center sm:text-left min-w-0">
                                <h3 className="text-xl sm:text-2xl font-bold text-white truncate group-hover:text-primary transition-colors">
                                    {results.canonicalHit.attributes?.name}
                                </h3>
                                <p className="text-gray-400 text-sm sm:text-base mt-1 truncate">
                                    {results.canonicalHit.attributes?.artistName}
                                </p>
                                <div className="flex gap-2 mt-4 justify-center sm:justify-start">
                                    {results.canonicalHit.attributes?.hasLyrics && (
                                        <span className="px-2 py-0.5 bg-primary/20 text-primary text-[10px] font-bold rounded uppercase tracking-wider">
                                            Letras IA
                                        </span>
                                    )}
                                    {results.canonicalHit.sourceType === 'local' && (
                                        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-[10px] font-bold rounded uppercase tracking-wider">
                                            En Biblioteca
                                        </span>
                                    )}
                                </div>
                            </div>
                            <button className="p-4 rounded-full bg-primary text-black hover:scale-110 active:scale-95 transition-transform duration-200">
                                <IoPlaySharp size={24} />
                            </button>
                        </div>
                    </div>
                )}

                {/* 1.5 Artists */}
                {!loading && results.artists && results.artists.length > 0 && (
                    <div className="animate-fade-in mb-10">
                        <div className="mb-5 px-4 py-2 glass-card rounded-xl inline-block">
                            <h2 className="text-lg font-bold text-white">Artistas</h2>
                        </div>
                        <div className="flex flex-wrap gap-6">
                            {results.artists.map((artist) => (
                                <ArtistCard
                                    key={artist.mbid}
                                    mbid={artist.mbid}
                                    name={artist.name}
                                    coverUrl={artist.coverUrl}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* 2. Canciones Locales */}
                {!loading && results.canciones.length > 0 && (
                    <div className="animate-fade-in mb-10">
                        <div className="mb-5 px-4 py-2 glass-card rounded-xl inline-block">
                            <h2 className="text-lg font-bold text-white">Canciones en Biblioteca</h2>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {results.canciones.map((song, index) => (
                                <UniversalCard
                                    key={song.id}
                                    data={song}
                                    type="song"
                                    variant="shelf"
                                    onPlay={() => handlePlaySong(results.canciones, index)}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* 3. Internet Archive */}
                {!loading && results.archive.length > 0 && (
                    <div className="animate-fade-in mb-10">
                        <div className="mb-5 px-4 py-2 glass-card rounded-xl inline-block">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                Providers 🌐
                            </h2>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {results.archive.map((song, index) => (
                                <UniversalCard
                                    key={song.id}
                                    data={song}
                                    type="song"
                                    variant="shelf"
                                    onPlay={() => handlePlaySong(results.archive, index)}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
