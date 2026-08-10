'use client';

import type { Scenario, TrainingLevel } from '@/lib/engine/types';
import { TRAINING_LEVEL_LABELS } from '@/lib/engine/types';
import { ListEditor } from '../ListEditor';

export function OverviewSection({
  scenario,
  update,
}: {
  scenario: Scenario;
  update: (patch: Partial<Scenario>) => void;
}) {
  const toggleLevel = (level: TrainingLevel) => {
    const cur = scenario.tags.trainingLevels;
    const trainingLevels = cur.includes(level)
      ? cur.filter((l) => l !== level)
      : [...cur, level];
    update({ tags: { ...scenario.tags, trainingLevels } });
  };

  return (
    <section className="card space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Overview</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="col-span-2">
          <span className="label">Title</span>
          <input className="input" value={scenario.title} onChange={(e) => update({ title: e.target.value })} />
        </div>
        <div>
          <span className="label">ID (kebab-case)</span>
          <input className="input font-mono" value={scenario.id} onChange={(e) => update({ id: e.target.value })} />
        </div>
        <div>
          <span className="label">Version</span>
          <input className="input font-mono" value={scenario.version} onChange={(e) => update({ version: e.target.value })} />
        </div>
      </div>
      <div>
        <span className="label">Summary</span>
        <textarea className="input" rows={2} value={scenario.summary} onChange={(e) => update({ summary: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <span className="label">Difficulty</span>
          <select
            className="input"
            value={scenario.tags.difficulty}
            onChange={(e) =>
              update({ tags: { ...scenario.tags, difficulty: e.target.value as Scenario['tags']['difficulty'] } })
            }
          >
            <option value="beginner">beginner</option>
            <option value="intermediate">intermediate</option>
            <option value="advanced">advanced</option>
          </select>
        </div>
        <div>
          <span className="label">Est. minutes</span>
          <input
            className="input"
            type="number"
            min={1}
            value={scenario.estimatedMinutes}
            onChange={(e) => update({ estimatedMinutes: Number(e.target.value) || 1 })}
          />
        </div>
        <div>
          <span className="label" title="Hard time budget for a scheduled lab slot — the run screen counts down against it. Blank = use est. minutes.">
            Slot budget (min)
          </span>
          <input
            className="input"
            type="number"
            min={0}
            step="any"
            placeholder="optional"
            value={scenario.targetDurationSec !== undefined ? scenario.targetDurationSec / 60 : ''}
            onChange={(e) => {
              // Fractional minutes are fine; non-positive means "no
              // budget", never a silent clamp (see PhaseListEditor).
              const n = Number(e.target.value);
              update({
                targetDurationSec:
                  e.target.value === '' || !(n > 0)
                    ? undefined
                    : Math.max(1, Math.round(n * 60)),
              });
            }}
          />
        </div>
      </div>
      <div>
        <span className="label">Training levels</span>
        <div className="grid gap-1 sm:grid-cols-4">
          {(Object.keys(TRAINING_LEVEL_LABELS) as TrainingLevel[]).map((level) => (
            <label
              key={level}
              className="flex cursor-pointer items-center gap-2 rounded bg-slate-800/60 px-2 py-1 text-sm text-slate-300"
            >
              <input
                type="checkbox"
                checked={scenario.tags.trainingLevels.includes(level)}
                onChange={() => toggleLevel(level)}
              />
              {TRAINING_LEVEL_LABELS[level]}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Who this case is written for — shown in the case library. Pick at least one.
        </p>
      </div>
      <ListEditor
        label="Topics"
        items={scenario.tags.topics}
        onChange={(topics) => update({ tags: { ...scenario.tags, topics } })}
        placeholder="e.g. airway, hemodynamics…"
      />
    </section>
  );
}
