import React, { useEffect, useState, useRef } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { getOptimizedImageUrl } from '../utils/imageUtils';

export default function GlobalBackground() {
  const { currentSong, isPlaying } = usePlayer();
  const canvasRef = useRef(null);
  const [activeCover, setActiveCover] = useState(null);
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    if (currentSong?.portada) {
      // 1. Fetch tiny thumbnail (Low-Res)
      // w=50 is enough for a smooth gradient when stretched to 100vw
      const lowResUrl = getOptimizedImageUrl(currentSong.portada, 50);
      setActiveCover(lowResUrl);
    } else {
      // Optional: fade out if no song
    }
  }, [currentSong]);

  useEffect(() => {
    if (!activeCover || !canvasRef.current) return;

    const ctx = canvasRef.current.getContext('2d', { alpha: false }); // alpha: false for speed
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = activeCover;

    img.onload = () => {
      // 2. Draw once with filters
      // Apply Saturation and Brightness ONLY during draw time (CPU cheap-ish for 50px)
      // vs CSS filter running every frame on 1080p (GPU expensive)
      ctx.filter = 'saturate(1.8) brightness(0.4)';
      ctx.drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height);

      // Fade in after draw
      setOpacity(1);
    };
  }, [activeCover]);

  if (!currentSong) return null;

  return (
    <div className="global-bg-wrapper">
      {/* 3. Canvas Stretch */}
      <canvas
        ref={canvasRef}
        width={50}
        height={50}
        className="global-bg-canvas"
        style={{
          opacity: isPlaying && opacity > 0 ? 1 : (opacity * 0.8) // Dim if paused
        }}
      />

      <div className="global-bg-overlay" />

      <style>{`
        .global-bg-wrapper {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          z-index: 0;
          pointer-events: none;
          background-color: #050505; /* Deep black fallback */
        }

        .global-bg-canvas {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          /* Browser automatically smooths (bi-linear) when scaling up */
          /* No filter: blur() needed! */
          object-fit: cover;
          transition: opacity 1s ease;
        }

        .global-bg-overlay {
          position: absolute;
          inset: 0;
          background: radial-gradient(
            circle at 50% 30%, 
            rgba(0,0,0,0.2) 0%, 
            rgba(0,0,0,0.6) 50%, 
            rgba(0,0,0,0.9) 100%
          );
          z-index: 1;
        }
      `}</style>
    </div>
  );
}