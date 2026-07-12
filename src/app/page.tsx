import Link from 'next/link';

/**
 * Workflow-oriented landing page. The two primary cards match the two roles
 * in the room (faculty runs a case, the student device joins a display);
 * review and authoring are secondary. Plain-language actions throughout —
 * CAPNO Studio is the only branded name.
 */

const PRIMARY = [
  {
    href: '/scenarios',
    title: 'Run a Case',
    desc: 'Pick a case from the library and drive the simulated patient monitor — vitals, events, and learner assessment from the faculty controller.',
    accent: 'ring-vital-ecg/40 hover:ring-vital-ecg',
    arrow: 'text-vital-ecg',
    cta: 'Open the case library',
  },
  {
    href: '/student',
    title: 'Join as Student Display',
    desc: 'Full-screen patient monitor for the sim room. Join with the session code or link from your instructor.',
    accent: 'ring-sky-500/40 hover:ring-sky-400',
    arrow: 'text-sky-400',
    cta: 'Join with a code',
  },
];

const SECONDARY = [
  {
    href: '/debrief',
    title: 'Review Debriefs',
    desc: 'Timelines, scores, and printable reports from completed sessions.',
  },
  {
    href: '/editor',
    title: 'Build a Case',
    desc: 'Author new cases for the library — form-based editing with JSON preview and import/export.',
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center gap-8 px-6 py-12">
      <header className="text-center">
        <h1 className="sr-only">CAPNO Studio</h1>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/capno-lockup-stacked.svg"
          alt=""
          className="mx-auto h-40 w-auto [filter:drop-shadow(0_0_16px_rgba(250,204,21,0.25))] md:h-48"
        />
        <p className="mx-auto mt-3 max-w-xl text-slate-400">
          Open anesthesia simulation platform — faculty-controlled patient monitor, scenario
          engine, and structured debriefing for the sim lab.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {PRIMARY.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className={`card-interactive flex flex-col gap-1.5 !p-5 ring-2 ${r.accent}`}
          >
            <h2 className="text-xl font-bold">{r.title}</h2>
            <p className="text-sm text-slate-400">{r.desc}</p>
            <span className={`mt-auto pt-1 text-sm font-semibold ${r.arrow}`}>
              {r.cta} <span className="link-arrow">→</span>
            </span>
          </Link>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {SECONDARY.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="card flex flex-col gap-1 !p-4 ring-1 ring-slate-800 transition hover:ring-slate-600"
          >
            <h2 className="text-base font-bold">{r.title}</h2>
            <p className="text-sm text-slate-400">{r.desc}</p>
          </Link>
        ))}
      </div>

      <p className="text-center text-sm text-slate-400">
        New here?{' '}
        <Link
          href="/faculty/run/laryngospasm-lma"
          className="font-semibold text-vital-ecg underline-offset-2 hover:underline"
        >
          Try the demo case →
        </Link>{' '}
        <span className="text-slate-500">(laryngospasm after LMA placement)</span>
      </p>

      <footer className="text-center text-xs text-slate-600">
        For simulation and education only — not for clinical use. · Apache-2.0 core ·{' '}
        <a className="underline hover:text-slate-400" href="https://capno.app">
          capno.app
        </a>{' '}
        ·{' '}
        <a className="underline hover:text-slate-400" href="https://github.com/Capno-Labs/capno-core">
          GitHub
        </a>{' '}
        ·{' '}
        <Link className="underline hover:text-slate-400" href="/account">
          Account
        </Link>{' '}
        ·{' '}
        <Link className="underline hover:text-slate-400" href="/settings">
          Settings
        </Link>
      </footer>
    </main>
  );
}
