// src/hooks/useKaraokeSync.ts
import { useEffect, useRef, useState } from 'react';
import { usePlayer } from '../context/PlayerContext';

export interface KaraokeWord {
    word: string;
    start_cs: number; // centiseconds
    end_cs: number;   // centiseconds
}

/**
 * Hook for 60fps lyric word-level synchronization using requestAnimationFrame.
 * Avoids React re-render flooding by only updating state when the active word index changes.
 */
export function useKaraokeSync(words: KaraokeWord[]) {
    const { engine, isPlaying } = usePlayer();
    const [activeIndex, setActiveIndex] = useState<number>(-1);
    const activeIndexRef = useRef<number>(-1);
    const rafRef = useRef<number | null>(null);

    useEffect(() => {
        if (!words || words.length === 0) {
            setActiveIndex(-1);
            activeIndexRef.current = -1;
            return;
        }

        const checkSync = () => {
            if (!engine) return;

            const timeSeconds = engine.getCurrentTime();
            const timeCs = Math.floor(timeSeconds * 100);

            let currentWordIndex = -1;

            // Find matching word
            for (let i = 0; i < words.length; i++) {
                const w = words[i];
                if (timeCs >= w.start_cs && timeCs <= w.end_cs) {
                    currentWordIndex = i;
                    break;
                }
            }

            // Fallback: if in between words, highlight the last played word
            if (currentWordIndex === -1) {
                for (let i = 0; i < words.length; i++) {
                    if (timeCs >= words[i].end_cs) {
                        currentWordIndex = i;
                    } else {
                        break;
                    }
                }
            }

            // Only trigger React state update if the index actually changes
            if (currentWordIndex !== activeIndexRef.current) {
                activeIndexRef.current = currentWordIndex;
                setActiveIndex(currentWordIndex);
            }

            rafRef.current = requestAnimationFrame(checkSync);
        };

        if (isPlaying) {
            rafRef.current = requestAnimationFrame(checkSync);
        } else {
            // Run once to sync positioning when paused or seeking
            checkSync();
        }

        return () => {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
            }
        };
    }, [words, isPlaying, engine]);

    return activeIndex;
}
