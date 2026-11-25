'use client';

import type { ReactNode } from 'react';
import { Icon } from './Icon';

/**
 * A "more" section that starts closed: the fields most cases never need stay
 * out of the way but one click from view. On <details>, so it works without
 * script and is searchable with the browser's find. `summary` says what is
 * inside — or what is already set — so nobody has to open it to check.
 */
export function Disclosure({
  title,
  summary,
  defaultOpen = false,
  className = '',
  children,
}: {
  title: ReactNode;
  /** Shown beside the title, e.g. "2 set" or "Art line, 5 min cuff". */
  summary?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <details
      open={defaultOpen || undefined}
      className={`group rounded-ctl ring-1 ring-line [&>summary::-webkit-details-marker]:hidden ${className}`}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-ctl px-3 py-2 text-sm font-semibold text-ink-2 transition duration-150 ease-brand hover:bg-panel-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
        <Icon name="chevron-down" size={14} className="-rotate-90 text-faint transition group-open:rotate-0" />
        <span>{title}</span>
        {summary && <span className="ml-auto min-w-0 truncate text-xs font-normal text-faint">{summary}</span>}
      </summary>
      <div className="space-y-3 border-t border-line px-3 py-3">{children}</div>
    </details>
  );
}
