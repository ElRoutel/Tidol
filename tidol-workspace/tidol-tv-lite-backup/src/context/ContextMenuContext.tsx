// src/context/ContextMenuContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export type ContextMenuItemType = 'song' | 'album' | 'artist';

interface ContextMenuState {
    visible: boolean;
    position: { x: number; y: number };
    item: { type: ContextMenuItemType; data: any } | null;
}

interface ContextMenuContextType {
    menuState: ContextMenuState;
    openContextMenu: (e: React.MouseEvent | MouseEvent, type: ContextMenuItemType, data: any) => void;
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

    const openContextMenu = useCallback((e: React.MouseEvent | MouseEvent, type: ContextMenuItemType, data: any) => {
        e.preventDefault();
        e.stopPropagation();
        setMenuState({
            visible: true,
            position: { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY },
            item: { type, data },
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
