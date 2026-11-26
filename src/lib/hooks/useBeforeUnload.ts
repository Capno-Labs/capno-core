'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { confirmDialog, type ConfirmOptions } from '@/lib/store/dialogStore';

/**
 * Warn before closing/refreshing the tab while `when` is true (live session,
 * unsaved edits). In-app <Link> navigation is not guarded here — see
 * `useLeaveGuard` for that.
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

/**
 * `useBeforeUnload` plus a guard on in-app links: while `when` is true, a
 * click on a link to another page asks first. The app router has no
 * route-blocking API, so this intercepts the click itself; the browser's
 * Back button is not covered.
 */
export function useLeaveGuard(when: boolean, ask: ConfirmOptions): void {
  const router = useRouter();
  useBeforeUnload(when);

  useEffect(() => {
    if (!when) return;
    const handler = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = e.target instanceof Element ? e.target.closest('a[href]') : null;
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === '_blank') return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      void confirmDialog(ask).then((leave) => {
        if (leave) router.push(`${url.pathname}${url.search}${url.hash}`);
      });
    };
    // Capture phase: ahead of next/link's own click handler.
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
    // `ask` is copy; re-subscribing on `when` alone is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [when, router]);
}
