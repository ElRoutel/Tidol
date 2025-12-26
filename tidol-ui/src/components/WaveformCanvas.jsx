import React, { useEffect, useRef, memo } from 'react';

const WaveformCanvas = memo(({ waveformData, progress, className }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;

        // Set canvas dimensions
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        // Clear canvas
        ctx.clearRect(0, 0, rect.width, rect.height);

        if (!waveformData || waveformData.length === 0) {
            // Draw flat line if no data
            ctx.beginPath();
            ctx.moveTo(0, rect.height / 2);
            ctx.lineTo(rect.width, rect.height / 2);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = 2;
            ctx.stroke();
            return;
        }

        const width = rect.width;
        const height = rect.height;
        const barWidth = 3;
        const gap = 1;
        const totalBars = Math.floor(width / (barWidth + gap));

        // Resample data to fit canvas
        const step = Math.ceil(waveformData.length / totalBars);

        for (let i = 0; i < totalBars; i++) {
            const dataIndex = Math.floor(i * (waveformData.length / totalBars));
            const value = waveformData[dataIndex] || 0;

            // Normalize value (assuming 0-1 or similar range, adjust if needed)
            // If data is raw audio samples, might need Math.abs()
            const barHeight = Math.max(2, value * height * 0.8);

            const x = i * (barWidth + gap);
            const y = (height - barHeight) / 2;

            // Determine color based on progress
            const progressX = (progress / 100) * width;

            if (x < progressX) {
                ctx.fillStyle = '#ffffff'; // Played part
            } else {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'; // Unplayed part
            }

            // Rounded bars
            roundRect(ctx, x, y, barWidth, barHeight, 2);
            ctx.fill();
        }

    }, [waveformData, progress]);

    // Helper for rounded rectangles
    function roundRect(ctx, x, y, width, height, radius) {
        if (width < 2 * radius) radius = width / 2;
        if (height < 2 * radius) radius = height / 2;
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.arcTo(x + width, y, x + width, y + height, radius);
        ctx.arcTo(x + width, y + height, x, y + height, radius);
        ctx.arcTo(x, y + height, x, y, radius);
        ctx.arcTo(x, y, x + width, y, radius);
        ctx.closePath();
    }

    return (
        <canvas
            ref={canvasRef}
            className={className}
            style={{ width: '100%', height: '100%' }}
        />
    );
});

WaveformCanvas.displayName = 'WaveformCanvas';

export default WaveformCanvas;
