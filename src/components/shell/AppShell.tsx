'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/cloud/authStore';
import { useControllerStore } from '@/lib/store/controllerStore';
import { confirmDialog } from '@/lib/store/dialogStore';
import { BottomTabBar } from './BottomTabBar';
import { SideNav } from './SideNav';
import { TopBar } from './TopBar';

/**
 * Faculty-workspace shell: persistent sidebar + sticky topbar around the
 * (studio) routes. On the live-session cockpit the sidebar collapses to an
 * icon rail so the three-zone controller keeps its width (iPad Pro 12.9"
 * landscape is 1366 CSS px — see the `desk` breakpoint note in
 * tailwind.config.ts). The student display lives outside this shell.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const runFocus = pathname.startsWith('/faculty/run/');
  // Boolean selector: re-renders only when liveness flips, not per snapshot.
  const sessionLive = useControllerStore(
    (s) => s.snapshot?.status === 'running' || s.snapshot?.status === 'paused',
  );

  // The shell surfaces auth state (SyncPill, ProfileRow) on every page, so it
  // owns the init call instead of relying on per-page side effects. Idempotent.
  useEffect(() => {
    useAuthStore.getState().init();
  }, []);

  // `useBeforeUnload` on the run page guards reload/close but not client-side
  // navigation — and the shell puts nav links on screen during a live session.
  // Capture-phase guard on both nav surfaces so one stray tap can't silently
  // tear the session down (unmount runs the cockpit's teardown()). The dialog
  // is async, so the click is always cancelled first and the navigation is
  // replayed only after the faculty confirms.
  const guardLiveSession = (e: React.MouseEvent) => {
    if (!runFocus || !sessionLive || !(e.target instanceof Element)) return;
    const link = e.target.closest('a');
    const href = link?.getAttribute('href');
    if (!link || !href) return;
    e.preventDefault();
    e.stopPropagation();
    const newTab = link.target === '_blank';
    void confirmDialog({
      title: 'Leave the live session?',
      body: 'A live session is running. Leaving now stops it without saving a debrief, and connected student displays will disconnect.',
      confirmLabel: 'Leave session',
      cancelLabel: 'Stay',
      tone: 'danger',
    }).then((leave) => {
      if (!leave) return;
      if (newTab) window.open(href, '_blank', 'noopener');
      else router.push(href);
    });
  };

  return (
    <div
      className="min-h-screen md:grid md:grid-cols-[auto_minmax(0,1fr)]"
      style={{ ['--topbar-h' as string]: '60px' }}
    >
      <aside
        onClickCapture={guardLiveSession}
        className={`no-print sticky top-0 hidden h-screen shrink-0 border-r border-line bg-surface md:block ${
          runFocus ? 'w-[68px]' : 'w-[68px] lg:w-[236px]'
        }`}
      >
        <SideNav rail={runFocus} />
      </aside>
      <div className="min-w-0">
        <TopBar />
        <main className="print-main mx-auto w-full max-w-[1440px] px-4 pb-28 pt-6 md:px-7 md:pb-12">
          {children}
        </main>
      </div>
      <div onClickCapture={guardLiveSession} className="contents">
        <BottomTabBar />
      </div>
    </div>
  );
}
