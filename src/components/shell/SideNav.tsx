'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CapnoGlyph } from '@/components/brand/CapnoGlyph';
import { OfflineCard } from './OfflineCard';
import { ProfileRow } from './ProfileRow';

export interface NavItem {
  /** Route the item links to; also the prefix its active state matches
   *  (exact match for '/', any `/faculty/run/*` for the run route). */
  href: string;
  label: string;
  icon: string;
  /** Opens in a new tab (for the student display's separate surface). */
  external?: boolean;
}

export const MAIN_NAV: NavItem[] = [
  { href: '/', label: 'Home', icon: '⌂' },
  { href: '/scenarios', label: 'Case library', icon: '▦' },
  { href: '/faculty/run/quick-start', label: 'New session', icon: '＋' },
  { href: '/debrief', label: 'Debriefs', icon: '✓' },
  { href: '/editor', label: 'Case editor', icon: '✎' },
];

export const WORKSPACE_NAV: NavItem[] = [
  { href: '/student', label: 'Student display', icon: '⧉', external: true },
  { href: '/settings', label: 'Settings', icon: '⚙' },
  { href: '/account', label: 'Account', icon: '◍' },
];

export function isNavActive(pathname: string, item: NavItem): boolean {
  if (item.href === '/') return pathname === '/';
  if (item.href.startsWith('/faculty/run/')) return pathname.startsWith('/faculty/run/');
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** 'hidden' below lg — or always, in rail mode. */
const labelClass = (rail: boolean) => (rail ? 'hidden' : 'hidden lg:block');

function NavLink({ item, rail, pathname }: { item: NavItem; rail: boolean; pathname: string }) {
  const active = isNavActive(pathname, item);
  return (
    <Link
      href={item.href}
      {...(item.external ? { target: '_blank', rel: 'noopener' } : {})}
      aria-current={active ? 'page' : undefined}
      title={item.label}
      className={`flex min-h-[42px] items-center gap-3 rounded-ctl px-3 py-2 text-sm font-semibold transition duration-150 ${
        rail ? 'justify-center px-0' : 'justify-center px-0 lg:justify-start lg:px-3'
      } ${
        active
          ? 'bg-ink text-surface'
          : 'text-muted hover:bg-panel-2 hover:text-ink'
      }`}
    >
      <span aria-hidden className="w-5 text-center text-base">
        {item.icon}
      </span>
      <span className={`truncate ${labelClass(rail)}`}>{item.label}</span>
    </Link>
  );
}

/**
 * Faculty-workspace sidebar — one tree for every width. Below `lg` (and
 * always when `rail` is set, e.g. on the live-session cockpit so the monitor
 * keeps its width on iPad landscape) the labels collapse via CSS and only
 * the icon column shows.
 */
export function SideNav({ rail }: { rail: boolean }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col gap-1 p-3">
      <Link
        href="/"
        className={`mb-4 flex items-center gap-2.5 px-2 py-1 ${
          rail ? 'justify-center px-0' : 'justify-center px-0 lg:justify-start lg:px-2'
        }`}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-ctl bg-[#0d0f0c] ring-1 ring-[#30342b]">
          <CapnoGlyph className="h-4 w-auto text-vital-etco2" />
        </span>
        <span className={`min-w-0 leading-tight ${labelClass(rail)}`}>
          <span className="block truncate text-sm font-bold tracking-tight text-ink">
            CAPNO Studio
          </span>
          <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-faint">
            Faculty workspace
          </span>
        </span>
      </Link>
      <nav aria-label="Main" className="grid gap-1">
        {MAIN_NAV.map((item) => (
          <NavLink key={item.href} item={item} rail={rail} pathname={pathname} />
        ))}
      </nav>
      <div
        className={`mx-2 mb-1 mt-4 text-[10px] font-bold uppercase tracking-[0.12em] text-faint ${labelClass(rail)}`}
      >
        Workspace
      </div>
      <div className={`mx-2 my-2 border-t border-line ${rail ? '' : 'lg:hidden'}`} />
      <nav aria-label="Workspace" className="grid gap-1">
        {WORKSPACE_NAV.map((item) => (
          <NavLink key={item.href} item={item} rail={rail} pathname={pathname} />
        ))}
      </nav>
      <div className="flex-1" />
      <div className={labelClass(rail)}>
        <OfflineCard />
      </div>
      <ProfileRow rail={rail} />
    </div>
  );
}
