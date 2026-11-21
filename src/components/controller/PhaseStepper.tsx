'use client';

import { nextPhase, phasePace } from '@/lib/engine/flow';
import { formatClock } from '@/lib/format';
import { useControllerStore } from '@/lib/store/controllerStore';

/**
 * Phase-of-care stepper for the run screen's command bar: the scenario's
 * phases in order, the current one highlighted, time spent in it (against
 * its target, when the author set one), and a button to move on.
 *
 * Phases never advance on their own — the instructor decides when the case
 * has moved on, and may step back. Each change is logged, which is what
 * gives the debrief timeline its phase markers.
 */
export function PhaseStepper() {
  const { engine, snapshot, setPhase } = useControllerStore();
  if (!engine || !snapshot) return null;
  const phases = engine.scenario.phases;
  if (phases.length < 2) return null;

  const live = snapshot.status === 'running' || snapshot.status === 'paused';
  const { elapsedInPhaseSec, pace } = phasePace(engine.scenario, snapshot);
  const next = nextPhase(phases, snapshot.phaseId);
  const currentIndex = phases.findIndex((p) => p.id === snapshot.phaseId);

  return (
    <nav
      aria-label="Phase of care"
      className="flex items-center gap-2 overflow-x-auto"
    >
      <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-[0.11em] text-muted">
        Phase
      </span>
      <ol className="flex items-center gap-1">
        {phases.map((phase, i) => {
          const current = phase.id === snapshot.phaseId;
          return (
            <li key={phase.id}>
              <button
                type="button"
                disabled={!live || current}
                aria-current={current ? 'step' : undefined}
                title={phase.description ?? phase.label}
                onClick={() => setPhase(phase.id)}
                className={`whitespace-nowrap rounded-ctl px-2 py-1 text-xs font-semibold ring-1 ${
                  current
                    ? 'bg-brand text-on-brand ring-brand'
                    : i < currentIndex
                      ? 'bg-panel-2 text-muted ring-line enabled:hover:bg-panel-3'
                      : 'bg-panel text-ink-2 ring-line enabled:hover:bg-panel-3'
                } disabled:cursor-default`}
              >
                {i + 1}. {phase.label}
              </button>
            </li>
          );
        })}
      </ol>
      {live && (
        <span
          className={`shrink-0 font-mono text-xs tabular-nums ${
            pace?.state === 'over'
              ? 'font-bold text-warn-strong'
              : pace?.state === 'low'
                ? 'text-warn-strong'
                : 'text-muted'
          }`}
          title={
            pace
              ? pace.state === 'over'
                ? `Over this phase's ${formatClock(pace.budgetSec)} target by ${formatClock(pace.overBySec)}`
                : `Time in this phase, against its ${formatClock(pace.budgetSec)} target`
              : 'Time in this phase'
          }
        >
          {formatClock(elapsedInPhaseSec)}
          {pace && ` / ${formatClock(pace.budgetSec)}`}
        </span>
      )}
      {live && next && (
        <button
          type="button"
          className="btn-secondary btn-sm shrink-0"
          onClick={() => setPhase(next.id)}
          title={`Move the case on to “${next.label}”`}
        >
          Next phase →
        </button>
      )}
    </nav>
  );
}
