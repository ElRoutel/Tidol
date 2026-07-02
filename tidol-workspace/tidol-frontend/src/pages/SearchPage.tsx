// src/pages/SearchPage.tsx
import { usePlayer } from '../context/PlayerContext';
import { useSearch } from '../hooks/useSearch';
import SearchInput from '../components/SearchInput';
import UniversalCard from '../components/cards/UniversalCard';
import ArtistCard from '../components/cards/ArtistCard';
import { IoTimeOutline, IoCloseOutline, IoPlaySharp, IoSearchOutline } from 'react-icons/io5';
import { UnifiedTrack } from '../types/music';
import '../styles/glass.css';
import './search.css';

// Header de sección unificado con Home: eyebrow en tracking alto + título.
function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
    return (
        <div className="mb-5">
            <span className="text-white/40 text-[11px] font-bold uppercase tracking-[1.4px] mb-1.5 block">
                {eyebrow}
            </span>
            <h2 className="text-white text-2xl md:text-3xl font-bold tracking-tight">{title}</h2>
        </div>
    );
}

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
        <div className="search-page pb-28 pt-16 md:pt-20">
            <div className="max-w-[1400px] mx-auto">

                {/* Cabecera */}
                <div className="mb-8 max-w-3xl">
                    <span className="text-white/40 text-[11px] font-bold uppercase tracking-[1.4px] mb-2 block">
                        Catálogo de Tidol
                    </span>
                    <h1 className="text-white text-3xl md:text-4xl font-bold tracking-tight mb-6">Buscar</h1>
                    <SearchInput onSearch={handleSearch} loading={loading} initialValue={query} />
                </div>

                {/* Búsquedas recientes: chips, no filas apiladas */}
                {showHistory && (
                    <div className="mb-12">
                        <span className="text-white/40 text-[11px] font-bold uppercase tracking-[1.4px] mb-3 block">
                            Búsquedas recientes
                        </span>
                        <div className="flex flex-wrap gap-2.5">
                            {searchHistory.map((term: string, index: number) => (
                                <div
                                    key={index}
                                    className="group flex items-center gap-1 pl-4 pr-2 py-2 rounded-full bg-white/[0.06] border border-white/10 hover:bg-white/[0.12] hover:border-white/20 cursor-pointer transition-colors"
                                    onClick={() => handleSearch(term)}
                                >
                                    <IoTimeOutline className="text-white/40 mr-1.5" size={15} />
                                    <span className="text-white text-sm font-medium">{term}</span>
                                    <button
                                        className="ml-1 p-1 rounded-full text-white/35 hover:text-white hover:bg-white/10 transition-colors"
                                        aria-label={`Quitar "${term}" del historial`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            removeFromHistory(term);
                                        }}
                                    >
                                        <IoCloseOutline size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Estado inicial */}
                {!query && searchHistory.length === 0 && (
                    <div className="flex flex-col items-center justify-center min-h-[360px] text-center px-8">
                        <div className="w-16 h-16 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center mb-6">
                            <IoSearchOutline size={26} className="text-white/50" />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-1.5">Encuentra tu próxima canción</h2>
                        <p className="text-white/45 text-[15px] max-w-sm">
                            Busca por título, artista o álbum. Los resultados llegan del catálogo global de MusicBrainz.
                        </p>
                    </div>
                )}

                {/* Sin resultados */}
                {!loading && query && !hasResults && (
                    <div className="flex flex-col items-center justify-center min-h-[360px] text-center px-8">
                        <h2 className="text-xl font-bold text-white mb-1.5">Nada para "{query}"</h2>
                        <p className="text-white/45 text-[15px] max-w-sm">
                            Revisa la ortografía o prueba con el nombre del artista.
                        </p>
                    </div>
                )}

                <div className="flex flex-col">
                    {/* 1. Mejor resultado */}
                    {!loading && results.canonicalHit && (
                        <div className="animate-fade-in mb-12">
                            <SectionHeader eyebrow="Coincidencia principal" title="Mejor resultado" />
                            <div
                                onClick={() => handlePlaySingle(results.canonicalHit!)}
                                className="group relative flex items-center gap-5 md:gap-7 p-5 md:p-6 rounded-2xl bg-white/[0.05] border border-white/10 hover:bg-white/[0.09] hover:border-white/20 transition-all cursor-pointer max-w-2xl overflow-hidden"
                            >
                                <img
                                    src={results.canonicalHit.attributes?.artwork?.url || '/default-album.png'}
                                    alt=""
                                    onError={(e) => { e.currentTarget.src = '/default-album.png'; }}
                                    className="w-24 h-24 md:w-28 md:h-28 rounded-xl object-cover shadow-[0_16px_40px_-8px_rgba(0,0,0,.6)] group-hover:scale-[1.03] transition-transform duration-300 shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-xl md:text-2xl font-bold tracking-tight text-white truncate">
                                        {results.canonicalHit.attributes?.name}
                                    </h3>
                                    <p className="text-white/55 text-sm md:text-base mt-0.5 truncate">
                                        {results.canonicalHit.attributes?.artistName}
                                    </p>
                                    <div className="flex gap-2 mt-3">
                                        <span className="px-2.5 py-1 bg-white/10 text-white/70 text-[10px] font-bold rounded-full uppercase tracking-[1px]">
                                            Canción
                                        </span>
                                        {results.canonicalHit.attributes?.hasLyrics && (
                                            <span className="px-2.5 py-1 bg-white/10 text-white/70 text-[10px] font-bold rounded-full uppercase tracking-[1px]">
                                                Letra
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button
                                    className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center shrink-0 shadow-lg opacity-90 group-hover:opacity-100 group-hover:scale-105 active:scale-95 transition-all"
                                    aria-label="Reproducir mejor resultado"
                                >
                                    <IoPlaySharp size={24} className="ml-0.5" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 2. Artistas */}
                    {!loading && results.artists && results.artists.length > 0 && (
                        <div className="animate-fade-in mb-12">
                            <SectionHeader eyebrow="Perfiles" title="Artistas" />
                            <div className="flex gap-6 overflow-x-auto no-scrollbar pb-2">
                                {results.artists.map((artist: any) => (
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

                    {/* 3. Canciones en biblioteca */}
                    {!loading && results.canciones.length > 0 && (
                        <div className="animate-fade-in mb-12">
                            <SectionHeader eyebrow="Tu música" title="En tu biblioteca" />
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {results.canciones.map((song: UnifiedTrack, index: number) => (
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

                    {/* 4. Catálogo global */}
                    {!loading && results.archive.length > 0 && (
                        <div className="animate-fade-in mb-12">
                            <SectionHeader eyebrow="Catálogo global" title="Canciones" />
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {results.archive.map((song: UnifiedTrack, index: number) => (
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
        </div>
    );
}
