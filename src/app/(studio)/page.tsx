'use client';

import Link from 'next/link';
import { GettingStarted } from '@/components/home/GettingStarted';
import { Button } from '@/components/ui/Button';
import { Poster } from '@/components/ui/Poster';
import { DISPLAY_COPY } from '@/lib/displayCopy';
import { DEMO_HREF } from '@/lib/onboarding';

/**
 * Workflow-oriented home. The poster is the faculty fast path (run a case)
 * with the student display — the second role in the room — beside it; the
 * getting-started checklist shows until it is done or hidden; review and
 * authoring are secondary. Plain-language actions throughout — CAPNO Studio
 * is the only branded name.
 */

const SECONDARY = [
  {
    href: '/debrief',
    title: 'Review debriefs',
    desc: 'Card-by-card debrief walkthroughs and printable records from completed sessions.',
  },
  {
    href: '/editor',
    title: 'Build a case',
    desc: 'Author new cases for the library — form-based editing with JSON preview and import/export.',
  },
  {
    href: '/scenarios/import',
    title: 'Import a run sheet',
    desc: 'Turn the instructor guide you already teach from into a runnable, reviewable case.',
  },
];

const STRIP = [
  { href: '/editor', label: 'Build' },
  { href: '/scenarios', label: 'Run' },
  { href: '/debrief', label: 'Debrief' },
];

export default function HomePage() {
  return (
    <div className="space-y-6">
      <Poster
        label="CAPNO Studio / Faculty workspace"
        titleLines={[...DISPLAY_COPY.home]}
        promise="Pick a reviewed case and drive the simulated monitor — vitals, events, and learner assessment from one controller. Everything works offline on this device."
        actions={
          <>
            <Button variant="onBlue" href="/scenarios" arrow>
              Open the case library
            </Button>
            <Button variant="ghostOnBlue" href="/faculty/run/quick-start" icon="play">
              Quick start
            </Button>
          </>
        }
        aside={
          /* Student display: the second role in the room. */
          <Link
            href="/student"
            className="group block w-full max-w-xs rounded-card bg-poster-ink p-5 ring-1 ring-poster-line/30 transition duration-150 ease-brand hover:ring-poster-line/70"
          >
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-poster-muted">
              Student display
            </span>
            <span className="my-4 flex gap-2" aria-hidden>
              {['K', '7', 'C', 'P'].map((c) => (
                <span
                  key={c}
                  className="grid h-12 w-10 place-items-center rounded-ctl bg-poster-raised font-mono text-xl font-bold text-white ring-1 ring-white/15"
                >
                  {c}
                </span>
              ))}
            </span>
            <span className="block text-sm text-poster-muted">
              Full-screen patient monitor for the sim room. No account — join with the session
              code.
            </span>
            <span className="mt-3 block text-sm font-semibold text-white">
              Join with a code <span className="link-arrow">→</span>
            </span>
          </Link>
        }
        footer={
          <nav
            aria-label="Workflow"
            className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] font-semibold uppercase tracking-[0.16em]"
          >
            {STRIP.map((s, i) => (
              <span key={s.href} className="flex items-center gap-3">
                {i > 0 && (
                  <span aria-hidden className="text-poster-line">
                    /
                  </span>
                )}
                <Link href={s.href} className="text-white hover:underline">
                  {s.label}
                </Link>
              </span>
            ))}
          </nav>
        }
      />

      <GettingStarted />

      <div className="grid gap-x-8 gap-y-2 sm:grid-cols-3">
        {SECONDARY.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="group border-t-2 border-ink py-4 transition duration-150 ease-brand hover:border-brand-strong"
          >
            <h2 className="flex items-center gap-2 text-base font-bold">
              {r.title}
              <span aria-hidden className="link-arrow text-brand-strong">
                →
              </span>
            </h2>
            <p className="mt-1 text-sm text-muted">{r.desc}</p>
          </Link>
        ))}
      </div>

      <p className="text-center text-sm text-muted">
        New here?{' '}
        <Link href={DEMO_HREF} className="link">
          Try the guided demo →
        </Link>{' '}
        <span className="text-faint">(laryngospasm after LMA placement)</span>
      </p>

      <footer className="text-center text-xs text-faint">
        For simulation and education only — not for clinical use. · Apache-2.0 core ·{' '}
        <a className="underline hover:text-muted" href="https://capno.app">
          capno.app
        </a>{' '}
        ·{' '}
        <a className="underline hover:text-muted" href="https://github.com/Capno-Labs/capno-core">
          GitHub
        </a>
      </footer>
    </div>
  );
}
