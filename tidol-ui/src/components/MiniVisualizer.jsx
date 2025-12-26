import React from 'react';

export default function MiniVisualizer({ isPlaying = false }) {
  return (
    <div className={`flex items-end justify-center gap-[2px] h-4 w-4 transition-opacity duration-300 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}>
      <div className={`w-[3px] bg-white ${isPlaying ? 'animate-music-bar-1' : 'h-[2px] transition-all duration-300'}`}></div>
      <div className={`w-[3px] bg-white ${isPlaying ? 'animate-music-bar-2' : 'h-[2px] transition-all duration-300 delay-75'}`}></div>
      <div className={`w-[3px] bg-white ${isPlaying ? 'animate-music-bar-3' : 'h-[2px] transition-all duration-300 delay-150'}`}></div>
      <style>{`
        @keyframes music-bar {
          0%, 100% { height: 20%; }
          50% { height: 100%; }
        }
        .animate-music-bar-1 { animation: music-bar 0.6s ease-in-out infinite alternate; }
        .animate-music-bar-2 { animation: music-bar 0.8s ease-in-out infinite alternate; }
        .animate-music-bar-3 { animation: music-bar 0.5s ease-in-out infinite alternate; }
      `}</style>
    </div>
  );
}
