// src/context/ContextMenuContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export type ContextMenuItemType = 'song' | 'ia-song' | 'album' | 'artist' | 'playlist';

// Opción contextual extra que el llamador inyecta al final del menú
// (p.ej. "Quitar de esta playlist" cuando la fila vive en una playlist propia).
export interface ContextMenuExtraOption {
    label: string;
    icon?: React.ComponentType<{ size?: number }>;
    destructive?: boolean;
    onSelect: () => void;
}

// Acepta también un objeto plano {clientX, clientY} para poder abrir el menú
// desde un long-press táctil, donde ya no hay MouseEvent real.
export type MenuAnchor = React.MouseEvent | MouseEvent | { clientX: number; clientY: number };

interface ContextMenuState {
    visible: boolean;
    position: { x: number; y: number };
    item: { type: ContextMenuItemType; data: any; extra?: ContextMenuExtraOption[] } | null;
}

interface ContextMenuContextType {
    menuState: ContextMenuState;
    openContextMenu: (e: MenuAnchor, type: ContextMenuItemType, data: any, options?: { extra?: ContextMenuExtraOption[] }) => void;
    closeContextMenu: () => void;
}

const ContextMenuContext = createContext<ContextMenuContextType | undefined>(undefined);

export function useContextMenu() {
    const context = useContext(ContextMenuContext);
    if (!context) throw new Error('useContextMenu debe usarse dentro de un ContextMenuProvider');
    return context;
}

export function ContextMenuProvider({ children }: { children: ReactNode }) {
    const [menuState, setMenuState] = useState<ContextMenuState>({
        visible: false,
        position: { x: 0, y: 0 },
        item: null,
    });

    const openContextMenu = useCallback((e: MenuAnchor, type: ContextMenuItemType, data: any, options?: { extra?: ContextMenuExtraOption[] }) => {
        (e as MouseEvent).preventDefault?.();
        (e as MouseEvent).stopPropagation?.();
        setMenuState({
            visible: true,
            position: { x: e.clientX, y: e.clientY },
            item: { type, data, extra: options?.extra },
        });
    }, []);

    const closeContextMenu = useCallback(() => {
        setMenuState((prev) => ({ ...prev, visible: false }));
    }, []);

    useEffect(() => {
        const handleGlobalContextMenu = (e: MouseEvent) => {
            const targetItem = (e.target as HTMLElement).closest(".song-item, .album-item, .artist-item");
            if (!targetItem) return;

            e.preventDefault();

            const type: ContextMenuItemType = targetItem.classList.contains("song-item")
                ? "song"
                : targetItem.classList.contains("album-item")
                    ? "album"
                    : "artist";

            const data = { ...(targetItem as HTMLElement).dataset };
            openContextMenu(e, type, data);
        };

        const handleClick = () => closeContextMenu();

        document.addEventListener("contextmenu", handleGlobalContextMenu);
        document.addEventListener("click", handleClick);

        return () => {
            document.removeEventListener("contextmenu", handleGlobalContextMenu);
            document.removeEventListener("click", handleClick);
        };
    }, [openContextMenu, closeContextMenu]);

    return (
        <ContextMenuContext.Provider value={{ menuState, openContextMenu, closeContextMenu }}>
            {children}
        </ContextMenuContext.Provider>
    );
}
