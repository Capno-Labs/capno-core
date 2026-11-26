'use client';

import { CATEGORIES, CATEGORY_LABELS } from '@/components/eventCategories';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SelectField } from '@/components/ui/SelectField';
import { TimeField } from '@/components/ui/TimeField';
import type { EventCategory, ExpectedAction, Phase, ScenarioEvent } from '@/lib/engine/types';
import { EffectFields } from './EffectFields';

const CATEGORY_OPTIONS = CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }));
const TRIGGER_OPTIONS = [
  { value: 'auto' as const, label: 'Automatically, at a set time' },
  { value: 'faculty' as const, label: 'When faculty fires it' },
];

/**
 * The form for one event: what happens, when, where it belongs, what it does
 * to the monitor and which learner actions go with it. Used by the case
 * editor's event card and by the run-sheet import review, so an event is
 * filled in the same way in both.
 */
export function EventFields({
  event,
  phases,
  actions,
  onChange,
  onLabel,
  onSetAuto,
}: {
  event: ScenarioEvent;
  phases: Phase[];
  /** The case's expected actions, offered as links. */
  actions: ExpectedAction[];
  onChange: (patch: Partial<ScenarioEvent>) => void;
  onLabel: (label: string) => void;
  onSetAuto: (auto: boolean) => void;
}) {
  const auto = event.autoAtSec !== undefined;

  // An empty link list is written as absent, never [].
  const toggleLinked = (actionId: string) => {
    const cur = event.actionIds ?? [];
    const next = cur.includes(actionId) ? cur.filter((id) => id !== actionId) : [...cur, actionId];
    onChange({ actionIds: next.length > 0 ? next : undefined });
  };

  const phaseOptions = phases.map((p) => ({ value: p.id, label: p.label || 'Untitled phase' }));
  // Keep a hand-written hint that names no phase selectable, so opening the
  // form never rewrites it.
  if (event.phaseHint && !phases.some((p) => p.id === event.phaseHint)) {
    phaseOptions.push({ value: event.phaseHint, label: `${event.phaseHint} (not a phase)` });
  }

  return (
    <>
      <Field label="What happens">
        <input
          className="input"
          value={event.label}
          placeholder="For example: Blood pressure falls after induction"
          onChange={(e) => onLabel(e.target.value)}
        />
      </Field>
      <Field label="Notes for faculty" hint="Optional. Shown with the event on the run screen.">
        <textarea
          className="input"
          rows={2}
          value={event.description ?? ''}
          onChange={(e) => onChange({ description: e.target.value === '' ? undefined : e.target.value })}
        />
      </Field>
      <div className="flex flex-wrap items-start gap-3">
        <SegmentedControl
          label="When"
          value={auto ? 'auto' : 'faculty'}
          options={TRIGGER_OPTIONS}
          onChange={(t) => onSetAuto(t === 'auto')}
          hint={
            auto
              ? 'Fires by itself. Faculty can still fire it early, which cancels the timer.'
              : 'No timer. Faculty fires it when learners act or the case needs it.'
          }
        />
        {auto && (
          <TimeField
            className="w-32"
            label="At"
            valueSec={event.autoAtSec}
            required
            hint="From the start of the case."
            onChange={(autoAtSec) => autoAtSec !== undefined && onChange({ autoAtSec })}
          />
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label="Phase"
          value={event.phaseHint}
          options={phaseOptions}
          emptyLabel="No phase"
          hint="Where faculty expect it. It can still be fired in any phase."
          onChange={(phaseHint) => onChange({ phaseHint })}
        />
        <SelectField
          label="Category"
          value={event.category}
          options={CATEGORY_OPTIONS}
          hint="Sets its colour on the run screen."
          onChange={(category) => category && onChange({ category: category as EventCategory })}
        />
      </div>

      <div className="space-y-2">
        <span className="label">What it changes</span>
        {event.effects.length === 0 && (
          <p className="text-sm text-muted">
            Nothing on the monitor. Firing it only writes a note in the session log.
          </p>
        )}
        {event.effects.map((effect, k) => (
          <EffectFields
            key={k}
            effect={effect}
            title={event.effects.length > 1 ? `Change ${k + 1}` : undefined}
            onChange={(next) => onChange({ effects: event.effects.map((ef, m) => (m === k ? next : ef)) })}
            onRemove={() => onChange({ effects: event.effects.filter((_, m) => m !== k) })}
          />
        ))}
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={() => onChange({ effects: [...event.effects, {}] })}
        >
          <Icon name="plus" size={14} />
          {event.effects.length === 0 ? 'Add a change' : 'Add another change'}
        </button>
        {event.effects.length > 0 && (
          <p className="text-xs text-faint">
            A second change is for something that follows the first, such as a partial recovery a
            minute later.
          </p>
        )}
      </div>

      {actions.length > 0 && (
        <fieldset className="min-w-0">
          <legend className="label">Learner actions this goes with</legend>
          <div className="flex flex-wrap gap-1.5">
            {actions.map((a) => (
              <button
                key={a.id}
                type="button"
                className="chip max-w-full truncate text-left"
                aria-pressed={event.actionIds?.includes(a.id) ?? false}
                title={a.label}
                onClick={() => toggleLinked(a.id)}
              >
                {a.label || 'Untitled action'}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-faint">
            Optional. The run screen lists these under the event, so firing it and ticking them
            off happen in one place.
          </p>
        </fieldset>
      )}
    </>
  );
}
