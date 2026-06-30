import React, { useEffect, useState, useRef } from "react";
import { usePlayerProgress, usePlayer } from "../context/PlayerContext";

export default function KaraokeView({ lyricsPayload }) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const scrollRef = useRef(null);
  const { currentTimeMotion } = usePlayerProgress();
  const { seek } = usePlayer();

  const type = lyricsPayload?.type;
  const lyrics = lyricsPayload?.lines || [];

  const isPlainMode = type === 'plain' || type === 'plain_only';
  const isSyncedMode = type === 'whisper_synced' || type === 'lrclib_synced';

  // Magic 60fps animation loop — only for synced modes
  useEffect(() => {
    if (!lyrics || lyrics.length === 0 || !isSyncedMode) return;

    let animationFrameId;

    const checkTime = () => {
      const currentTime = currentTimeMotion.get() || 0;
      const currentCs = currentTime * 100;

      let newIndex = -1;
      for (let i = 0; i < lyrics.length; i++) {
        if (currentCs >= lyrics[i].start_cs) {
          newIndex = i;
        } else {
          break;
        }
      }

      if (newIndex !== activeIndex) {
        setActiveIndex(newIndex);
      }

      animationFrameId = requestAnimationFrame(checkTime);
    };

    animationFrameId = requestAnimationFrame(checkTime);

    return () => cancelAnimationFrame(animationFrameId);
  }, [lyrics, activeIndex, currentTimeMotion, isSyncedMode]);

  // Auto-scroll logic — only for synced modes
  useEffect(() => {
    if (activeIndex >= 0 && scrollRef.current && isSyncedMode) {
      const activeElement = scrollRef.current.children[activeIndex];
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [activeIndex, isSyncedMode]);

  // Empty state
  if (!lyrics || lyrics.length === 0) {
    return (
      <div className="relative flex items-center justify-center h-full w-full opacity-50">
        <p className="text-xl">Instrumental o letras no disponibles</p>
      </div>
    );
  }

  // ─── Render: Plain Text Mode ───
  if (isPlainMode) {
    return (
      <div className="relative w-full h-full overflow-y-auto pb-64 px-4 text-left"
           style={{ maskImage: "linear-gradient(to bottom, transparent, black 8%, black 92%, transparent)", WebkitMaskImage: "linear-gradient(to bottom, transparent, black 8%, black 92%, transparent)" }}>
        <div className="space-y-4 pt-16 max-w-4xl mx-auto">
          {lyrics.map((line, idx) => (
            <p key={idx} className="text-4xl sm:text-5xl font-bold text-white/50 leading-relaxed">
              {line}
            </p>
          ))}
        </div>
      </div>
    );
  }

  // ─── Render: Synced Karaoke Mode (60fps) ───
  return (
    <div className="relative w-full h-full overflow-y-auto no-scrollbar scroll-smooth" style={{ maskImage: "linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)", WebkitMaskImage: "linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)" }}>
      <div ref={scrollRef} className="flex flex-wrap gap-x-3 sm:gap-x-4 gap-y-8 px-4 py-64 justify-start items-start max-w-4xl mx-auto content-start leading-loose">
        {lyrics.map((wordData, index) => {
          const isActive = index === activeIndex;
          const isPast = index < activeIndex;

          return (
            <span
              key={index}
              className={`text-4xl sm:text-5xl font-bold transition-all duration-300 ease-out cursor-pointer inline-block
                ${
                  isActive
                    ? "opacity-100 blur-0 scale-110 text-white origin-bottom-left"
                    : isPast
                    ? "opacity-60 blur-0 text-gray-300"
                    : "opacity-40 blur-[1px] text-gray-400"
                }
              `}
              style={{ lineHeight: '1.5' }}
              onClick={() => {
                seek(wordData.start_cs / 100);
              }}
            >
              {wordData.word}
            </span>
          );
        })}
      </div>
    </div>
  );
}
