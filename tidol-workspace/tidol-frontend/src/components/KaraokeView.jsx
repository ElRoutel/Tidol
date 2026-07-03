import React, { useEffect, useState, useRef } from "react";
import { usePlayerProgress, usePlayer } from "../context/PlayerContext";

export default function KaraokeView({ lyricsPayload, accent = '#ffffff' }) {
  const [activeIndex, setActiveIndex] = useState(-1);
  // Espejo en ref del índice activo: permite comparar dentro del loop rAF sin
  // recrear el efecto en cada cambio de índice (evita que el primer verso al abrir
  // el fullscreen mid-canción llegue tarde / se muestre un verso equivocado).
  const activeIndexRef = useRef(-1);
  const scrollRef = useRef(null);
  const containerRef = useRef(null);
  // El auto-scroll se suspende mientras el usuario desliza la letra (y ~3s
  // después): antes cada cambio de verso hacía scrollIntoView y le arrancaba
  // el scroll de las manos al usuario a mitad de gesto.
  const userScrollUntilRef = useRef(0);
  const { currentTimeMotion } = usePlayerProgress();
  const { seek } = usePlayer();

  const markUserScroll = () => {
    userScrollUntilRef.current = Date.now() + 3000;
  };

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

  // Auto-scroll — solo para modo sincronizado. Se desplaza el contenedor
  // directamente (no scrollIntoView, que también puede mover ancestros
  // scrolleables) y se respeta el scroll manual del usuario.
  useEffect(() => {
    if (activeIndex < 0 || !isSyncedMode) return;
    if (Date.now() < userScrollUntilRef.current) return;
    const container = containerRef.current;
    const activeElement = scrollRef.current?.children[activeIndex];
    if (container && activeElement) {
      const top = activeElement.offsetTop - container.clientHeight / 2 + activeElement.offsetHeight / 2;
      container.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }
  }, [activeIndex, isSyncedMode]);

  // Empty state
  if (!lyrics || lyrics.length === 0) {
    return (
      <div className="relative flex flex-col items-center justify-center h-full w-full text-center px-8">
        <p className="text-lg font-semibold text-white/50">Sin letra para esta canción</p>
        <p className="text-sm text-white/30 mt-1">Puede ser instrumental, o la letra aún no está disponible</p>
      </div>
    );
  }

  // ─── Render: Modo Texto Plano (sin sincronización) ───
  if (isPlainMode) {
    return (
      <div className="relative w-full h-full overflow-y-auto no-scrollbar overscroll-contain pb-64 px-6 text-left"
           style={{ maskImage: "linear-gradient(to bottom, transparent, black 8%, black 92%, transparent)", WebkitMaskImage: "linear-gradient(to bottom, transparent, black 8%, black 92%, transparent)" }}>
        <div className="max-w-3xl pt-16">
          {/* Aviso explícito: evita la falsa expectativa de que la letra sincroniza */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-[13px] font-medium text-white/60">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
            Letra no sincronizada
          </div>
          <div className="space-y-5">
            {lyrics.map((line, idx) => (
              <p key={idx} className="text-[26px] lg:text-[30px] font-bold tracking-[-.3px] leading-[1.25] text-white/60">
                {lineText(line)}
              </p>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Render: Modo Karaoke Sincronizado (60fps) ───
  // Estados por línea (estilo Apple Music): activa nítida y con peso máximo,
  // pasadas muy atenuadas, la siguiente semivisible, las lejanas con blur sutil.
  return (
    <div
      ref={containerRef}
      onWheel={markUserScroll}
      onTouchMove={markUserScroll}
      className="relative w-full h-full overflow-y-auto no-scrollbar overscroll-contain scroll-smooth"
      style={{ maskImage: "linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)", WebkitMaskImage: "linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)" }}
    >
      <div ref={scrollRef} className="flex flex-wrap gap-x-3 gap-y-7 px-6 py-64 justify-start items-start max-w-3xl content-start">
        {lyrics.map((wordData, index) => {
          const isActive = index === activeIndex;
          const isPast = index < activeIndex;
          const dist = index - activeIndex;
          const opacity = isActive ? 1 : (isPast ? 0.32 : (dist === 1 ? 0.62 : 0.4));

          return (
            <span
              key={index}
              className="text-[26px] sm:text-[28px] lg:text-[31px] tracking-[-.3px] cursor-pointer inline-block text-white transition-[opacity,filter] duration-300 ease-out"
              style={{
                lineHeight: '1.2',
                opacity,
                fontWeight: isActive ? 800 : 700,
                filter: !isPast && !isActive && dist > 1 ? 'blur(0.6px)' : 'none',
              }}
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
