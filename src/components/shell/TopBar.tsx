'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrandMark } from '@/components/brand/BrandMark';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { crumbFor } from './nav';
import { SyncPill } from './SyncPill';

/** Sticky workspace topbar: breadcrumb, sync state, theme toggle. On phones
 *  (no sidebar) it also carries the brand mark. */
export function TopBar() {
  const pathname = usePathname();
  return (
    <header className="no-print sticky top-0 z-30 flex h-[var(--topbar-h)] items-center justify-between gap-4 border-b border-line bg-surface/85 px-4 backdrop-blur-md md:px-7">
      <div className="flex min-w-0 items-center gap-3">
        <Link href="/" aria-label="CAPNO Studio home" className="md:hidden">
          <BrandMark size="sm" />
        </Link>
        <div className="min-w-0 truncate font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
          <span className="hidden sm:inline">Simulation lab / </span>
          <strong className="font-semibold text-ink">{crumbFor(pathname)}</strong>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <SyncPill />
        <ThemeToggle />
      </div>
    </header>
  );
}
