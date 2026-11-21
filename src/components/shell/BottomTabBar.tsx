'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { NAV, isNavActive, type NavItem } from './nav';
import { OfflineCard } from './OfflineCard';

const TABS: NavItem[] = [NAV.home, NAV.library, NAV.run, NAV.debriefs];
/** Everything the tab bar has no room for — reachable from the More sheet. */
const MORE: NavItem[] = [NAV.editor, NAV.student, NAV.settings, NAV.account];

const TAB =
  'flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-ctl text-[10px] font-semibold transition duration-150 ease-brand';

/** Phone navigation: fixed bottom tab bar (the sidebar is hidden < md). */
export function BottomTabBar() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MORE.some((item) => isNavActive(pathname, item));

  // Navigating from the sheet closes it.
  useEffect(() => setMoreOpen(false), [pathname]);

  return (
    <>
      <nav
        aria-label="Main"
        className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 gap-1 border-t border-line bg-surface/95 px-2 pb-[calc(0.375rem+env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-md md:hidden"
      >
        {TABS.map((item) => {
          const active = isNavActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`${TAB} ${active ? 'bg-brand text-on-brand' : 'text-muted hover:text-ink'}`}
            >
              <Icon name={item.icon} size={18} />
              {item.short ?? item.label}
            </Link>
          );
        })}
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen(true)}
          className={`${TAB} ${moreActive ? 'bg-brand text-on-brand' : 'text-muted hover:text-ink'}`}
        >
          <Icon name="more" size={18} />
          More
        </button>
      </nav>

      <Dialog open={moreOpen} onClose={() => setMoreOpen(false)} title="More" variant="sheet">
        <div className="mt-2 grid gap-1 text-ink">
          {MORE.map((item) => {
            const active = isNavActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                {...(item.external ? { target: '_blank', rel: 'noopener' } : {})}
                aria-current={active ? 'page' : undefined}
                onClick={() => setMoreOpen(false)}
                className={`flex min-h-[48px] items-center gap-3 rounded-ctl px-3 text-sm font-semibold ${
                  active ? 'bg-brand text-on-brand' : 'text-ink-2 hover:bg-panel-2'
                }`}
              >
                <Icon name={item.icon} size={18} />
                {item.label}
                {item.external && <Icon name="external" size={13} className="ml-auto opacity-60" />}
              </Link>
            );
          })}
          <div className="mt-2 flex items-center justify-between gap-3 border-t border-line px-3 pt-3">
            <span className="text-sm font-semibold text-ink-2">Theme</span>
            <ThemeToggle />
          </div>
          <div className="mt-2">
            <OfflineCard />
          </div>
        </div>
      </Dialog>
    </>
  );
}
