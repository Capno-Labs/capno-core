'use client';

import { EventFields } from '@/components/editor/EventFields';
import { Field } from '@/components/ui/Field';
import { NumberField } from '@/components/ui/NumberField';
import { SelectField } from '@/components/ui/SelectField';
import { TimeField } from '@/components/ui/TimeField';
import type { ExpectedAction, Phase, RubricCategory, ScenarioEvent } from '@/lib/engine/types';
import type { ItemListKey } from './fieldRegistry';

/**
 * The forms the import review edits one item with — the same fields, labels
 * and inputs as the case editor's Progression and Scoring pages, so nobody
 * has to read or write JSON to correct what the parser found.
 */

export interface ItemContext {
  phases: Phase[];
  actions: ExpectedAction[];
}

export type ItemValue = Phase | ScenarioEvent | ExpectedAction | RubricCategory;

/** What "+ Add" starts from. Nothing clinical is pre-filled. */
export const BLANK_ITEM: { [K in ItemListKey]: () => ItemValue } = {
  phases: () => ({ id: '', label: '' }),
  events: () => ({ id: '', label: '', category: 'other', effects: [] }),
  expectedActions: () => ({ id: '', label: '', critical: false, points: 0 }),
  rubric: () => ({ id: '', label: '', actionIds: [] }),
};

/** Fallback id stem when a label has no usable characters. */
export const ID_STEM: Record<ItemListKey, string> = {
  phases: 'phase',
  events: 'event',
  expectedActions: 'action',
  rubric: 'category',
};

/** Merge a patch, dropping keys set to undefined (optional keys are absent, never undefined). */
function merge<T extends object>(value: T, patch: Partial<T>): T {
  const next = { ...value, ...patch };
  for (const key of Object.keys(patch) as (keyof T)[]) {
    if (patch[key] === undefined) delete next[key];
  }
  return next;
}

function PhaseForm({ value, onChange }: { value: Phase; onChange: (next: Phase) => void }) {
  return (
    <>
      <Field label="Phase name">
        <input
          className="input"
          value={value.label}
          placeholder="For example: Induction"
          onChange={(e) => onChange({ ...value, label: e.target.value })}
        />
      </Field>
      <Field label="What is going on" hint="Optional. A line for faculty on the run screen.">
        <textarea
          className="input"
          rows={2}
          value={value.description ?? ''}
          onChange={(e) => onChange(merge(value, { description: e.target.value === '' ? undefined : e.target.value }))}
        />
      </Field>
      <TimeField
        className="w-40"
        label="Should take"
        valueSec={value.targetDurationSec}
        hint="Optional. Pacing only."
        onChange={(targetDurationSec) => onChange(merge(value, { targetDurationSec }))}
      />
    </>
  );
}

function ActionForm({
  value,
  phases,
  onChange,
}: {
  value: ExpectedAction;
  phases: Phase[];
  onChange: (next: ExpectedAction) => void;
}) {
  return (
    <>
      <Field label="What learners should do">
        <input className="input" value={value.label} onChange={(e) => onChange({ ...value, label: e.target.value })} />
      </Field>
      <Field label="Note" hint="Optional. What counts as doing this, for whoever is marking.">
        <textarea
          className="input"
          rows={2}
          value={value.description ?? ''}
          onChange={(e) => onChange(merge(value, { description: e.target.value === '' ? undefined : e.target.value }))}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label="Phase"
          value={phases.some((p) => p.id === value.phase) ? value.phase : undefined}
          options={phases.map((p) => ({ value: p.id, label: p.label || 'Untitled phase' }))}
          emptyLabel="Any phase"
          onChange={(phase) => onChange(merge(value, { phase }))}
        />
        <NumberField
          label="Points"
          value={value.points}
          min={0}
          max={1000}
          integer
          required
          hint="Only matters if you report scores."
          onChange={(points) => points !== undefined && onChange({ ...value, points })}
        />
      </div>
      <button
        type="button"
        className="chip aria-pressed:!bg-red-soft aria-pressed:!text-red aria-pressed:ring-1 aria-pressed:ring-red/40"
        aria-pressed={value.critical}
        title="Critical actions are flagged on the run screen and in the debrief"
        onClick={() => onChange({ ...value, critical: !value.critical })}
      >
        Critical
      </button>
    </>
  );
}

function RubricForm({
  value,
  actions,
  onChange,
}: {
  value: RubricCategory;
  actions: ExpectedAction[];
  onChange: (next: RubricCategory) => void;
}) {
  const known = new Set(actions.map((a) => a.id));
  const stale = value.actionIds.filter((id) => !known.has(id));
  const toggle = (id: string) =>
    onChange({
      ...value,
      actionIds: value.actionIds.includes(id) ? value.actionIds.filter((x) => x !== id) : [...value.actionIds, id],
    });
  return (
    <>
      <Field label="Category name">
        <input className="input" value={value.label} onChange={(e) => onChange({ ...value, label: e.target.value })} />
      </Field>
      <fieldset className="min-w-0">
        <legend className="label">Actions in this category</legend>
        {actions.length === 0 ? (
          <p className="text-xs text-faint">Add expected actions first, then pick them here.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {actions.map((a) => (
              <button
                key={a.id}
                type="button"
                className="chip max-w-full truncate text-left"
                aria-pressed={value.actionIds.includes(a.id)}
                title={a.label}
                onClick={() => toggle(a.id)}
              >
                {a.label || 'Untitled action'}
              </button>
            ))}
          </div>
        )}
        {stale.length > 0 && (
          <p className="mt-1 text-xs text-red">
            {stale.length} linked action{stale.length === 1 ? ' is' : 's are'} no longer in the list.{' '}
            <button
              type="button"
              className="underline"
              onClick={() => onChange({ ...value, actionIds: value.actionIds.filter((id) => known.has(id)) })}
            >
              Unlink
            </button>
          </p>
        )}
      </fieldset>
    </>
  );
}

export function ItemForm({
  listKey,
  value,
  context,
  onChange,
}: {
  listKey: ItemListKey;
  value: ItemValue;
  context: ItemContext;
  onChange: (next: ItemValue) => void;
}) {
  switch (listKey) {
    case 'phases':
      return <PhaseForm value={value as Phase} onChange={onChange} />;
    case 'expectedActions':
      return <ActionForm value={value as ExpectedAction} phases={context.phases} onChange={onChange} />;
    case 'rubric':
      return <RubricForm value={value as RubricCategory} actions={context.actions} onChange={onChange} />;
    case 'events': {
      const event = value as ScenarioEvent;
      return (
        <EventFields
          event={event}
          phases={context.phases}
          actions={context.actions}
          onChange={(patch) => onChange(merge(event, patch))}
          onLabel={(label) => onChange({ ...event, label })}
          onSetAuto={(auto) => onChange(merge(event, { autoAtSec: auto ? (event.autoAtSec ?? 0) : undefined }))}
        />
      );
    }
  }
}
