'use client';

import Link from 'next/link';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <div className="font-mono text-4xl text-red-400">⚠</div>
      <div className="card w-full">
        <h1 className="text-xl font-bold">Something went wrong</h1>
        <p className="mt-2 break-words text-sm text-slate-400">
          {error.message || 'An unexpected error occurred.'}
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <button type="button" className="btn-primary" onClick={() => reset()}>
            Try again
          </button>
          <Link href="/" className="btn-ghost">
            Home
          </Link>
        </div>
      </div>
      <p className="text-xs text-slate-500">
        A running session on another tab or device is not affected by this error.
      </p>
    </main>
  );
}
