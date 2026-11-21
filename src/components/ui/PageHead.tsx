import type { ReactNode } from 'react';
import { isDisplaySafe } from '@/lib/displayType';

/** Mono eyebrow label over a hairline — the shared kicker above page and
 *  section titles (the landing page's chapter tag). */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-strong">
      <span aria-hidden className="h-px w-8 bg-brand-strong" />
      {children}
    </div>
  );
}

/**
 * Standard page header: brand eyebrow, title, muted lede, and an optional
 * action slot on the right. Navigation lives in the shell.
 *
 * A static string title inside the display font's subset renders in the
 * all-caps display face; anything else (JSX, user data, unsupported glyphs)
 * falls back to bold sans — see src/lib/displayType.ts.
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
  const display = typeof title === 'string' && isDisplaySafe(title);
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-3">
            <Eyebrow>{eyebrow}</Eyebrow>
          </div>
        )}
        <h1
          className={
            display
              ? 'display text-[clamp(2rem,5vw,3.5rem)]'
              : 'text-3xl font-bold tracking-[-0.03em] md:text-4xl'
          }
        >
          {title}
        </h1>
        {lede && <p className="mt-3 max-w-2xl text-sm text-muted">{lede}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
