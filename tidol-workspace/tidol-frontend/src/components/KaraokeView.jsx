import React, { useEffect, useState, useRef } from "react";
import { usePlayerProgress, usePlayer } from "../context/PlayerContext";

export default function KaraokeView({ lyricsPayload }) {
  const [activeIndex, setActiveIndex] = useState(-1);
  // Espejo en ref del índice activo: permite comparar dentro del loop rAF sin
  // recrear el efecto en cada cambio de índice (evita que el primer verso al abrir
  // el fullscreen mid-canción llegue tarde / se muestre un verso equivocado).
  const activeIndexRef = useRef(-1);
  const scrollRef = useRef(null);
  const { currentTimeMotion } = usePlayerProgress();
  const { seek } = usePlayer();

  const type = lyricsPayload?.type;
  const lyrics = lyricsPayload?.lines || [];

  // Solo es "sincronizado" si el tipo lo indica Y las líneas realmente traen
  // timestamps (start_cs). Si no, degradamos a texto plano con aviso explícito
  // en vez de fallar en silencio mostrando texto estático.
  const hasTimestamps = lyrics.length > 0 && lyrics.some((l) => typeof l?.start_cs === 'number');
  const isSyncedMode = (type === 'whisper_synced' || type === 'lrclib_synced') && hasTimestamps;
  const isPlainMode = !isSyncedMode; // cualquier otra cosa con líneas → modo plano

  const lineText = (line) =>
    typeof line === 'string' ? line : (line?.word ?? line?.text ?? line?.line ?? '');

  // Cálculo del índice activo a partir del tiempo actual (búsqueda lineal; el nº de
  // líneas es pequeño). Se usa tanto para el primer render como en el loop rAF.
  const indexForTime = (timeSec) => {
    const currentCs = (timeSec || 0) * 100;
    let idx = -1;
    for (let i = 0; i < lyrics.length; i++) {
      if (typeof lyrics[i]?.start_cs === 'number' && currentCs >= lyrics[i].start_cs) idx = i;
      else if (typeof lyrics[i]?.start_cs === 'number') break;
    }
    return idx;
  };

  // Loop 60fps — solo para modo sincronizado. Depende solo de [lyrics, isSyncedMode]
  // (no de activeIndex): así arranca una sola vez y calcula el verso correcto en el
  // primer frame, incluso abriendo el fullscreen con la canción ya avanzada.
  useEffect(() => {
    if (!isSyncedMode) return;

    // Cálculo inicial inmediato (sin esperar al primer requestAnimationFrame).
    const initial = indexForTime(currentTimeMotion.get());
    activeIndexRef.current = initial;
    setActiveIndex(initial);

    let animationFrameId;
    const checkTime = () => {
      const newIndex = indexForTime(currentTimeMotion.get());
      if (newIndex !== activeIndexRef.current) {
        activeIndexRef.current = newIndex;
        setActiveIndex(newIndex);
      }
      animationFrameId = requestAnimationFrame(checkTime);
    };
    animationFrameId = requestAnimationFrame(checkTime);

    return () => cancelAnimationFrame(animationFrameId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lyrics, isSyncedMode]);

  // Auto-scroll — solo para modo sincronizado.
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

  // ─── Render: Modo Texto Plano (sin sincronización) ───
  if (isPlainMode) {
    return (
      <div className="relative w-full h-full overflow-y-auto pb-64 px-4 text-left"
           style={{ maskImage: "linear-gradient(to bottom, transparent, black 8%, black 97%, transparent)", WebkitMaskImage: "linear-gradient(to bottom, transparent, black 8%, black 92%, transparent)" }}>
        <div className="max-w-4xl mx-auto pt-16">
          {/* Aviso explícito: evita la falsa expectativa de que la letra sincroniza */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-white/60">
            <span className="h-2 w-2 rounded-full bg-white/40" />
            Letra no sincronizada
          </div>
          <div className="space-y-4">
            {lyrics.map((line, idx) => (
              <p key={idx} className="text-4xl sm:text-5xl font-bold text-white/50 leading-relaxed">
                {lineText(line)}
              </p>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Render: Modo Karaoke Sincronizado (60fps) ───
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
                    ? "opacity-100 blur-0 scale-100 text-white origin-bottom-left"
                    : isPast
                    ? "opacity-60 blur-0 text-gray-200"
                    : "opacity-40 blur-[1px] text-gray-525"
                }
              `}
              style={{ lineHeight: '1.25' }}
              onClick={() => {
                if (typeof wordData?.start_cs === 'number') seek(wordData.start_cs / 100);
              }}
            >
              {lineText(wordData)}
            </span>
          );
        })}
      </div>
    </div>
  );
}
