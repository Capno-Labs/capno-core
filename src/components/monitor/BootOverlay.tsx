'use client';

import { useEffect } from 'react';

/**
 * One-shot CRT power-on moment shown over the student monitor when a join
 * succeeds. Purely presentational: the monitor mounts and ticks underneath
 * from the first frame — this opaque overlay just delays the reveal ~1.2s
 * with a sweep line and a flicker-off. Skipped entirely (0ms) under
 * prefers-reduced-motion, where the CSS also hides it.
 */
export function BootOverlay({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = setTimeout(onDone, reduced ? 0 : 1200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-monitor-bg motion-safe:animate-crt-fade motion-reduce:hidden"
    >
      <div className="h-px w-2/3 origin-left bg-vital-etco2 shadow-[0_0_12px_2px_rgba(250,204,21,0.6)] motion-safe:animate-crt-line" />
      <span className="font-mono text-xs uppercase tracking-[0.3em] text-slate-500">
        CAPNO monitor
      </span>
    </div>
  );
}
