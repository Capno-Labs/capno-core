'use client';

import { useEffect } from 'react';

/**
 * Warn before closing/refreshing the tab while `when` is true (live session,
 * unsaved edits). In-app <Link> navigation is not guarded — the app router
 * has no supported route-blocking API.
 */
export function useBeforeUnload(when: boolean): void {
  useEffect(() => {
    if (!when) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [when]);
}
