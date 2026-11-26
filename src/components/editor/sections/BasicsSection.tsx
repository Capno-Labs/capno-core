'use client';

import { Field } from '@/components/ui/Field';
import { NumberField } from '@/components/ui/NumberField';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import type { SelectOption } from '@/components/ui/SelectField';
import { DOMAINS, domainOf, type Domain } from '@/lib/engine/lint';
import type { Scenario, TrainingLevel } from '@/lib/engine/types';
import { TRAINING_LEVEL_LABELS } from '@/lib/engine/types';
import { ListEditor } from '../ListEditor';
import { SectionCard, SectionHead } from './SectionHead';

const DIFFICULTY_OPTIONS: SelectOption<Scenario['tags']['difficulty']>[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

const DOMAIN_LABELS: Record<Domain, string> = {
  airway: 'Airway',
  respiratory: 'Respiratory',
  cardiac: 'Cardiac',
  hemodynamics: 'Hemodynamics',
  hemorrhage: 'Hemorrhage',
  embolic: 'Embolic',
  hypersensitivity: 'Hypersensitivity',
  toxicity: 'Toxicity',
  'temperature/metabolic': 'Temperature / metabolic',
  neuro: 'Neuro',
  equipment: 'Equipment',
};

/** What the case is for: its name, who it is written for, what learners
 *  should take away, and what the room needs. */
export function BasicsSection({
  scenario,
  update,
}: {
  scenario: Scenario;
  update: (patch: Partial<Scenario>) => void;
}) {
  const { tags } = scenario;
  const domain = domainOf(scenario);
  // Everything but the area chosen below (a second domain word stays a topic).
  const otherTopics = tags.topics.filter((t) => t !== domain);

  const toggleLevel = (level: TrainingLevel) => {
    const cur = tags.trainingLevels;
    const trainingLevels = cur.includes(level) ? cur.filter((l) => l !== level) : [...cur, level];
    update({ tags: { ...tags, trainingLevels } });
  };

  // The curriculum area is the first topic that names a domain (see
  // `domainOf`): choosing one replaces any other domain topic and leads the list.
  const setDomain = (next: Domain) =>
    update({
      tags: {
        ...tags,
        topics: next === domain ? otherTopics : [next, ...otherTopics.filter((t) => t !== next)],
      },
    });

  return (
    <div className="space-y-4">
      <SectionHead title="Basics">
        What this case is, who it is for and what learners should take away. Learners never see
        this page.
      </SectionHead>

      <SectionCard title="About the case">
        <Field label="Title">
          <input className="input" value={scenario.title} onChange={(e) => update({ title: e.target.value })} />
        </Field>
        <Field label="Summary" hint="One or two sentences. Shown to faculty in the library.">
          <textarea className="input" rows={2} value={scenario.summary} onChange={(e) => update({ summary: e.target.value })} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-[auto_1fr_1fr] sm:items-start">
          <SegmentedControl
            label="Difficulty"
            value={tags.difficulty}
            options={DIFFICULTY_OPTIONS}
            onChange={(difficulty) => update({ tags: { ...tags, difficulty } })}
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
      </SectionCard>

      <SectionCard title="Who it is for">
        <fieldset>
          <legend className="label">Training levels</legend>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(TRAINING_LEVEL_LABELS) as TrainingLevel[]).map((level) => (
              <button
                key={level}
                type="button"
                className="chip"
                aria-pressed={tags.trainingLevels.includes(level)}
                onClick={() => toggleLevel(level)}
              >
                {TRAINING_LEVEL_LABELS[level]}
              </button>
            ))}
          </div>
          <p className={`mt-1 text-xs ${tags.trainingLevels.length === 0 ? 'font-medium text-red' : 'text-faint'}`}>
            Pick at least one. The library filters on this.
          </p>
        </fieldset>
        <fieldset>
          <legend className="label">Curriculum area</legend>
          <div className="flex flex-wrap gap-1.5">
            {DOMAINS.map((d) => (
              <button
                key={d}
                type="button"
                className="chip"
                aria-pressed={d === domain}
                onClick={() => setDomain(d)}
              >
                {DOMAIN_LABELS[d]}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-faint">One area. The library groups cases by it.</p>
        </fieldset>
        <ListEditor
          label="Other topics"
          items={otherTopics}
          onChange={(topics) => update({ tags: { ...tags, topics: domain ? [domain, ...topics] : topics } })}
          placeholder="e.g. laparoscopy, pediatrics…"
          hint="Optional search words."
          ordered={false}
        />
      </SectionCard>

      <SectionCard title="Learning objectives" hint="What a learner should be able to do after this case.">
        <ListEditor
          label="Objectives"
          items={scenario.learningObjectives}
          onChange={(learningObjectives) => update({ learningObjectives })}
          placeholder="Add an objective…"
        />
      </SectionCard>

      <SectionCard title="Room setup" hint="What faculty prepare before learners walk in.">
        <ListEditor
          label="Setup steps"
          items={scenario.setup}
          onChange={(setup) => update({ setup })}
          placeholder="Add a setup step…"
        />
      </SectionCard>
    </div>
  );
}
