import React, { useRef, useEffect, useState } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { motion, AnimatePresence } from 'framer-motion';
import useSpectraSync from '../hooks/useSpectraSync';
import './FullScreenPlayerLyrics.css';

// Force Refresh
export function LyricsView({ desktopMode = false }) {
    const { currentTime, currentSong, seek } = usePlayer();
    const { fetchLyrics } = useSpectraSync();
    const [lyrics, setLyrics] = useState([]);
    const [loading, setLoading] = useState(false);
    const containerRef = useRef(null);

    // Fetch Lyrics Logic
    useEffect(() => {
        let mounted = true;
        let timer = null;

        // Backoff intervals in seconds (0 = immediate, then 10s, 30s, 60s, 180s cap)
        const intervals = [0, 10, 30, 60, 180];
        let attempt = 0;

        const doAttempt = async () => {
            if (!mounted) return;
            setLoading(true);
            try {
                // First attempt triggers generation; subsequent attempts skip generation to only poll
                const skipGeneration = attempt > 0;
                const data = await fetchLyrics(skipGeneration);

                if (mounted && Array.isArray(data) && data.length > 0) {
                    setLyrics(data);
                    setLoading(false);
                    return; // Stop polling when lyrics are present
                }

                // If no lyrics but fetch succeeded with empty array, schedule next attempt
                attempt = Math.min(attempt + 1, intervals.length - 1);
                timer = setTimeout(doAttempt, intervals[attempt] * 1000);
            } catch (err) {
                if (err && err.isNotFound) {
                    // Lyrics not ready yet — schedule next attempt
                    attempt = Math.min(attempt + 1, intervals.length - 1);
                    timer = setTimeout(doAttempt, intervals[attempt] * 1000);
                } else {
                    console.error('Lyrics Error:', err);
                    // For fatal errors, do not keep polling aggressively; try again after max interval
                    attempt = Math.min(attempt + 1, intervals.length - 1);
                    timer = setTimeout(doAttempt, intervals[attempt] * 1000);
                }
            } finally {
                if (mounted) setLoading(false);
            }
        };

        if (currentSong?.id) {
            // Reset
            setLyrics([]);
            attempt = 0;
            doAttempt();
        }

        return () => {
            mounted = false;
            if (timer) clearTimeout(timer);
        };
    }, [currentSong?.id]);

    // Find Active Line
    const activeIndex = lyrics.findIndex((line, i) => {
        const nextLine = lyrics[i + 1];
        return currentTime >= line.time && (!nextLine || currentTime < nextLine.time);
    });

    // Auto Scroll
    useEffect(() => {
        if (activeIndex !== -1 && containerRef.current) {
            const activeEl = containerRef.current.children[activeIndex];
            if (activeEl) {
                activeEl.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                });
            }
        }
    }, [activeIndex]);

    // Loading State
    if (loading && lyrics.length === 0) {
        return (
            <div className="w-full h-full flex items-center justify-center text-white/50 animate-pulse">
                <p>Sincronizando letras...</p>
            </div>
        );
    }

    // Empty State
    if (!loading && lyrics.length === 0) {
        return (
            <div className="w-full h-full flex items-center justify-center text-white/30">
                <p>Letra no disponible</p>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className={`w-full h-full overflow-y-auto no-scrollbar py-[50vh] ${desktopMode ? 'px-8' : 'px-4'}`}
            style={{
                background: 'transparent', // FORCE TRANSPARENCY
                scrollBehavior: 'smooth',
                maskImage: 'linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%)'
            }}
        >
            {lyrics.map((line, index) => {
                const isActive = index === activeIndex;
                return (
                    <motion.p
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{
                            opacity: isActive ? 1 : 0.3,
                            y: 0,
                            scale: isActive ? 1.05 : 1,
                            filter: isActive ? 'blur(0px)' : 'blur(2px)'
                        }}
                        transition={{ duration: 0.5 }}
                        className={`
                        text-center font-bold mb-8 transition-colors duration-500 cursor-pointer
                        ${desktopMode ? 'text-[32px] leading-[1.5] text-left' : 'text-[24px] leading-relaxed'}
                    `}
                        style={{
                            color: isActive ? 'white' : 'rgba(255,255,255, 0.5)',
                            textAlign: desktopMode ? 'left' : 'center'
                        }}
                        onClick={() => {
                            if (line.time !== undefined && line.time !== null) {
                                seek(line.time);
                            }
                        }}
                    >
                        {line.text}
                    </motion.p>
                );
            })}
        </div>
    );
}
