'use client';

import { formatClock } from '@/lib/format';
import { useControllerStore } from '@/lib/store/controllerStore';

/**
 * Phase-of-care stepper (preinduction → induction → … ). The current phase
 * shows time-in-phase; a phase with an authored targetDurationSec shows the
 * budget too and turns amber once over it — pinpointing where a struggling
 * team is losing the schedule.
 */
export function PhasePanel() {
  const { engine, snapshot, setPhase } = useControllerStore();
  if (!engine || !snapshot) return null;

  const inPhaseSec = snapshot.elapsedSec - (snapshot.phaseChangedAtSec ?? 0);

  return (
    <section className="card">
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-400">Phase</h2>
      <div className="flex flex-wrap gap-1.5">
        {engine.scenario.phases.map((p, i) => {
          const current = snapshot.phaseId === p.id;
          const over = current && p.targetDurationSec !== undefined && inPhaseSec > p.targetDurationSec;
          return (
            <button
              key={p.id}
              onClick={() => setPhase(p.id)}
              title={p.description}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                current
                  ? over
                    ? 'bg-amber-600 text-white'
                    : 'bg-sky-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {i + 1}. {p.label}
              {current && (
                <span className={`ml-1.5 font-mono font-normal ${over ? 'text-amber-100' : 'text-sky-200'}`}>
                  {formatClock(inPhaseSec)}
                  {p.targetDurationSec !== undefined && ` / ${formatClock(p.targetDurationSec)}`}
                </span>
              )}
              {!current && p.targetDurationSec !== undefined && (
                <span className="ml-1.5 font-mono font-normal text-slate-600">
                  {formatClock(p.targetDurationSec)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
