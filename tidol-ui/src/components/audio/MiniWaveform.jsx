import React, { useMemo, useEffect, useState } from 'react';
import { usePlayerProgress } from '../../context/PlayerContext';

/**
 * MiniWaveform - Interactive audio progress visualization
 * Displays animated bars that represent playback progress
 * 
 * @param {Object} props
 * @param {'compact' | 'full'} props.variant - Display size
 * @param {number} props.currentTime - Current playback time in seconds
 * @param {number} props.duration - Total duration in seconds
 * @param {boolean} props.isPlaying - Whether audio is currently playing
 */
const MiniWaveform = ({ variant = 'compact', currentTime = 0, duration = 1, isPlaying = false }) => {
    const [barHeights, setBarHeights] = useState([]);

    // Determine number of bars based on variant
    const barCount = variant === 'compact' ? 5 : 8;

    // Calculate progress percentage
    const progress = useMemo(() => {
        if (!duration || duration === 0) return 0;
        return Math.min(100, (currentTime / duration) * 100);
    }, [currentTime, duration]);

    // Generate animated bar  heights
    useEffect(() => {
        // Initialize with static heights
        const staticHeights = Array(barCount).fill(50);

        if (!isPlaying) {
            setBarHeights(staticHeights);
            return;
        }

        // Set initial heights immediately when starting
        setBarHeights(staticHeights);

        // Animate bars when playing
        const interval = setInterval(() => {
            setBarHeights(
                Array.from({ length: barCount }, () =>
                    Math.random() * 40 + 40 // Random heights between 40-80%
                )
            );
        }, 150); // Update every 150ms for smooth animation

        return () => clearInterval(interval);
    }, [isPlaying, barCount]);

    return (
        <div
            className={`flex items-end gap-1 ${variant === 'full' ? 'w-full h-5' : 'w-16 h-4'}`}
            aria-label={`Audio progress: ${Math.round(progress)}%`}
        >
            {Array.from({ length: barCount }).map((_, i) => {
                const barProgress = (i / barCount) * 100;
                const isFilled = barProgress <= progress;
                const height = barHeights[i] || 50;

                return (
                    <div
                        key={i}
                        className={`flex-1 rounded-full transition-all duration-150 ${isFilled ? 'bg-primary' : 'bg-white/20'
                            }`}
                        style={{
                            height: `${height}%`,
                            minHeight: '20%',
                            maxHeight: '100%'
                        }}
                    />
                );
            })}
        </div>
    );
};

export default React.memo(MiniWaveform);
