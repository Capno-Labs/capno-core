import type { ReactNode } from 'react';

/** Amber eyebrow label — the shared kicker above page and section titles. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.11em] text-amber-strong">
      <span aria-hidden className="h-0.5 w-4 bg-amber" />
      {children}
    </div>
  );
}

/**
 * Standard page header: amber eyebrow, tight display title, muted lede, and
 * an optional action slot on the right. Replaces the per-page back-link
 * headers — navigation lives in the shell.
 */
export function PageHead({
  eyebrow,
  title,
  lede,
  actions,
}: {
  eyebrow?: string;
  title: ReactNode;
  lede?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-2.5">
            <Eyebrow>{eyebrow}</Eyebrow>
          </div>
        )}
        <h1 className="text-3xl font-bold tracking-[-0.03em] md:text-4xl">{title}</h1>
        {lede && <p className="mt-2 max-w-2xl text-sm text-muted">{lede}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
