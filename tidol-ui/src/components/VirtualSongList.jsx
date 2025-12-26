import React from 'react';
import { FixedSizeList as List } from 'react-window';
import { IoVolumeHighSharp, IoPauseSharp, IoPlaySharp } from 'react-icons/io5';

const VirtualSongList = ({ songs, onPlay, height = 600, itemSize = 72, currentView, currentSong, isPlaying, handleContextMenu }) => {

    /* Fila de canción renderizada por react-window */
    const Row = ({ index, style }) => {
        const song = songs[index];
        const isCurrent = currentSong?.id === song.id;
        const isPlayingSong = isCurrent && isPlaying;

        return (
            <div
                style={style}
                className={`group flex items-center px-4 hover:bg-white/5 transition-colors rounded-lg mx-2 cursor-pointer ${isCurrent ? 'bg-white/10' : ''
                    }`}
                onClick={() => onPlay(song, index)}
                onContextMenu={(e) => handleContextMenu(e, song)}
            >
                {/* # o Play Icon (W/ Hover Swap) */}
                <div className="w-8 flex justify-center text-sm tabular-nums text-white/40 font-medium">
                    <span className={`block group-hover:hidden ${isCurrent ? 'text-[#1db954]' : ''}`}>
                        {isCurrent && isPlaying ? <IoVolumeHighSharp size={16} className="animate-pulse" /> : index + 1}
                    </span>
                    <button
                        className="hidden group-hover:flex text-white hover:scale-110 transition-transform"
                        onClick={(e) => {
                            e.stopPropagation();
                            onPlay(song, index);
                        }}
                    >
                        {isPlayingSong ? <IoPauseSharp size={16} /> : <IoPlaySharp size={16} />}
                    </button>
                </div>

                {/* Título y Artista */}
                <div className="flex-1 min-w-0 pr-4 flex items-center gap-3">
                    <img
                        src={song.coverThumb || song.portada}
                        className="w-10 h-10 rounded shadow-sm object-cover bg-white/5"
                        loading="lazy"
                        decoding="async"
                        alt=""
                    />
                    <div className="flex flex-col min-w-0">
                        <span className={`truncate text-[15px] font-medium leading-tight ${isCurrent ? 'text-[#1db954]' : 'text-white/90'
                            }`}>
                            {song.titulo}
                        </span>
                        <span className="truncate text-[13px] text-white/50 group-hover:text-white/70 transition-colors">
                            {song.artista}
                        </span>
                    </div>
                </div>

                {/* Álbum (Desktop) */}
                <div className="hidden md:block w-1/3 min-w-[150px] truncate text-sm text-white/50 group-hover:text-white/70 transition-colors px-2">
                    {song.album}
                </div>

                {/* Duración */}
                <div className="w-16 text-right text-sm tabular-nums text-white/40 font-variant-numeric">
                    {song.duracion}
                </div>
            </div>
        );
    };
    return (
        <List
            height={height}
            itemCount={songs.length}
            itemSize={itemSize}
            width={'100%'}
            overscanCount={5}
        >
            {Row}
        </List>
    );
};

export default VirtualSongList;
