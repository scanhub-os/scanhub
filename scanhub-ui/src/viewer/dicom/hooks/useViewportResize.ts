// hooks/useViewportResize.ts
import React from 'react';
import type { RenderingEngine } from '@cornerstonejs/core';
import type { ViewLayout } from '../cornerstone/viewLayouts';

export function useViewportResize(
  engineRef: React.RefObject<RenderingEngine | null>,
  layout: ViewLayout,
  containerRef: React.RefObject<HTMLDivElement | null>
) {
  React.useEffect(() => {
    const container = containerRef.current;
    const engine = engineRef.current;
    if (!container || !engine) return;

    // Observe every tile; a single grid resize can miss some tiles otherwise
    const tiles = Array.from(container.querySelectorAll<HTMLDivElement>('[id^="viewport-"]'));

    const observer = new ResizeObserver(() => {
      // Skip if everything is 0x0 (hidden during panel transitions)
      const allZero = tiles.every(t => t.clientWidth === 0 || t.clientHeight === 0);
      if (allZero) return;

      // Defer one frame so CSS grid has finalized sizes
      requestAnimationFrame(() => {
        try {
          // Cornerstone 4: engine-level resize handles all viewports’ projection
          engine.resize(false, true);
          engine.render();
        } catch (e) {
          // ignore transient races during enable/disable
        }
      });
    });

    tiles.forEach(t => observer.observe(t));
    return () => observer.disconnect();
  }, [engineRef, layout, containerRef]);
}
