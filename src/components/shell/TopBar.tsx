'use client';

import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { SyncPill } from './SyncPill';

function crumbFor(pathname: string): string {
  if (pathname.startsWith('/faculty/run')) return 'Live session';
  if (pathname === '/debrief') return 'Debriefs';
  if (pathname.startsWith('/debrief/')) return 'Session report';
  if (pathname.startsWith('/scenarios')) return 'Case library';
  if (pathname.startsWith('/editor')) return 'Case editor';
  if (pathname.startsWith('/settings')) return 'Settings';
  if (pathname.startsWith('/account')) return 'Account';
  return 'Home';
}

/** Sticky workspace topbar: breadcrumb, sync state, theme toggle. */
export function TopBar() {
  const pathname = usePathname();
  return (
    <header className="no-print sticky top-0 z-30 flex h-[var(--topbar-h)] items-center justify-between gap-4 border-b border-line bg-surface/85 px-4 backdrop-blur-md md:px-7">
      <div className="min-w-0 truncate text-xs text-muted">
        Simulation lab / <strong className="font-semibold text-ink">{crumbFor(pathname)}</strong>
      </div>
      <div className="flex items-center gap-2">
        <SyncPill />
        <ThemeToggle />
      </div>
    </header>
  );
}
