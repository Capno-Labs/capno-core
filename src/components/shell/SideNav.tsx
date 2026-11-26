'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrandMark } from '@/components/brand/BrandMark';
import { CapnoWordmark } from '@/components/brand/CapnoWordmark';
import { Icon } from '@/components/ui/Icon';
import { MAIN_NAV, WORKSPACE_NAV, isNavActive, type NavItem } from './nav';
import { OfflineCard } from './OfflineCard';
import { ProfileRow } from './ProfileRow';

/** 'hidden' below lg — or always, in rail mode. */
const labelClass = (rail: boolean) => (rail ? 'hidden' : 'hidden lg:block');

function NavLink({ item, rail, pathname }: { item: NavItem; rail: boolean; pathname: string }) {
  const active = isNavActive(pathname, item);
  return (
    <Link
      href={item.href}
      {...(item.external ? { target: '_blank', rel: 'noopener' } : {})}
      aria-current={active ? 'page' : undefined}
      // The label is hidden in the icon rail, so name the link explicitly.
      aria-label={item.label}
      title={item.label}
      className={`flex min-h-[42px] items-center gap-3 rounded-ctl px-3 py-2 text-sm font-semibold transition duration-150 ease-brand ${
        rail ? 'justify-center px-0' : 'justify-center px-0 lg:justify-start lg:px-3'
      } ${active ? 'bg-brand text-on-brand' : 'text-muted hover:bg-panel-2 hover:text-ink'}`}
    >
      <Icon name={item.icon} size={18} />
      <span className={`truncate ${labelClass(rail)}`}>{item.label}</span>
      {item.external && (
        <Icon name="external" size={13} className={`ml-auto opacity-60 ${labelClass(rail)}`} />
      )}
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
        aria-label="CAPNO Studio home"
        className={`mb-4 flex items-center gap-2.5 px-2 py-1 ${
          rail ? 'justify-center px-0' : 'justify-center px-0 lg:justify-start lg:px-2'
        }`}
      >
        <BrandMark />
        <span className={`min-w-0 leading-tight ${labelClass(rail)}`}>
          {/* The name is the logo's own lettering, then the product word in
              type; the link's label carries "CAPNO Studio" for readers. */}
          <span className="flex items-center gap-1.5 text-sm font-semibold tracking-tight text-ink">
            <CapnoWordmark className="h-[13px] w-auto shrink-0 text-logo" />
            Studio
          </span>
          <span className="block font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-faint">
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
        className={`mx-2 mb-1 mt-4 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-faint ${labelClass(rail)}`}
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
      <p className={`px-2 pt-1 text-[10px] leading-snug text-faint ${labelClass(rail)}`}>
        Simulation only — not for clinical use.
      </p>
    </div>
  );
}
