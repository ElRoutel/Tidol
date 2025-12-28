import { useState, useEffect, useCallback } from 'react';

/**
 * ⚡ BOLT: Optimization
 * Custom hook to dynamically calculate the height of a container element.
 * It uses a ResizeObserver to efficiently track height changes without
 * causing re-renders on every window resize event. This is crucial for
 * ensuring the virtualized list fills its container adaptively.
 *
 * @returns {[React.RefCallback, number]} A ref callback to attach to the
 * target element and the measured height.
 */
export const useResponsiveListHeight = () => {
  const [height, setHeight] = useState(0);
  const [node, setNode] = useState(null);

  const ref = useCallback((node) => {
    setNode(node);
  }, []);

  useEffect(() => {
    if (node) {
      const resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry && entry.contentRect) {
          setHeight(entry.contentRect.height);
        }
      });

      resizeObserver.observe(node);

      return () => {
        resizeObserver.disconnect();
      };
    }
  }, [node]);

  return [ref, height];
};
