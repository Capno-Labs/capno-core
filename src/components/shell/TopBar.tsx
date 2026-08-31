'use client';

import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { MAIN_NAV, WORKSPACE_NAV, isNavActive } from './SideNav';
import { SyncPill } from './SyncPill';

// Routes whose crumb differs from (or is missing from) the nav labels.
const CRUMB_OVERRIDES: [test: (p: string) => boolean, label: string][] = [
  [(p) => p.startsWith('/faculty/run'), 'Live session'],
  [(p) => p.startsWith('/debrief/'), 'Session report'],
];

function crumbFor(pathname: string): string {
  for (const [test, label] of CRUMB_OVERRIDES) if (test(pathname)) return label;
  const item = [...MAIN_NAV, ...WORKSPACE_NAV].find((i) => isNavActive(pathname, i));
  return item?.label ?? 'Home';
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
