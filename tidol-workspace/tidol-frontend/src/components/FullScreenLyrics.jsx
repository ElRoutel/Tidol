import React, { useRef, useEffect, useState, memo } from 'react';
import { IoChevronDown } from 'react-icons/io5';
import { useSwipeable } from 'react-swipeable';
import { useSpring, useMotionValue, useMotionValueEvent, useTransform, motion } from 'framer-motion';
import './FullScreenLyrics.css';

// Componente de Línea Memoizado para "Zero Re-renders"
const LyricLine = memo(({ line, index, activeIndexMV, onClick }) => {
  // Transformaciones reactivas sin re-render de React
  const filter = useTransform(activeIndexMV, (latest) => {
    const distance = Math.abs(latest - index);
    // CULLING OPTIMIZATION:
    // Si la distancia es > 3, devolvemos un blur estático máximo para evitar cálculos intermedios constantes
    // y permitir que el navegador optimice.
    if (distance > 3) return "blur(8px)";
    // Si es línea activa (0) -> blur(0px)
    // Si está cerca (1-3) -> blur progresivo
    return `blur(${Math.min(distance * 1.5, 8)}px)`;
  });

  const opacity = useTransform(activeIndexMV, (latest) => {
    const distance = Math.abs(latest - index);
    if (distance > 3) return 0.2; // Opacidad estática para lejanos
    if (distance === 0) return 1;
    return Math.max(0.2, 0.6 - ((distance - 1) * 0.15));
  });

  const scale = useTransform(activeIndexMV, (latest) => {
    const distance = Math.abs(latest - index);
    // Solo escalamos la activa, el resto a 1
    return distance < 0.5 ? 1.05 : 1;
  });

  // Color: Usamos una clase CSS condicional basada en el índice actual "aproximado"
  // O podemos usar motion values para el color también, pero CSS transition suele ser más barato para color.
  // Sin embargo, para "zero re-renders", no podemos cambiar props.
  // Vamos a dejar que el color transicione vía CSS usando una prop 'active' si queremos
  // PERO eso dispararía re-renders.
  // MEJOR: Usamos `color` en style también si queremos 100% framer, pero `color` es pesado de animar.
  // Compromiso: La clase .active-line se actualiza via CSS class, lo que SI causa re-render,
  // PERO podemos evitarlo pasando el color por motion value. Hagámoslo vía opacidad/filter que ya tenemos.
  // La clase `active-line` en el CSS original manejaba color blanco vs gris.
  // Vamos a usar motion style para 'color' interpolando blanco a gris? No, usemos CSS transition standard.
  // Espera, el usuario pidió "Zero Re-renders". Si cambiamos `className` cada vez que cambia el índice,
  // React re-renderiza TODAS las líneas para ver si cambió la clase.
  // SOLUCIÓN: Usamos un subscriber al MotionValue para setear el data-attribute directamente en el DOM ref?
  // O simplemente aceptamos que el cambio de color (discreto) cause re-render, pero el blur (animado??) no.
  // El usuario dijo "No uses useState... para actualizar blur".
  // Index cambia 1 vez por línea => 1 re-render no es grave.
  // Lo grave era calcular estilos en cada frame de scroll.
  // Sigo la instrucción: MotionValues para estilos dinámicos.

  return (
    <motion.p
      className="lyric-line"
      style={{
        filter,
        opacity,
        scale,
      }}
      onClick={() => onClick(index)}
    >
      {line.line}
    </motion.p>
  );
});

const FullScreenLyrics = ({ lyrics, currentLineIndex, onClose }) => {
  const lyricsContainerRef = useRef(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const userScrollTimeout = useRef(null);

  // MotionValue para el índice activo (Animation Source)
  const activeIndexMV = useMotionValue(currentLineIndex);

  // Physics Spring for ScrollPosition
  const scrollTarget = useMotionValue(0);
  const springScroll = useSpring(scrollTarget, { stiffness: 100, damping: 20, mass: 1 });

  const handlers = useSwipeable({
    onSwipedDown: () => onClose(),
    preventScrollOnSwipe: true,
    trackMouse: true,
  });

  // Sync index prop to MotionValue
  useEffect(() => {
    // Si quisiéramos animación suave entre índices, usaríamos animate().
    // Por ahora, set directo para respuesta rápida (Apple Music es snappy en el cambio de estilo)
    activeIndexMV.set(currentLineIndex);
  }, [currentLineIndex, activeIndexMV]);

  // Sync Spring with Container ScrollTop
  useMotionValueEvent(springScroll, "change", (latest) => {
    if (lyricsContainerRef.current && !isUserScrolling) {
      lyricsContainerRef.current.scrollTop = latest;
    }
  });

  const handleInteractionStart = () => {
    setIsUserScrolling(true);
    if (userScrollTimeout.current) clearTimeout(userScrollTimeout.current);
  };

  const handleInteractionEnd = () => {
    if (userScrollTimeout.current) clearTimeout(userScrollTimeout.current);
    userScrollTimeout.current = setTimeout(() => {
      setIsUserScrolling(false);
      if (lyricsContainerRef.current) {
        // Re-sync spring to current position to avoid jumps when auto-scroll resumes
        scrollTarget.set(lyricsContainerRef.current.scrollTop);
        springScroll.set(lyricsContainerRef.current.scrollTop);
      }
    }, 1500);
  };


  // Calculate Target Scroll Position
  useEffect(() => {
    if (!lyricsContainerRef.current || isUserScrolling) return;

    // Nota: Usamos selectores normales ya que el DOM existe.
    // Usamos nth-child para encontrar la línea porque no tenemos ref a cada item fácilmente sin re-renders.
    const container = lyricsContainerRef.current;

    // Asumimos que los <p> son los hijos directos.
    // Index es 0-based, nth-child es 0-based en children array? No, querySelectorAll.
    const lines = container.querySelectorAll('.lyric-line');
    const activeLine = lines[currentLineIndex];

    if (activeLine) {
      const target = activeLine.offsetTop - container.offsetHeight / 2 + activeLine.offsetHeight / 2;
      scrollTarget.set(target);
    }
  }, [currentLineIndex, lyrics, isUserScrolling, scrollTarget]);


  return (
    <div
      {...handlers}
      className="fullscreen-lyrics-container"
    >
      <button onClick={onClose} className="close-button">
        <IoChevronDown size={32} />
      </button>

      <div
        ref={lyricsContainerRef}
        className="lyrics-scroll-area"
        onWheel={handleInteractionStart}
        onTouchMove={handleInteractionStart}
        onMouseUp={handleInteractionEnd}
        onTouchEnd={handleInteractionEnd}
      >
        {(!lyrics || lyrics.length === 0) ? (
          <p className="no-lyrics-text">No hay letras disponibles</p>
        ) : (
          lyrics.map((line, i) => (
            <LyricLine
              key={i}
              index={i}
              line={line}
              activeIndexMV={activeIndexMV}
              onClick={() => { }} // Placeholder for seek
            />
          ))
        )}
      </div>
    </div>
  );
};

export default FullScreenLyrics;
