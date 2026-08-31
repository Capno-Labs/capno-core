'use client';

import { usePathname } from 'next/navigation';
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
  const runFocus = pathname.startsWith('/faculty/run/');

  return (
    <div className="min-h-screen md:grid md:grid-cols-[auto_minmax(0,1fr)]" style={{ ['--topbar-h' as string]: '68px' }}>
      <aside
        className={`no-print sticky top-0 hidden h-screen shrink-0 border-r border-line bg-panel/60 md:block ${
          runFocus ? 'w-[68px]' : 'w-[68px] lg:w-[236px]'
        }`}
      >
        {/* Render both variants and let breakpoints pick, so resize needs no JS. */}
        <div className={runFocus ? 'hidden' : 'hidden h-full lg:block'}>
          <SideNav rail={false} />
        </div>
        <div className={runFocus ? 'block h-full' : 'block h-full lg:hidden'}>
          <SideNav rail />
        </div>
      </aside>
      <div className="min-w-0">
        <TopBar />
        <main className="print-main mx-auto w-full max-w-[1440px] px-4 pb-24 pt-6 md:px-7 md:pb-12">
          {children}
        </main>
      </div>
      <BottomTabBar />
    </div>
  );
}
