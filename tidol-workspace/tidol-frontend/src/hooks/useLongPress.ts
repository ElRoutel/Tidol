// src/hooks/useLongPress.ts
import { useCallback, useEffect, useRef } from 'react';

export interface LongPressOptions {
    /** ms que hay que mantener presionado antes de disparar */
    threshold?: number;
    /** px de movimiento tolerados antes de cancelar (scroll/drag) */
    moveTolerance?: number;
    /** duración de la vibración háptica; 0 la desactiva */
    vibrateMs?: number;
    disabled?: boolean;
}

export interface LongPressHandlers {
    onTouchStart: React.TouchEventHandler;
    onTouchMove: React.TouchEventHandler;
    onTouchEnd: React.TouchEventHandler;
    onTouchCancel: React.TouchEventHandler;
}

/**
 * Detecta pulsación larga en pantallas táctiles (iOS no dispara `contextmenu`).
 * Se cancela si el dedo se mueve (scroll), se suelta antes del umbral, o el
 * touch empezó dentro de un elemento con `data-no-longpress` (p.ej. un asa de
 * drag). `firedAtRef` expone el timestamp del último disparo para que el
 * llamador pueda descartar el `contextmenu` nativo de Android (doble apertura).
 */
export function useLongPress(
    onLongPress: (pos: { clientX: number; clientY: number }) => void,
    opts: LongPressOptions = {}
) {
    const { threshold = 500, moveTolerance = 10, vibrateMs = 15, disabled = false } = opts;

    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const startRef = useRef({ x: 0, y: 0 });
    const firedAtRef = useRef(0);
    const callbackRef = useRef(onLongPress);
    callbackRef.current = onLongPress;

    const cancel = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    useEffect(() => cancel, [cancel]);

    const onTouchStart: React.TouchEventHandler = useCallback((e) => {
        if (disabled || e.touches.length !== 1) return;
        if ((e.target as Element).closest?.('[data-no-longpress]')) return;
        const { clientX, clientY } = e.touches[0];
        startRef.current = { x: clientX, y: clientY };
        cancel();
        timerRef.current = setTimeout(() => {
            timerRef.current = null;
            firedAtRef.current = Date.now();
            if (vibrateMs > 0) navigator.vibrate?.(vibrateMs);
            callbackRef.current({ clientX, clientY });
        }, threshold);
    }, [disabled, threshold, vibrateMs, cancel]);

    const onTouchMove: React.TouchEventHandler = useCallback((e) => {
        if (!timerRef.current) return;
        const t = e.touches[0];
        if (!t) return;
        if (Math.hypot(t.clientX - startRef.current.x, t.clientY - startRef.current.y) > moveTolerance) {
            cancel();
        }
    }, [moveTolerance, cancel]);

    const onTouchEnd: React.TouchEventHandler = useCallback((e) => {
        cancel();
        // Suprime el click sintético post-touch: sin esto, soltar el dedo tras
        // el long-press reproduce la canción y cierra el menú recién abierto
        // (listener global de click). touchend no es passive en React.
        if (Date.now() - firedAtRef.current < 700) e.preventDefault();
    }, [cancel]);

    const onTouchCancel: React.TouchEventHandler = useCallback(() => cancel(), [cancel]);

    return {
        handlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel } as LongPressHandlers,
        cancel,
        firedAtRef,
    };
}
