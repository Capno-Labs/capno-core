'use client';

import { useEffect, useRef, useState } from 'react';
import type { ActionStatus } from '@/lib/engine/types';
import { useControllerStore } from '@/lib/store/controllerStore';

// Display words are faculty-facing; the underlying ActionStatus values are
// load-bearing (engine, scoring, schema, archives) and must not change.
const STATUS_META: { status: ActionStatus; glyph: string; word: string; cls: string }[] = [
  { status: 'done', glyph: '✓', word: 'Observed', cls: 'bg-emerald-700 text-white' },
  { status: 'delayed', glyph: '◐', word: 'Delayed', cls: 'bg-amber-600 text-white' },
  { status: 'incorrect', glyph: '✗', word: 'Incorrect', cls: 'bg-red-700 text-white' },
  { status: 'missed', glyph: '—', word: 'Missed', cls: 'bg-slate-600 text-white' },
];

const STATUS_BADGE: Record<ActionStatus, string> = {
  pending: '',
  done: 'text-emerald-400',
  delayed: 'text-amber-400',
  incorrect: 'text-red-400',
  missed: 'text-slate-400',
};

/**
 * Expected learner actions, grouped by phase. Faculty tap a status as they
 * observe learner behavior; taps are reversible (tap active status to clear).
 *
 * "Critical only" trims the list to critical actions with larger, labelled
 * tap targets for live use. It switches itself on once, when the scenario
 * first starts running; after that the toggle is entirely the faculty's.
 */
export function ActionChecklist() {
  const { engine, snapshot, markAction } = useControllerStore();
  const [criticalOnly, setCriticalOnly] = useState(false);
  const autoEnabled = useRef(false);
  const running = snapshot?.status === 'running';

  useEffect(() => {
    if (running && !autoEnabled.current) {
      autoEnabled.current = true;
      setCriticalOnly(true);
    }
  }, [running]);

  if (!engine || !snapshot) return null;

  const scenario = engine.scenario;
  const recordFor = (id: string) => snapshot.actions.find((a) => a.actionId === id);
  const visible = (a: { critical: boolean }) => !criticalOnly || a.critical;
  const hiddenCount = criticalOnly
    ? scenario.expectedActions.filter((a) => !a.critical).length
    : 0;

  const groups = scenario.phases
    .map((phase) => ({
      phase,
      actions: scenario.expectedActions.filter((a) => a.phase === phase.id && visible(a)),
    }))
    .filter((g) => g.actions.length > 0);
  const ungrouped = scenario.expectedActions.filter((a) => !a.phase && visible(a));
  if (ungrouped.length > 0) {
    groups.push({ phase: { id: '_other', label: 'Any phase' }, actions: ungrouped });
  }

  const btnSize = criticalOnly ? 'h-10 min-w-10 px-1.5' : 'h-7 w-7';

  return (
    <section className="card space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
          Learner actions
        </h2>
        <button
          className={`rounded px-2 py-1 text-xs font-semibold transition ${
            criticalOnly
              ? 'bg-red-900/60 text-red-300 ring-1 ring-red-700'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
          onClick={() => setCriticalOnly(!criticalOnly)}
          aria-pressed={criticalOnly}
        >
          ● Critical only
        </button>
      </div>
      {groups.map(({ phase, actions }) => (
        <div key={phase.id}>
          <h3
            className={`mb-1 text-[11px] font-bold uppercase tracking-wider ${
              phase.id === snapshot.phaseId ? 'text-sky-400' : 'text-slate-500'
            }`}
          >
            {phase.label}
            {phase.id === snapshot.phaseId && ' · current'}
          </h3>
          <ul className="space-y-1">
            {actions.map((a) => {
              const rec = recordFor(a.id);
              const current = rec?.status ?? 'pending';
              return (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-2 rounded-md bg-slate-800/60 px-2 py-1.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-slate-200" title={a.description ?? a.label}>
                      {a.critical && (
                        <span className="mr-1 text-red-400" title="critical action">
                          ●
                        </span>
                      )}
                      {a.label}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {a.points} pts
                      {current !== 'pending' && (
                        <span className={`ml-2 font-semibold uppercase ${STATUS_BADGE[current]}`}>
                          {current}
                          {rec?.markedAtSec !== undefined &&
                            ` @ ${Math.floor(rec.markedAtSec / 60)}:${String(
                              Math.floor(rec.markedAtSec % 60),
                            ).padStart(2, '0')}`}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {STATUS_META.map((s) => (
                      <button
                        key={s.status}
                        title={s.word}
                        aria-label={`${a.label}: ${s.word}`}
                        onClick={() =>
                          markAction(a.id, current === s.status ? 'pending' : s.status)
                        }
                        className={`${btnSize} rounded text-sm font-bold transition ${
                          current === s.status
                            ? s.cls
                            : 'bg-slate-700/60 text-slate-400 hover:bg-slate-600'
                        }`}
                      >
                        <span className="flex flex-col items-center leading-none">
                          <span>{s.glyph}</span>
                          {criticalOnly && (
                            <span className="mt-0.5 text-[8px] font-semibold uppercase">
                              {s.word}
                            </span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {hiddenCount > 0 && (
        <button
          className="text-xs text-sky-400 hover:text-sky-300"
          onClick={() => setCriticalOnly(false)}
        >
          {hiddenCount} non-critical action{hiddenCount === 1 ? '' : 's'} hidden — show all
        </button>
      )}
      <p className="text-[10px] text-slate-500">
        ● = critical action · ✓ observed · ◐ delayed (half credit) · ✗ incorrect · — missed
      </p>
    </section>
  );
}
