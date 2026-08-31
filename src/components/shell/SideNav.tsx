'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CapnoGlyph } from '@/components/brand/CapnoGlyph';
import { OfflineCard } from './OfflineCard';
import { ProfileRow } from './ProfileRow';

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  /** Match the active state on this prefix (exact match for '/'). */
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

function NavLink({ item, rail }: { item: NavItem; rail: boolean }) {
  const pathname = usePathname();
  const active = isNavActive(pathname, item);
  return (
    <Link
      href={item.href}
      {...(item.external ? { target: '_blank', rel: 'noopener' } : {})}
      aria-current={active ? 'page' : undefined}
      title={rail ? item.label : undefined}
      className={`flex min-h-[42px] items-center gap-3 rounded-ctl px-3 py-2 text-sm font-semibold transition duration-150 ${
        rail ? 'justify-center px-0' : ''
      } ${
        active
          ? 'bg-ink text-surface'
          : 'text-muted hover:bg-panel-2 hover:text-ink'
      }`}
    >
      <span aria-hidden className="w-5 text-center text-base">
        {item.icon}
      </span>
      {!rail && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

/**
 * Faculty-workspace sidebar. `rail` renders the icon-only variant (narrow
 * viewports, and auto-collapsed on the live-session cockpit so the monitor
 * keeps its width on iPad landscape).
 */
export function SideNav({ rail }: { rail: boolean }) {
  return (
    <div className="flex h-full flex-col gap-1 p-3">
      <Link
        href="/"
        className={`mb-4 flex items-center gap-2.5 px-2 py-1 ${rail ? 'justify-center px-0' : ''}`}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-ctl bg-[#0d0f0c] ring-1 ring-[#30342b]">
          <CapnoGlyph className="h-4 w-auto text-vital-etco2" />
        </span>
        {!rail && (
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-bold tracking-tight text-ink">
              CAPNO Studio
            </span>
            <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-faint">
              Faculty workspace
            </span>
          </span>
        )}
      </Link>
      <nav aria-label="Main" className="grid gap-1">
        {MAIN_NAV.map((item) => (
          <NavLink key={item.href} item={item} rail={rail} />
        ))}
      </nav>
      {!rail && (
        <div className="mx-2 mb-1 mt-4 text-[10px] font-bold uppercase tracking-[0.12em] text-faint">
          Workspace
        </div>
      )}
      {rail && <div className="mx-2 my-2 border-t border-line" />}
      <nav aria-label="Workspace" className="grid gap-1">
        {WORKSPACE_NAV.map((item) => (
          <NavLink key={item.href} item={item} rail={rail} />
        ))}
      </nav>
      <div className="flex-1" />
      {!rail && <OfflineCard />}
      <ProfileRow rail={rail} />
    </div>
  );
}
