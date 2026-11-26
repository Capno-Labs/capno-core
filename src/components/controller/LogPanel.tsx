'use client';

import type { LogEntry } from '@/lib/engine/types';
import { formatClock } from '@/lib/format';
import { useControllerStore } from '@/lib/store/controllerStore';

const KIND_COLORS: Record<LogEntry['kind'], string> = {
  session: 'text-muted',
  phase: 'text-warn-strong',
  event: 'text-red',
  vital_change: 'text-warn-strong',
  action: 'text-green',
  note: 'text-violet',
  alarm: 'text-red',
};

/**
 * Live chronological event log (newest first). Rendered inside the run
 * dock's Log | Patient card; capped in height when the page scrolls, filling
 * the card in the viewport-fit cockpit.
 */
export function LogList() {
  const snapshot = useControllerStore((s) => s.snapshot);
  if (!snapshot) return null;

  return (
    <ul className="max-h-56 space-y-0.5 overflow-y-auto font-mono text-xs fit:max-h-none fit:min-h-0 fit:flex-1 fit:overscroll-contain">
      {[...snapshot.log].reverse().map((entry, i) => (
        <li key={`${entry.t}-${i}`} className="flex gap-2">
          <span className="shrink-0 tabular-nums text-faint">{formatClock(entry.t)}</span>
          <span className={KIND_COLORS[entry.kind]}>
            {entry.label}
            {entry.detail && <span className="text-faint"> — {entry.detail}</span>}
          </span>
        </li>
      ))}
      {snapshot.log.length === 0 && <li className="text-faint">No entries yet.</li>}
    </ul>
  );
}
