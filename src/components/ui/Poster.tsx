import type { ReactNode } from 'react';
import { isDisplaySafe } from '@/lib/displayType';

/**
 * The landing page's poster, sized for an app screen: a blue (or ink) field
 * with grain, a mono label over a hairline, an all-caps display headline
 * with one line per array entry, a one-line promise, and actions. Entry
 * screens only — never inside the live controller.
 *
 * `titleLines` must be static authored copy (see src/lib/displayType.ts);
 * a line outside the display font's subset falls back to bold sans.
 */
export function Poster({
  tone = 'blue',
  label,
  titleLines,
  promise,
  actions,
  aside,
  footer,
  compact = false,
  as: Heading = 'h1',
  className = '',
  children,
}: {
  tone?: 'blue' | 'ink';
  label?: string;
  titleLines: string[];
  promise?: ReactNode;
  actions?: ReactNode;
  /** Right-hand column on wide screens (stacks below on narrow ones). */
  aside?: ReactNode;
  /** Full-width strip under a hairline at the bottom of the poster. */
  footer?: ReactNode;
  compact?: boolean;
  as?: 'h1' | 'h2';
  className?: string;
  /** Extra content under the promise (a short list, a note). */
  children?: ReactNode;
}) {
  const safe = titleLines.every(isDisplaySafe);
  const muted = tone === 'blue' ? 'text-poster-muted' : 'text-muted';
  return (
    <section
      className={`${tone === 'blue' ? 'surface-blue' : 'surface-ink'} rounded-card ${
        compact ? 'p-5 md:p-6' : 'p-6 md:p-9'
      } ${className}`}
    >
      <div
        className={`relative ${aside ? 'grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_auto]' : ''}`}
      >
        <div className="min-w-0">
          {label && (
            <div
              className={`mb-4 flex items-center gap-3 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] ${muted}`}
            >
              <span aria-hidden className="h-px w-10 bg-current opacity-60" />
              {label}
            </div>
          )}
          <Heading
            className={
              safe
                ? `display ${compact ? 'text-3xl md:text-4xl' : 'text-[clamp(2.5rem,7vw,5rem)]'}`
                : `font-bold tracking-tight ${compact ? 'text-2xl' : 'text-4xl'}`
            }
          >
            {titleLines.map((line, i) => (
              <span
                key={line}
                className="block motion-safe:animate-poster-rise"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                {line}
              </span>
            ))}
          </Heading>
          {promise && (
            <p className={`mt-4 max-w-xl ${compact ? 'text-sm' : 'text-base md:text-lg'} ${muted}`}>
              {promise}
            </p>
          )}
          {children && <div className="mt-5">{children}</div>}
          {actions && <div className="mt-6 flex flex-wrap items-center gap-2.5">{actions}</div>}
        </div>
        {aside && <div className="min-w-0">{aside}</div>}
      </div>
      {footer && (
        <div
          className={`relative mt-7 border-t pt-4 ${
            tone === 'blue' ? 'border-poster-line/50' : 'border-white/15'
          }`}
        >
          {footer}
        </div>
      )}
    </section>
  );
}
