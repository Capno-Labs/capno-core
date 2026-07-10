'use client';

import { useEffect } from 'react';

/** Registers the offline service worker (production only). */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Registration failure (e.g., private browsing) — app still works online.
    });
  }, []);
  return null;
}
