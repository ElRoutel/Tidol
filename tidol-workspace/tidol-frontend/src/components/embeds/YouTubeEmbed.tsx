import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';

interface YouTubeEmbedProps {
    videoId: string;
    autoPlay?: boolean;
    onStateChange?: (state: 'playing' | 'paused' | 'ended' | 'buffering') => void;
    onReady?: () => void;
    onError?: (error: any) => void;
    onTimeUpdate?: (currentTime: number, duration: number) => void;
    className?: string;
}

export interface YouTubeEmbedHandle {
    play: () => void;
    pause: () => void;
    seek: (time: number) => void;
    setVolume: (volume: number) => void;
    getCurrentTime: () => number;
    getDuration: () => number;
}

declare global {
    interface Window {
        YT: any;
        onYouTubeIframeAPIReady: (() => void) | undefined;
    }
}

let ytApiLoaded = false;
let ytApiLoading = false;
const ytApiCallbacks: (() => void)[] = [];

function loadYouTubeAPI(): Promise<void> {
    if (ytApiLoaded) return Promise.resolve();

    return new Promise((resolve) => {
        if (ytApiLoading) {
            ytApiCallbacks.push(resolve);
            return;
        }
        ytApiLoading = true;
        ytApiCallbacks.push(resolve);

        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);

        window.onYouTubeIframeAPIReady = () => {
            ytApiLoaded = true;
            ytApiCallbacks.forEach(cb => cb());
            ytApiCallbacks.length = 0;
        };
    });
}

const YouTubeEmbed = forwardRef<YouTubeEmbedHandle, YouTubeEmbedProps>(({
    videoId,
    autoPlay = false,
    onStateChange,
    onReady,
    onError,
    onTimeUpdate,
    className,
}, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<any>(null);
    const timerRef = useRef<number | null>(null);
    const currentTimeRef = useRef(0);
    const durationRef = useRef(0);

    const startTimeTracking = useCallback(() => {
        if (timerRef.current) return;
        timerRef.current = window.setInterval(() => {
            if (playerRef.current?.getCurrentTime) {
                currentTimeRef.current = playerRef.current.getCurrentTime();
                durationRef.current = playerRef.current.getDuration();
                onTimeUpdate?.(currentTimeRef.current, durationRef.current);
            }
        }, 250);
    }, [onTimeUpdate]);

    const stopTimeTracking = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    useImperativeHandle(ref, () => ({
        play: () => playerRef.current?.playVideo?.(),
        pause: () => playerRef.current?.pauseVideo?.(),
        seek: (time: number) => playerRef.current?.seekTo?.(time, true),
        setVolume: (vol: number) => playerRef.current?.setVolume?.(vol * 100),
        getCurrentTime: () => currentTimeRef.current,
        getDuration: () => durationRef.current,
    }), []);

    useEffect(() => {
        let mounted = true;

        const initPlayer = async () => {
            await loadYouTubeAPI();
            if (!mounted || !containerRef.current) return;

            // Create a unique div for the player
            const playerId = `yt-player-${videoId}-${Date.now()}`;
            const div = document.createElement('div');
            div.id = playerId;
            containerRef.current.innerHTML = '';
            containerRef.current.appendChild(div);

            playerRef.current = new window.YT.Player(playerId, {
                videoId,
                playerVars: {
                    autoplay: autoPlay ? 1 : 0,
                    controls: 0,
                    modestbranding: 1,
                    rel: 0,
                    showinfo: 0,
                    iv_load_policy: 3,
                    origin: window.location.origin,
                },
                events: {
                    onReady: () => {
                        durationRef.current = playerRef.current?.getDuration?.() || 0;
                        onReady?.();
                    },
                    onStateChange: (event: any) => {
                        const stateMap: Record<number, 'playing' | 'paused' | 'ended' | 'buffering'> = {
                            0: 'ended',
                            1: 'playing',
                            2: 'paused',
                            3: 'buffering',
                        };
                        const state = stateMap[event.data];
                        if (state === 'playing') {
                            startTimeTracking();
                        } else {
                            stopTimeTracking();
                        }
                        if (state) onStateChange?.(state);
                    },
                    onError: (event: any) => onError?.(event.data),
                },
            });
        };

        initPlayer();

        return () => {
            mounted = false;
            stopTimeTracking();
            playerRef.current?.destroy?.();
            playerRef.current = null;
        };
    }, [videoId]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div
            ref={containerRef}
            className={className}
            style={{ width: '100%', aspectRatio: '16/9', borderRadius: '12px', overflow: 'hidden' }}
        />
    );
});

YouTubeEmbed.displayName = 'YouTubeEmbed';
export default YouTubeEmbed;
