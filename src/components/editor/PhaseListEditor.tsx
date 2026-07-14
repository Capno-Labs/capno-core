'use client';

import type { Phase } from '@/lib/engine/types';

/**
 * Form editor for scenario phases. Controlled: emits the full phases array
 * via onChange; ScenarioEditor's update() regenerates the JSON pane.
 */
export function PhaseListEditor({
  phases,
  onChange,
}: {
  phases: Phase[];
  onChange: (phases: Phase[]) => void;
}) {
  const patch = (i: number, p: Partial<Phase>) =>
    onChange(phases.map((ph, j) => (j === i ? { ...ph, ...p } : ph)));

  const swap = (i: number, j: number) => {
    if (j < 0 || j >= phases.length) return;
    const next = [...phases];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {phases.map((phase, i) => (
        <div key={i} className="space-y-2 rounded bg-slate-800/60 p-2">
          <div className="flex items-start gap-2">
            <div className="grid flex-1 grid-cols-2 gap-2">
              <div>
                <span className="label">Phase id (kebab-case)</span>
                <input
                  className="input font-mono"
                  value={phase.id}
                  onChange={(e) => patch(i, { id: e.target.value })}
                />
              </div>
              <div>
                <span className="label">Label</span>
                <input
                  className="input"
                  value={phase.label}
                  onChange={(e) => patch(i, { label: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-5 flex shrink-0 gap-1">
              <button
                className="btn-ghost !px-2 !py-1"
                onClick={() => swap(i, i - 1)}
                disabled={i === 0}
                aria-label={`move phase ${phase.label || i + 1} up`}
              >
                ↑
              </button>
              <button
                className="btn-ghost !px-2 !py-1"
                onClick={() => swap(i, i + 1)}
                disabled={i === phases.length - 1}
                aria-label={`move phase ${phase.label || i + 1} down`}
              >
                ↓
              </button>
              <button
                className="btn-ghost !px-2 !py-1 text-red-400"
                onClick={() => onChange(phases.filter((_, j) => j !== i))}
                disabled={phases.length <= 1}
                title={phases.length <= 1 ? 'A scenario needs at least one phase' : 'Remove phase'}
                aria-label={`remove phase ${phase.label || i + 1}`}
              >
                ✕
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <span className="label">Description (optional)</span>
              <input
                className="input"
                value={phase.description ?? ''}
                onChange={(e) =>
                  patch(i, { description: e.target.value === '' ? undefined : e.target.value })
                }
              />
            </div>
            <div className="w-28 shrink-0">
              <span
                className="label"
                title="Pacing budget for this phase — the run screen's phase stepper turns amber once the team is over it."
              >
                Target (min)
              </span>
              <input
                className="input"
                type="number"
                min={0}
                step="any"
                placeholder="optional"
                value={phase.targetDurationSec !== undefined ? phase.targetDurationSec / 60 : ''}
                onChange={(e) => {
                  // Fractional minutes are fine (0.5 = a 30 s budget); anything
                  // non-positive means "no budget", never a silent clamp.
                  const n = Number(e.target.value);
                  patch(i, {
                    targetDurationSec:
                      e.target.value === '' || !(n > 0)
                        ? undefined
                        : Math.max(1, Math.round(n * 60)),
                  });
                }}
              />
            </div>
          </div>
        </div>
      ))}
      <button
        className="btn-secondary"
        onClick={() => onChange([...phases, { id: '', label: '' }])}
      >
        + Add phase
      </button>
      <p className="text-xs text-slate-500">
        Actions and events reference phases by id — renaming an id here flags any stale references
        in the validation panel.
      </p>
    </div>
  );
}
