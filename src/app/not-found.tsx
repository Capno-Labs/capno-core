import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <div className="font-mono text-5xl text-vital-ecg">404</div>
      <div className="card w-full">
        <h1 className="text-xl font-bold">Page not found</h1>
        <p className="mt-2 text-sm text-slate-400">
          The page you are looking for does not exist or has moved.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn-primary">
            Home
          </Link>
          <Link href="/scenarios" className="btn-ghost">
            Scenario library
          </Link>
          <Link href="/student" className="btn-ghost">
            Student display
          </Link>
        </div>
      </div>
    </main>
  );
}
