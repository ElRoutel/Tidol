import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

/**
 * Portal component to render children outside the DOM hierarchy
 * Ensures children escape stacking contexts created by transform/filter/backdrop-filter
 */
export default function Portal({ children }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        // Create portal root if it doesn't exist
        let portalRoot = document.getElementById('portal-root');
        if (!portalRoot) {
            portalRoot = document.createElement('div');
            portalRoot.id = 'portal-root';
            // position: fixed removes it from document flow completely
            // pointer-events: none allows clicks to pass through the container
            // Children must set pointer-events: auto to be clickable
            portalRoot.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 99999;';
            document.body.appendChild(portalRoot);
        }
        setMounted(true);

        return () => {
            // Don't remove portal-root on unmount as other portals might be using it
        };
    }, []);

    if (!mounted) return null;

    const portalRoot = document.getElementById('portal-root');
    return portalRoot ? ReactDOM.createPortal(children, portalRoot) : null;
}
