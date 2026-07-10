'use client';

import type { ExpectedAction, Phase, RubricCategory } from '@/lib/engine/types';

/**
 * Form editor for expected learner actions. Controlled: emits the full
 * expectedActions array; validation stays with the scenario-level zod check.
 */
export function ActionListEditor({
  actions,
  phases,
  rubric,
  onChange,
}: {
  actions: ExpectedAction[];
  phases: Phase[];
  rubric: RubricCategory[];
  onChange: (actions: ExpectedAction[]) => void;
}) {
  const patch = (i: number, p: Partial<ExpectedAction>) =>
    onChange(actions.map((a, j) => (j === i ? { ...a, ...p } : a)));

  const referencedBy = (actionId: string) =>
    rubric.filter((c) => c.actionIds.includes(actionId)).map((c) => c.label || c.id);

  return (
    <div className="space-y-2">
      {actions.map((action, i) => {
        const refs = referencedBy(action.id);
        return (
          <div key={i} className="space-y-2 rounded bg-slate-800/60 p-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="label">Action id (kebab-case)</span>
                <input
                  className="input font-mono"
                  value={action.id}
                  onChange={(e) => patch(i, { id: e.target.value })}
                />
              </div>
              <div>
                <span className="label">Label</span>
                <input
                  className="input"
                  value={action.label}
                  onChange={(e) => patch(i, { label: e.target.value })}
                />
              </div>
            </div>
            <div>
              <span className="label">Description (optional)</span>
              <textarea
                className="input"
                rows={2}
                value={action.description ?? ''}
                onChange={(e) =>
                  patch(i, { description: e.target.value === '' ? undefined : e.target.value })
                }
              />
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <span className="label">Expected phase</span>
                <select
                  className="input w-auto"
                  value={action.phase ?? ''}
                  onChange={(e) =>
                    patch(i, { phase: e.target.value === '' ? undefined : e.target.value })
                  }
                >
                  <option value="">— any —</option>
                  {phases.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label || p.id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className="label">Points</span>
                <input
                  className="input w-24"
                  type="number"
                  min={0}
                  step={1}
                  value={action.points}
                  onChange={(e) =>
                    patch(i, { points: Math.max(0, Math.floor(Number(e.target.value) || 0)) })
                  }
                />
              </div>
              <label className="flex items-center gap-2 pb-2 text-sm">
                <input
                  type="checkbox"
                  checked={action.critical}
                  onChange={(e) => patch(i, { critical: e.target.checked })}
                />
                Critical action
              </label>
              <button
                className="btn-ghost ml-auto !px-2 !py-1 text-red-400"
                onClick={() => {
                  if (
                    refs.length > 0 &&
                    !window.confirm(
                      `"${action.label || action.id}" is referenced by rubric ${
                        refs.length === 1 ? 'category' : 'categories'
                      } ${refs.join(', ')}. Remove anyway? (Fix the rubric afterwards.)`,
                    )
                  ) {
                    return;
                  }
                  onChange(actions.filter((_, j) => j !== i));
                }}
                aria-label={`remove action ${action.label || i + 1}`}
              >
                ✕ Remove
              </button>
            </div>
            {refs.length > 0 && (
              <p className="text-xs text-slate-500">In rubric: {refs.join(', ')}</p>
            )}
          </div>
        );
      })}
      <button
        className="btn-secondary"
        onClick={() => onChange([...actions, { id: '', label: '', critical: false, points: 0 }])}
      >
        + Add expected action
      </button>
    </div>
  );
}
