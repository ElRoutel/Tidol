import { useRef, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';

interface ArchiveAudioProps {
    /** Direct audio URL from Internet Archive (legal — CC/public domain content) */
    audioUrl: string;
    /** Fallback: IA embed URL */
    embedUrl?: string;
    autoPlay?: boolean;
    onStateChange?: (state: 'playing' | 'paused' | 'ended' | 'loading') => void;
    onTimeUpdate?: (currentTime: number, duration: number) => void;
    onError?: (error: any) => void;
    className?: string;
}

export interface ArchiveAudioHandle {
    play: () => void;
    pause: () => void;
    seek: (time: number) => void;
    setVolume: (volume: number) => void;
    getCurrentTime: () => number;
    getDuration: () => number;
}

/**
 * Internet Archive audio player using native <audio> element.
 * Direct streaming IS legal because all IA content in our collections
 * is under Creative Commons or public domain licenses.
 */
const ArchiveAudio = forwardRef<ArchiveAudioHandle, ArchiveAudioProps>(({
    audioUrl,
    embedUrl,
    autoPlay = false,
    onStateChange,
    onTimeUpdate,
    onError,
    className,
}, ref) => {
    const audioRef = useRef<HTMLAudioElement>(null);

    useImperativeHandle(ref, () => ({
        play: () => audioRef.current?.play(),
        pause: () => audioRef.current?.pause(),
        seek: (time: number) => {
            if (audioRef.current) audioRef.current.currentTime = time;
        },
        setVolume: (volume: number) => {
            if (audioRef.current) audioRef.current.volume = Math.max(0, Math.min(1, volume));
        },
        getCurrentTime: () => audioRef.current?.currentTime ?? 0,
        getDuration: () => audioRef.current?.duration ?? 0,
    }), []);

    const handleTimeUpdate = useCallback(() => {
        if (audioRef.current) {
            onTimeUpdate?.(audioRef.current.currentTime, audioRef.current.duration || 0);
        }
    }, [onTimeUpdate]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const onPlay = () => onStateChange?.('playing');
        const onPause = () => onStateChange?.('paused');
        const onEnded = () => onStateChange?.('ended');
        const onWaiting = () => onStateChange?.('loading');
        const onErr = () => onError?.(audio.error);

        audio.addEventListener('play', onPlay);
        audio.addEventListener('pause', onPause);
        audio.addEventListener('ended', onEnded);
        audio.addEventListener('waiting', onWaiting);
        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('error', onErr);

        return () => {
            audio.removeEventListener('play', onPlay);
            audio.removeEventListener('pause', onPause);
            audio.removeEventListener('ended', onEnded);
            audio.removeEventListener('waiting', onWaiting);
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('error', onErr);
        };
    }, [handleTimeUpdate, onStateChange, onError]);

    // If no direct audio URL, fall back to IA embed
    if (!audioUrl && embedUrl) {
        return (
            <iframe
                src={embedUrl}
                width="100%"
                height="80"
                frameBorder="0"
                className={className}
                style={{ borderRadius: '12px', border: 'none' }}
                title="Internet Archive Player"
            />
        );
    }

    return (
        <audio
            ref={audioRef}
            src={audioUrl}
            autoPlay={autoPlay}
            preload="auto"
            crossOrigin="anonymous"
            className={className}
            style={{ display: 'none' }}
        />
    );
});

ArchiveAudio.displayName = 'ArchiveAudio';
export default ArchiveAudio;
