'use client';

import { CATEGORIES, CATEGORY_DOT, CATEGORY_LABELS } from '@/components/eventCategories';
import { Callout } from '@/components/ui/Callout';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { ReorderButtons } from '@/components/ui/ReorderButtons';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SelectField } from '@/components/ui/SelectField';
import { TimeField } from '@/components/ui/TimeField';
import type { LintWarning } from '@/lib/engine/lint';
import type { EventCategory, ExpectedAction, Phase, ScenarioEvent } from '@/lib/engine/types';
import { describeEvent, describeTrigger } from '@/lib/scenarios/progression';
import { EffectFields } from './EffectFields';

const CATEGORY_OPTIONS = CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }));
const TRIGGER_OPTIONS = [
  { value: 'auto' as const, label: 'Automatically, at a set time' },
  { value: 'faculty' as const, label: 'When faculty fires it' },
];

/**
 * One thing that happens in the case. Closed, it reads as a sentence: what,
 * when, and what it does to the monitor. Open, it is the whole form for that
 * event. Presentational: ordering, ids and the trigger-time memory live in
 * ProgressionSection.
 */
export function EventCard({
  event,
  open,
  position,
  count,
  phases,
  actions,
  warnings,
  onToggle,
  onChange,
  onLabel,
  onSetAuto,
  onMove,
  onRemove,
  onDuplicate,
  onSaveToLibrary,
}: {
  event: ScenarioEvent;
  open: boolean;
  /** Place among the events shown with it, for the move buttons. */
  position: number;
  count: number;
  phases: Phase[];
  /** The case's expected actions, offered as links. */
  actions: ExpectedAction[];
  /** Lint messages about this event. */
  warnings: LintWarning[];
  onToggle: () => void;
  onChange: (patch: Partial<ScenarioEvent>) => void;
  onLabel: (label: string) => void;
  onSetAuto: (auto: boolean) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onSaveToLibrary: () => void;
}) {
  const title = event.label || 'Untitled';
  const auto = event.autoAtSec !== undefined;

  // An empty link list is written as absent, never [].
  const toggleLinked = (actionId: string) => {
    const cur = event.actionIds ?? [];
    const next = cur.includes(actionId) ? cur.filter((id) => id !== actionId) : [...cur, actionId];
    onChange({ actionIds: next.length > 0 ? next : undefined });
  };

  const phaseOptions = phases.map((p) => ({ value: p.id, label: p.label || 'Untitled phase' }));
  // Keep a hand-written hint that names no phase selectable, so opening the
  // card never rewrites it.
  if (event.phaseHint && !phases.some((p) => p.id === event.phaseHint)) {
    phaseOptions.push({ value: event.phaseHint, label: `${event.phaseHint} (not a phase)` });
  }

  return (
    <li
      id={`event-${event.id}`}
      className={`scroll-mt-40 rounded-ctl ring-1 transition duration-150 ease-brand ${
        open ? 'bg-panel-2 ring-line-2' : 'bg-panel-2/60 ring-line hover:bg-panel-2'
      }`}
    >
      <button
        type="button"
        aria-expanded={open}
        className="flex w-full items-start gap-2.5 rounded-ctl px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        onClick={onToggle}
      >
        <span
          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${CATEGORY_DOT[event.category]}`}
          title={CATEGORY_LABELS[event.category]}
        />
        <span className="min-w-0 flex-1">
          <span className={`block text-sm font-semibold ${event.label ? 'text-ink' : 'text-faint'}`}>{title}</span>
          <span className="mt-0.5 block text-xs text-muted">
            <span className={auto ? 'font-semibold text-brand-strong' : 'font-semibold text-ink-2'}>
              {describeTrigger(event)}
            </span>
            <span className="text-faint"> · </span>
            {describeEvent(event)}
          </span>
        </span>
        {warnings.length > 0 && (
          <span
            className="mt-0.5 inline-flex shrink-0 items-center gap-0.5 rounded-full bg-warn-soft px-1.5 py-0.5 text-[10px] font-semibold text-warn-strong ring-1 ring-warn/40"
            title={`${warnings.length} thing${warnings.length === 1 ? '' : 's'} worth a look`}
          >
            <Icon name="alert" size={10} />
            {warnings.length}
          </span>
        )}
        <Icon
          name="chevron-down"
          size={16}
          className={`mt-0.5 shrink-0 text-faint transition ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="space-y-3 border-t border-line px-3 pb-3 pt-3">
          {warnings.length > 0 && (
            <Callout tone="warn" title="Worth a look">
              <ul className="list-disc space-y-0.5 pl-4">
                {warnings.map((w, i) => (
                  <li key={i}>{w.message}</li>
                ))}
              </ul>
            </Callout>
          )}
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

          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <button type="button" className="btn-ghost btn-sm" onClick={onDuplicate}>
              <Icon name="copy" size={14} /> Duplicate
            </button>
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={onSaveToLibrary}
              title="Keep a copy in My events to reuse in other cases"
            >
              <Icon name="save" size={14} /> Save to My events
            </button>
            <span className="ml-auto">
              <ReorderButtons
                name={title}
                index={position}
                count={count}
                onMove={(to) => onMove(to < position ? -1 : 1)}
                onRemove={onRemove}
              />
            </span>
          </div>
        </div>
      )}
    </li>
  );
}
