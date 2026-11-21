import Link from 'next/link';
import { LogoTile } from '@/components/brand/LogoTile';
import { NAV } from '@/components/shell/nav';
import { DISPLAY_COPY } from '@/lib/displayCopy';

export default function NotFound() {
  return (
    <main className="surface-blue flex min-h-screen items-center px-6 py-12">
      <div className="relative mx-auto w-full max-w-2xl">
        <LogoTile size="lg" />
        <p className="mt-8 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-poster-muted">
          Error 404
        </p>
        <h1 className="display mt-3 text-[clamp(3rem,13vw,7rem)]">
          {DISPLAY_COPY.notFound.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </h1>
        <p className="mt-4 max-w-md text-poster-muted">
          The page you are looking for does not exist or has moved.
        </p>
        <div className="mt-7 flex flex-wrap gap-2.5">
          <Link href={NAV.home.href} className="btn-on-blue">
            {NAV.home.label} <span className="link-arrow">→</span>
          </Link>
          <Link href={NAV.library.href} className="btn-ghost-on-blue">
            {NAV.library.label}
          </Link>
          <Link href={NAV.student.href} className="btn-ghost-on-blue">
            {NAV.student.label}
          </Link>
        </div>
      </div>
    </main>
  );
}
