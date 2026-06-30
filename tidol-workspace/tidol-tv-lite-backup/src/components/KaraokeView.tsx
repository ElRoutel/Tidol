import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { IoMusicalNotesOutline } from 'react-icons/io5';

interface KaraokeWord {
    word: string;
    start_cs: number;
    end_cs: number;
}

interface KaraokeViewProps {
    lyricsJSON: any;
    audioRef: React.RefObject<HTMLAudioElement>;
    desktopMode?: boolean;
}

export function KaraokeView({ lyricsJSON, audioRef }: KaraokeViewProps) {
    const [words, setWords] = useState<KaraokeWord[]>([]);
    const [activeWordIndex, setActiveWordIndex] = useState<number>(-1);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    
    const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);

    // --- 1. Fetch o Procesamiento de las Letras ---
    useEffect(() => {
        if (!lyricsJSON) {
            setWords([]);
            setIsLoading(true);
            return;
        }

        let isMounted = true;
        setIsLoading(true);

        if (typeof lyricsJSON === 'string') {
            fetch(lyricsJSON)
                .then(res => res.json())
                .then(data => {
                    if (isMounted && data.words) {
                        setWords(data.words);
                        wordRefs.current = new Array(data.words.length).fill(null);
                    }
                })
                .catch(err => {
                    console.error('[KaraokeView] Error fetching lyrics:', err);
                })
                .finally(() => {
                    if (isMounted) setIsLoading(false);
                });
        } else if (lyricsJSON.words || Array.isArray(lyricsJSON)) {
            const rawArray = Array.isArray(lyricsJSON) ? lyricsJSON : lyricsJSON.words;
            const parsedWords = rawArray.map((item: any, idx: number) => {
                if (item.text !== undefined && item.time !== undefined) {
                    return {
                        word: item.text,
                        start_cs: Math.floor(item.time * 100),
                        end_cs: Math.floor((rawArray[idx + 1]?.time || item.time + 3) * 100)
                    };
                }
                return item;
            });
            setWords(parsedWords);
            wordRefs.current = new Array(parsedWords.length).fill(null);
            setIsLoading(false);
        }

        return () => {
            isMounted = false;
        };
    }, [lyricsJSON]);

    // --- 2. Bucle de Sincronización de Alto Rendimiento (requestAnimationFrame) ---
    useEffect(() => {
        if (!audioRef || !audioRef.current || words.length === 0) return;

        let animationFrameId: number;
        // Referencia mutable para optimizar la búsqueda y no escanear desde cero
        let lastKnownIndex = 0;

        const updateKaraokeSync = () => {
            if (!audioRef || !audioRef.current) {
                animationFrameId = requestAnimationFrame(updateKaraokeSync);
                return;
            }
            
            const currentTimeCs = audioRef.current.currentTime * 100;
            let newActiveIndex = -1;

            // Búsqueda optimizada (asumiendo que el tiempo avanza hacia adelante normalmente)
            // Se busca desde el último índice conocido o se reinicia si el tiempo retrocede (seek).
            const startSearch = currentTimeCs < (words[lastKnownIndex]?.start_cs || 0) ? 0 : lastKnownIndex;

            for (let i = startSearch; i < words.length; i++) {
                const w = words[i];
                if (currentTimeCs >= w.start_cs && currentTimeCs <= w.end_cs) {
                    newActiveIndex = i;
                    lastKnownIndex = i;
                    break;
                } else if (currentTimeCs < w.start_cs) {
                    // Como están ordenadas por tiempo, si ya nos pasamos, dejamos de buscar
                    break;
                }
            }

            setActiveWordIndex(prevIndex => {
                if (prevIndex !== newActiveIndex) {
                    return newActiveIndex;
                }
                return prevIndex;
            });

            animationFrameId = requestAnimationFrame(updateKaraokeSync);
        };

        animationFrameId = requestAnimationFrame(updateKaraokeSync);

        return () => cancelAnimationFrame(animationFrameId);
    }, [words, audioRef]);

    // --- 3. Auto-Scroll Sincronizado ---
    useEffect(() => {
        if (activeWordIndex !== -1) {
            const activeEl = wordRefs.current[activeWordIndex];
            if (activeEl) {
                activeEl.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                });
            }
        }
    }, [activeWordIndex]);

    // --- 4. Renderizado UI (Estilo Apple Music) ---
    
    // Estado de procesamiento IA
    if (isLoading || !lyricsJSON) {
        return (
            <div className="flex flex-col items-center justify-center h-full w-full px-6 bg-black text-center">
                <div className="relative mb-6">
                    <div className="w-24 h-24 rounded-full border-4 border-white/10 border-t-purple-500 animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center text-purple-500">
                        <IoMusicalNotesOutline size={36} className="animate-pulse" />
                    </div>
                </div>
                <div className="bg-white/5 p-6 rounded-2xl max-w-sm w-full border border-white/10 backdrop-blur-md shadow-2xl">
                    <h3 className="text-xl font-bold text-white mb-2">Procesando pista con IA...</h3>
                    <p className="text-gray-400 text-sm mb-4">Alineando las letras milisegundo a milisegundo en tiempo real.</p>
                    <div className="w-full bg-white/10 h-2.5 rounded-full overflow-hidden mb-2">
                        <motion.div 
                            className="bg-purple-500 h-full rounded-full shadow-[0_0_10px_#a855f7]" 
                            initial={{ width: '0%' }}
                            animate={{ width: '100%' }}
                            transition={{ duration: 2, repeat: Infinity }}
                        />
                    </div>
                </div>
            </div>
        );
    }

    if (words.length === 0) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-black text-white/50">
                <p className="text-lg">No hay letras disponibles para esta canción.</p>
            </div>
        );
    }

    return (
        <div 
            className="w-full h-full bg-black overflow-y-auto no-scrollbar py-[40vh] px-8"
            style={{
                scrollBehavior: 'smooth',
                maskImage: 'linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%)'
            }}
        >
            <div className="max-w-4xl mx-auto flex flex-wrap gap-x-3 gap-y-4 justify-start items-center">
                {words.map((wordObj, index) => {
                    const isActive = index === activeWordIndex;
                    const isPast = index < activeWordIndex;

                    return (
                        <span
                            key={index}
                            ref={(el) => { wordRefs.current[index] = el; }}
                            className={`text-4xl md:text-5xl lg:text-6xl font-bold transition-all duration-200 inline-block cursor-pointer
                                ${isActive 
                                    ? 'text-white opacity-100 blur-none scale-110 drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]' 
                                    : isPast 
                                        ? 'text-white/60 blur-[0.5px]' 
                                        : 'text-white/30 blur-[1px]'
                                }
                            `}
                            onClick={() => {
                                if (audioRef.current) {
                                    audioRef.current.currentTime = wordObj.start_cs / 100;
                                    // Let the animation frame naturally catch up to avoid state tearing
                                }
                            }}
                        >
                            {wordObj.word}
                        </span>
                    );
                })}
            </div>
        </div>
    );
}
