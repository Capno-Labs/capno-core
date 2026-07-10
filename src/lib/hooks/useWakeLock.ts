'use client';

import { useEffect, useRef } from 'react';

// Minimal declarations so we don't depend on TS lib/dom versions that may
// lack Screen Wake Lock types. No @types package — feature-detected at runtime.
interface WakeLockSentinelLike {
  release: () => Promise<void>;
}
interface WakeLockLike {
  request: (type: 'screen') => Promise<WakeLockSentinelLike>;
}

/**
 * Keep the screen awake while `active` (student monitor on a projector/iPad).
 * Silently a no-op where the Wake Lock API is unavailable (insecure context,
 * older browsers) — the display simply keeps its normal sleep behavior.
 * Re-acquires on visibilitychange because the lock auto-releases when the
 * tab is hidden.
 */
export function useWakeLock(active: boolean): void {
  const sentinel = useRef<WakeLockSentinelLike | null>(null);

  useEffect(() => {
    const wakeLock = (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock;
    if (!active || !wakeLock) return;

    let cancelled = false;
    const request = async () => {
      try {
        const s = await wakeLock.request('screen');
        if (cancelled) await s.release();
        else sentinel.current = s;
      } catch {
        // Denied or unsupported — degrade silently.
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void request();
    };

    void request();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      sentinel.current?.release().catch(() => {});
      sentinel.current = null;
    };
  }, [active]);
}
