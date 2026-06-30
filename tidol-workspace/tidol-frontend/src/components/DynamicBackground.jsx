import React, { useEffect, useRef } from 'react';

export default function DynamicBackground({ colors }) {
    const canvasRef = useRef(null);
    const workerRef = useRef(null);
    const hasTransferred = useRef(false);

    useEffect(() => {
        if (!canvasRef.current || hasTransferred.current) return;

        let offscreenCanvas;
        try {
            // Check if transferControlToOffscreen exists (standard in modern chromium/ff)
            if (canvasRef.current.transferControlToOffscreen) {
                offscreenCanvas = canvasRef.current.transferControlToOffscreen();
                hasTransferred.current = true;
            } else {
                console.warn('OffscreenCanvas API not supported in this browser environment.');
                return;
            }
        } catch (e) {
            console.warn('OffscreenCanvas error', e);
            return;
        }

        const worker = new Worker(new URL('../workers/bgWorker.js', import.meta.url), { type: 'module' });
        workerRef.current = worker;

        worker.postMessage({
            type: 'init',
            canvas: offscreenCanvas,
            width: window.innerWidth,
            height: window.innerHeight,
        }, [offscreenCanvas]);

        const handleResize = () => {
            worker.postMessage({
                type: 'resize',
                width: window.innerWidth,
                height: window.innerHeight
            });
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            worker.postMessage({ type: 'stop' });
            worker.terminate();
            workerRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (workerRef.current && colors) {
            workerRef.current.postMessage({
                type: 'updateColors',
                colors: {
                    dominant: colors.dominant || '#1a1a1a',
                    secondary: colors.secondary || '#0a0a0a',
                    tertiary: colors.tertiary || '#050505' // Use subtle dark defaults
                }
            });
        }
    }, [colors]);

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full -z-10 bg-black"
            style={{
                display: 'block',
                pointerEvents: 'none',
                // Will-change helps hint the browser to composite on the GPU
                willChange: 'transform'
            }}
        />
    );
}
