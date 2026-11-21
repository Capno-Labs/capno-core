'use client';

import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { DISPLAY_COPY } from '@/lib/displayCopy';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="surface-ink flex min-h-screen items-center px-6 py-12">
      <div className="relative mx-auto w-full max-w-2xl">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-red-solid text-white">
          <Icon name="alert" size={22} />
        </span>
        <h1 className="display mt-6 text-[clamp(2.5rem,10vw,5.5rem)]">
          {DISPLAY_COPY.error.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </h1>
        {/* The message is runtime text — never the display face. */}
        <p className="mt-4 max-w-xl break-words text-poster-muted">
          {error.message || 'An unexpected error occurred.'}
        </p>
        <div className="mt-7 flex flex-wrap gap-2.5">
          <button type="button" className="btn-on-blue" onClick={() => reset()}>
            Try again
          </button>
          <Link href="/" className="btn-ghost-on-blue">
            Home
          </Link>
        </div>
        <p className="mt-8 text-xs text-poster-muted">
          A running session on another tab or device is not affected by this error.
        </p>
      </div>
    </main>
  );
}
