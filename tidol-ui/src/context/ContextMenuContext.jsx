import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ContextMenuContext = createContext();

export function useContextMenu() {
    return useContext(ContextMenuContext);
}

export function ContextMenuProvider({ children }) {
    const [menuState, setMenuState] = useState({
        visible: false,
        position: { x: 0, y: 0 },
        item: null, // { type: 'song'|'album'|'artist', data: {...} }
    });

    const openContextMenu = useCallback((e, type, data) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("🖱️ Context Request:", { x: e.clientX, y: e.clientY });
        setMenuState({
            visible: true,
            position: { x: e.clientX, y: e.clientY },
            item: { type, data },
        });
    }, []);

    const closeContextMenu = useCallback(() => {
        setMenuState((prev) => ({ ...prev, visible: false }));
    }, []);

    // Global right-click handler for items with specific classes
    useEffect(() => {
        const handleGlobalContextMenu = (e) => {
            const targetItem = e.target.closest(".song-item, .album-item, .artist-item");
            if (!targetItem) {
                // If clicking outside any item, let the default context menu show (or do nothing)
                // But if our menu is open, we might want to close it. 
                // The click handler below handles closing on outside click.
                return;
            }

            // If we found a target item, prevent default and open our menu
            e.preventDefault();

            const type = targetItem.classList.contains("song-item")
                ? "song"
                : targetItem.classList.contains("album-item")
                    ? "album"
                    : "artist";

            // Extract data attributes
            const data = { ...targetItem.dataset };

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
