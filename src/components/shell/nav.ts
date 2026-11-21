import type { IconName } from '@/components/ui/Icon';

/**
 * The one source of navigation labels and routes — sidebar, phone tab bar,
 * breadcrumb and 404 all read from here so the names can't drift
 * ("Case library" is the case library everywhere).
 */
export interface NavItem {
  /** Route the item links to; also the prefix its active state matches
   *  (exact match for '/', any `/faculty/run/*` for the run route). */
  href: string;
  label: string;
  /** Short label for the phone tab bar. */
  short?: string;
  icon: IconName;
  /** Opens in a new tab (for the student display's separate surface). */
  external?: boolean;
}

export const NAV = {
  home: { href: '/', label: 'Home', icon: 'home' },
  library: { href: '/scenarios', label: 'Case library', short: 'Library', icon: 'library' },
  run: { href: '/faculty/run/quick-start', label: 'New session', short: 'Run', icon: 'play' },
  debriefs: { href: '/debrief', label: 'Debriefs', icon: 'debrief' },
  editor: { href: '/editor', label: 'Case editor', icon: 'edit' },
  student: { href: '/student', label: 'Student display', icon: 'monitor', external: true },
  settings: { href: '/settings', label: 'Settings', icon: 'settings' },
  account: { href: '/account', label: 'Account', icon: 'user' },
} satisfies Record<string, NavItem>;

export const MAIN_NAV: NavItem[] = [NAV.home, NAV.library, NAV.run, NAV.debriefs, NAV.editor];
export const WORKSPACE_NAV: NavItem[] = [NAV.student, NAV.settings, NAV.account];

export function isNavActive(pathname: string, item: NavItem): boolean {
  if (item.href === '/') return pathname === '/';
  if (item.href.startsWith('/faculty/run/')) return pathname.startsWith('/faculty/run/');
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

// Routes whose crumb differs from (or is missing from) the nav labels.
const CRUMB_OVERRIDES: [test: (p: string) => boolean, label: string][] = [
  [(p) => p.startsWith('/faculty/run'), 'Live session'],
  [(p) => p.startsWith('/debrief/'), 'Session report'],
  [(p) => p.startsWith('/scenarios/import'), 'Import a run sheet'],
];

export function crumbFor(pathname: string): string {
  for (const [test, label] of CRUMB_OVERRIDES) if (test(pathname)) return label;
  const item = [...MAIN_NAV, ...WORKSPACE_NAV].find((i) => isNavActive(pathname, i));
  return item?.label ?? NAV.home.label;
}
