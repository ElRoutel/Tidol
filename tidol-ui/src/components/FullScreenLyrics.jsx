import React, { useRef, useEffect } from 'react';
import { IoChevronDown } from 'react-icons/io5';
import { useSwipeable } from 'react-swipeable';
import './FullScreenLyrics.css';

const FullScreenLyrics = ({ lyrics, currentLineIndex, onClose }) => {
  const lyricsContainerRef = useRef(null);

  const handlers = useSwipeable({
    onSwipedDown: () => onClose(),
    preventScrollOnSwipe: true,
    trackMouse: true,
  });

  // Scroll automático a la línea activa
  useEffect(() => {
    if (!lyricsContainerRef.current) return;
    const activeLine = lyricsContainerRef.current.querySelector(".active-line");
    if (activeLine) {
      const container = lyricsContainerRef.current;
      const offset =
        activeLine.offsetTop - container.offsetHeight / 2 + activeLine.offsetHeight / 2;
      container.scrollTo({ top: offset, behavior: "smooth" });
    }
  }, [currentLineIndex]);

  return (
    <div
      {...handlers}
      className="fullscreen-lyrics-container"
    >
      <button onClick={onClose} className="close-button">
        <IoChevronDown size={32} />
      </button>

      <div ref={lyricsContainerRef} className="lyrics-scroll-area">
        {(!lyrics || lyrics.length === 0) ? (
          <p className="no-lyrics-text">No hay letras disponibles</p>
        ) : (
          lyrics.map((line, i) => (
            <p
              key={i}
              className={`lyric-line ${i === currentLineIndex ? 'active-line' : ''}`}
            >
              {line.line}
            </p>
          ))
        )}
      </div>
    </div>
  );
};

export default FullScreenLyrics;
