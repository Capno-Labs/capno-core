/**
 * Loading placeholders. Pages render these while client state hydrates
 * instead of a blank screen (`return null`), so layout doesn't jump and the
 * app never looks broken on a slow device.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`block rounded-ctl bg-panel-2 motion-safe:animate-pulse ${className}`}
    />
  );
}

export type PageSkeletonKind = 'list' | 'form' | 'report' | 'cockpit';

/** Whole-page placeholder shaped like the screen that is about to appear. */
export function PageSkeleton({ kind = 'list' }: { kind?: PageSkeletonKind }) {
  return (
    <div role="status" aria-live="polite" className="space-y-5">
      <span className="sr-only">Loading…</span>
      {kind !== 'cockpit' && (
        <div className="space-y-3">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-10 w-72 max-w-full" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
      )}
      {kind === 'list' &&
        [0, 1, 2].map((i) => <Skeleton key={i} className="h-28 w-full !rounded-card" />)}
      {kind === 'form' && (
        <div className="card max-w-xl space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
          <Skeleton className="h-9 w-32 !rounded-full" />
        </div>
      )}
      {kind === 'report' && (
        <>
          <Skeleton className="h-40 w-full !rounded-card" />
          <Skeleton className="h-64 w-full !rounded-card" />
        </>
      )}
      {kind === 'cockpit' && (
        <>
          <Skeleton className="h-20 w-full !rounded-card" />
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-96 w-full !rounded-card" />
            <Skeleton className="h-96 w-full !rounded-card" />
          </div>
        </>
      )}
    </div>
  );
}
