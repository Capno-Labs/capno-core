import Link from 'next/link';
import { PageHead } from '@/components/ui/PageHead';

/**
 * Workflow-oriented home. The dark hero card is the faculty fast path (run a
 * case); the student-display card mirrors the second role in the room;
 * review and authoring are secondary. Plain-language actions throughout —
 * CAPNO Studio is the only branded name.
 */

const SECONDARY = [
  {
    href: '/debrief',
    title: 'Review debriefs',
    desc: 'Timelines, scores, and printable reports from completed sessions.',
  },
  {
    href: '/editor',
    title: 'Build a case',
    desc: 'Author new cases for the library — form-based editing with JSON preview and import/export.',
  },
  {
    href: '/faculty/run/quick-start',
    title: 'Quick-start freeform',
    desc: 'Standardized patient, normal baseline vitals, no script — you drive everything live.',
  },
];

export default function HomePage() {
  return (
    <>
      <h1 className="sr-only">CAPNO Studio — anesthesia simulation lab</h1>
      <PageHead
        eyebrow="Simulation lab"
        title="Run today's case."
        lede="Faculty-controlled patient monitor, scenario engine, and structured debriefing — everything works offline on this device."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.55fr)]">
        {/* Dark hero: the faculty fast path. Fixed near-black surface in both themes. */}
        <Link
          href="/scenarios"
          className="card-interactive relative flex min-h-[240px] flex-col justify-between overflow-hidden !bg-[#11120f] !p-7 !ring-[#3d4237]"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-amber/10"
          />
          <div>
            <span className="inline-flex items-center rounded-full bg-[#3a3314] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#ffe164]">
              Faculty
            </span>
            <h2 className="mt-4 max-w-md text-3xl font-bold leading-none tracking-[-0.04em] text-[#f5f5ed] md:text-4xl">
              Start teaching in under two minutes.
            </h2>
            <p className="mt-3 max-w-md text-sm text-[#b8bbb0]">
              Pick a reviewed case, drive the simulated monitor — vitals, events, and learner
              assessment from the faculty controller.
            </p>
          </div>
          <span className="relative mt-5 inline-flex items-center gap-2 self-start rounded-ctl bg-amber px-3.5 py-2 text-sm font-bold text-[#1b1c17]">
            Open the case library <span className="link-arrow">→</span>
          </span>
        </Link>

        {/* Student display join card. */}
        <Link href="/student" className="card-interactive flex flex-col !p-6">
          <h2 className="text-lg font-bold">Student display</h2>
          <p className="mt-1 text-sm text-muted">
            Full-screen patient monitor for the sim room. No account — join with the 4-character
            session code from your instructor.
          </p>
          <div className="my-5 flex justify-center gap-2" aria-hidden>
            {['K', '7', 'C', 'P'].map((c, i) => (
              <span
                key={i}
                className="grid h-12 w-10 place-items-center rounded-ctl bg-panel-2 font-mono text-xl font-bold text-ink ring-1 ring-line"
              >
                {c}
              </span>
            ))}
          </div>
          <span className="mt-auto text-sm font-semibold text-amber-strong">
            Join with a code <span className="link-arrow">→</span>
          </span>
        </Link>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {SECONDARY.map((r) => (
          <Link key={r.href} href={r.href} className="card-interactive flex flex-col gap-1 !p-4">
            <h2 className="text-base font-bold">{r.title}</h2>
            <p className="text-sm text-muted">{r.desc}</p>
          </Link>
        ))}
      </div>

      <p className="mt-8 text-center text-sm text-muted">
        New here?{' '}
        <Link
          href="/faculty/run/laryngospasm-lma?demo=1"
          className="font-semibold text-amber-strong underline-offset-2 hover:underline"
        >
          Try the guided demo →
        </Link>{' '}
        <span className="text-faint">(laryngospasm after LMA placement)</span>
      </p>

      <footer className="mt-6 text-center text-xs text-faint">
        For simulation and education only — not for clinical use. · Apache-2.0 core ·{' '}
        <a className="underline hover:text-muted" href="https://capno.app">
          capno.app
        </a>{' '}
        ·{' '}
        <a className="underline hover:text-muted" href="https://github.com/Capno-Labs/capno-core">
          GitHub
        </a>
      </footer>
    </>
  );
}
