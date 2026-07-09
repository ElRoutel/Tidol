// src/hooks/useContextMenuTrigger.ts
import { useCallback, useRef } from 'react';
import {
    useContextMenu,
    type ContextMenuItemType,
    type ContextMenuExtraOption,
    type MenuAnchor,
} from '../context/ContextMenuContext';
import { useLongPress } from './useLongPress';

export interface ContextMenuTriggerOptions {
    extra?: ContextMenuExtraOption[];
    disabled?: boolean;
}

/**
 * Abre el context menu global con click derecho (desktop/Android) o pulsación
 * larga (iOS/Android). Esparce `triggerProps` en el elemento (añádele también
 * la clase `ctx-longpress` para suprimir el callout de selección de iOS) y usa
 * `open` en el onClick de un botón kebab.
 */
export function useContextMenuTrigger(
    type: ContextMenuItemType,
    data: any,
    options: ContextMenuTriggerOptions = {}
) {
    const { openContextMenu } = useContextMenu();

    const latest = useRef({ type, data, options });
    latest.current = { type, data, options };

    const open = useCallback((e: MenuAnchor) => {
        const { type, data, options } = latest.current;
        openContextMenu(e, type, data, options.extra ? { extra: options.extra } : undefined);
    }, [openContextMenu]);

    const { handlers, cancel, firedAtRef } = useLongPress(open, { disabled: options.disabled });

    const onContextMenu: React.MouseEventHandler = useCallback((e) => {
        e.preventDefault();
        // Evita que el listener legacy de document re-abra el menú leyendo el
        // dataset (pobre) de un ancestro .song-item/.album-item.
        e.stopPropagation();
        if (latest.current.options.disabled) return;
        // Android dispara contextmenu nativo con long-press: si nuestro timer
        // ya abrió el menú, ignorarlo; si llegó antes que el timer, cancelarlo.
        if (Date.now() - firedAtRef.current < 800) return;
        cancel();
        open(e);
    }, [open, cancel, firedAtRef]);

    return {
        triggerProps: { onContextMenu, ...handlers },
        open,
    };
}
