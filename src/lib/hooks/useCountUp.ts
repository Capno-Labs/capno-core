'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Animate a number toward `target` with an ease-out count-up. Starts from 0
 * on mount and from the currently displayed value on later target changes
 * (so score amendments animate old → new). Snaps instantly under
 * prefers-reduced-motion. Screen-only sugar — render the true target in a
 * print-only element where the final value must be guaranteed.
 */
export function useCountUp(target: number, durationMs = 900): number {
  const [shown, setShown] = useState(0);
  const shownRef = useRef(0);
  shownRef.current = shown;

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(target);
      return;
    }
    const from = shownRef.current;
    if (from === target) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(from + (target - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return shown;
}
