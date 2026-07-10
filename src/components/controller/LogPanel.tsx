'use client';

import type { LogEntry } from '@/lib/engine/types';
import { useControllerStore } from '@/lib/store/controllerStore';

const KIND_COLORS: Record<LogEntry['kind'], string> = {
  session: 'text-slate-400',
  phase: 'text-sky-400',
  event: 'text-red-400',
  vital_change: 'text-amber-300',
  action: 'text-emerald-400',
  note: 'text-violet-300',
  alarm: 'text-red-300',
};

/** Live chronological event log (newest first). */
export function LogPanel() {
  const snapshot = useControllerStore((s) => s.snapshot);
  if (!snapshot) return null;

  return (
    <section className="card">
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-400">Log</h2>
      <ul className="max-h-56 space-y-0.5 overflow-y-auto font-mono text-xs">
        {[...snapshot.log].reverse().map((entry, i) => (
          <li key={`${entry.t}-${i}`} className="flex gap-2">
            <span className="shrink-0 tabular-nums text-slate-500">
              {Math.floor(entry.t / 60)}:{String(entry.t % 60).padStart(2, '0')}
            </span>
            <span className={KIND_COLORS[entry.kind]}>
              {entry.label}
              {entry.detail && <span className="text-slate-500"> — {entry.detail}</span>}
            </span>
          </li>
        ))}
        {snapshot.log.length === 0 && <li className="text-slate-500">No entries yet.</li>}
      </ul>
    </section>
  );
}
