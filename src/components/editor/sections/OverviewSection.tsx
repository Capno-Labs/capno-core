'use client';

import type { Scenario, TrainingLevel } from '@/lib/engine/types';
import { TRAINING_LEVEL_LABELS } from '@/lib/engine/types';
import { Field } from '@/components/ui/Field';
import { NumberField } from '@/components/ui/NumberField';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import type { SelectOption } from '@/components/ui/SelectField';
import { ListEditor } from '../ListEditor';

const DIFFICULTY_OPTIONS: SelectOption<Scenario['tags']['difficulty']>[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

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
      <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Overview</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field className="col-span-2" label="Title">
          <input className="input" value={scenario.title} onChange={(e) => update({ title: e.target.value })} />
        </Field>
        <Field label="ID" hint="Lowercase letters, numbers and dashes.">
          <input className="input font-mono" value={scenario.id} onChange={(e) => update({ id: e.target.value })} />
        </Field>
        <Field label="Version">
          <input className="input font-mono" value={scenario.version} onChange={(e) => update({ version: e.target.value })} />
        </Field>
      </div>
      <Field label="Summary" hint="One or two sentences. Faculty see it in the library; learners never do.">
        <textarea className="input" rows={2} value={scenario.summary} onChange={(e) => update({ summary: e.target.value })} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-[auto_1fr_1fr] sm:items-start">
        <SegmentedControl
          label="Difficulty"
          value={scenario.tags.difficulty}
          options={DIFFICULTY_OPTIONS}
          onChange={(difficulty) => update({ tags: { ...scenario.tags, difficulty } })}
        />
        <NumberField
          label="Expected length"
          unit="min"
          value={scenario.estimatedMinutes}
          min={1}
          max={600}
          required
          onChange={(n) => n !== undefined && update({ estimatedMinutes: n })}
        />
        <NumberField
          label="Lab slot"
          unit="min"
          value={scenario.targetDurationSec !== undefined ? scenario.targetDurationSec / 60 : undefined}
          min={0.5}
          max={600}
          step={5}
          placeholder="Optional"
          hint="A hard time budget: the run screen counts down against it. Blank uses the expected length."
          onChange={(n) =>
            update({ targetDurationSec: n === undefined ? undefined : Math.max(1, Math.round(n * 60)) })
          }
        />
      </div>
      <fieldset>
        <legend className="label">Training levels</legend>
        <div className="grid gap-1 sm:grid-cols-4">
          {(Object.keys(TRAINING_LEVEL_LABELS) as TrainingLevel[]).map((level) => (
            <label
              key={level}
              className="flex cursor-pointer items-center gap-2 rounded-ctl bg-panel-2 px-2 py-1 text-sm text-ink-2"
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
        <p className="mt-1 text-xs text-faint">
          Who this case is written for — shown in the case library. Pick at least one.
        </p>
      </fieldset>
      <ListEditor
        label="Topics"
        items={scenario.tags.topics}
        onChange={(topics) => update({ tags: { ...scenario.tags, topics } })}
        placeholder="e.g. airway, hemodynamics…"
        ordered={false}
      />
    </section>
  );
}
