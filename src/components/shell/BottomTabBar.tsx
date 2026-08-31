'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isNavActive, type NavItem } from './SideNav';

const TABS: NavItem[] = [
  { href: '/', label: 'Home', icon: '⌂' },
  { href: '/scenarios', label: 'Cases', icon: '▦' },
  { href: '/debrief', label: 'Debriefs', icon: '✓' },
  { href: '/settings', label: 'More', icon: '⚙' },
];

/** Phone navigation: fixed bottom tab bar (the sidebar is hidden < md). */
export function BottomTabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 gap-1 border-t border-line bg-surface/95 px-2 py-1.5 backdrop-blur-md md:hidden"
    >
      {TABS.map((item) => {
        const active = isNavActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-ctl text-[10px] font-semibold ${
              active ? 'bg-ink text-surface' : 'text-muted hover:text-ink'
            }`}
          >
            <span aria-hidden className="text-sm">
              {item.icon}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
