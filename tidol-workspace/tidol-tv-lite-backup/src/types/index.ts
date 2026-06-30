// tidol-ui/src/types/index.ts

export type PlaybackState = 'STOPPED' | 'PLAYING' | 'PAUSED' | 'LOADING' | 'BUFFERING';

export interface Song {
    id: string | number;
    url: string;
    originalUrl?: string;
    titulo: string;
    artista: string;
    album?: string;
    portada?: string;
    duracion?: number;
    duration?: number;
    source?: 'local' | 'internet_archive' | 'smart_mix';
    identifier?: string;
    isLiked?: boolean;
    cue_in?: number;
    cue_out?: number;
    bpm?: number;
    musical_key?: string;
    extractedColors?: {
        dominant: string;
        vibrant: string;
        muted: string;
    };
}

export interface PlayerState {
    currentSong: Song | null;
    isPlaying: boolean;
    isLoading: boolean;
    volume: number;
    isMuted: boolean;
    currentTime: number;
    duration: number;
    queue: Song[];
    currentIndex: number;
    djMode: boolean;
    voxMode: boolean;
    repeatMode: 'off' | 'all' | 'one';
    isShuffle: boolean;
}

export interface PlayerActions {
    playSongList: (songs: Song[], startIndex?: number) => void;
    togglePlayPause: () => void;
    nextSong: () => void;
    previousSong: () => void;
    seek: (time: number) => void;
    setVolume: (volume: number) => void;
    toggleMute: () => void;
    toggleLike: (songId: string | number, songData?: Song) => Promise<void>;
    addToQueue: (song: Song) => void;
    playNext: (song: Song) => void;
    reorderQueue: (newQueue: Song[]) => void;
}

export interface SpectraData {
    waveform: number[];
    lyrics: any[];
    bpm: number | null;
    key: string | null;
    status: 'idle' | 'loading' | 'ready' | 'error';
}

export interface VoxTracks {
    songId: string | number;
    vocals: string;
    accompaniment: string;
}
