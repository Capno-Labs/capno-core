'use client';

import { useState, type ReactNode } from 'react';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { Menu, MenuItem } from '@/components/ui/Menu';
import { NumberField } from '@/components/ui/NumberField';
import { ReorderButtons } from '@/components/ui/ReorderButtons';
import { SelectField } from '@/components/ui/SelectField';
import { TimeField } from '@/components/ui/TimeField';
import type { ExpectedAction, Phase } from '@/lib/engine/types';
import { GrowingText } from './ListEditor';

/**
 * One expected learner action: its wording, whether it is critical, and —
 * behind "Details" — a note, the phase it belongs to and its points.
 */
function ActionRow({
  action,
  position,
  count,
  phases,
  linkedFrom,
  onLabel,
  onChange,
  onMove,
  onRemove,
}: {
  action: ExpectedAction;
  position: number;
  count: number;
  phases: Phase[];
  /** Labels of the events linked to this action. */
  linkedFrom: string[];
  onLabel: (label: string) => void;
  onChange: (patch: Partial<ExpectedAction>) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
}) {
  const [details, setDetails] = useState(false);
  const name = action.label || 'Untitled action';
  return (
    <li id={`action-${action.id}`} className="scroll-mt-40 space-y-1.5">
      <div className="flex items-start gap-1">
        <GrowingText
          value={action.label}
          ariaLabel={`Action ${position + 1}`}
          placeholder="What learners should do"
          onChange={onLabel}
        />
        <ReorderButtons
          name={name}
          index={position}
          count={count}
          onMove={(to) => onMove(to < position ? -1 : 1)}
          onRemove={onRemove}
        />
      </div>
      <div className="flex flex-wrap items-center gap-1.5 pl-0.5">
        <button
          type="button"
          className="chip aria-pressed:!bg-red-soft aria-pressed:!text-red aria-pressed:ring-1 aria-pressed:ring-red/40"
          aria-pressed={action.critical}
          title="Critical actions are flagged on the run screen and in the debrief"
          onClick={() => onChange({ critical: !action.critical })}
        >
          Critical
        </button>
        <button
          type="button"
          className="chip"
          aria-expanded={details}
          onClick={() => setDetails((v) => !v)}
        >
          {details ? 'Hide details' : 'Details'}
        </button>
        {linkedFrom.length > 0 && (
          <span className="min-w-0 truncate text-[11px] text-faint" title={linkedFrom.join(', ')}>
            Goes with: {linkedFrom.join(', ')}
          </span>
        )}
      </div>
      {details && (
        <div className="space-y-3 rounded-ctl bg-panel/60 p-3 ring-1 ring-line">
          <Field label="Note" hint="Optional. What counts as doing this, for whoever is marking.">
            <textarea
              className="input"
              rows={2}
              value={action.description ?? ''}
              onChange={(e) => onChange({ description: e.target.value === '' ? undefined : e.target.value })}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              label="Phase"
              value={phases.some((p) => p.id === action.phase) ? action.phase : undefined}
              options={phases.map((p) => ({ value: p.id, label: p.label || 'Untitled phase' }))}
              emptyLabel="Any phase"
              onChange={(phase) => onChange({ phase })}
            />
            <NumberField
              label="Points"
              value={action.points}
              min={0}
              max={1000}
              integer
              required
              hint="Only matters if you report scores."
              onChange={(points) => points !== undefined && onChange({ points })}
            />
          </div>
        </div>
      )}
    </li>
  );
}

export interface PhaseCardAction {
  /** Index into the scenario's expectedActions. */
  index: number;
  action: ExpectedAction;
  linkedFrom: string[];
}

/**
 * One phase of the case: its name and pacing on top, then what happens in it
 * (events, passed in as rendered cards) beside what learners should do about
 * it. With `phase` null it is the holding area for items that have no phase.
 */
export function PhaseCard({
  phase,
  number,
  position,
  count,
  phases,
  eventCards,
  actions,
  onLabel,
  onChange,
  onMove,
  onRemove,
  onAddEvent,
  onAddAction,
  onActionLabel,
  onActionChange,
  onActionMove,
  onActionRemove,
}: {
  phase: Phase | null;
  number: number;
  position: number;
  count: number;
  phases: Phase[];
  eventCards: ReactNode[];
  actions: PhaseCardAction[];
  onLabel: (label: string) => void;
  onChange: (patch: Partial<Phase>) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
  onAddEvent: (kind: 'timed' | 'faculty' | 'note' | 'recovery' | 'template') => void;
  onAddAction: (label: string) => void;
  onActionLabel: (index: number, label: string) => void;
  onActionChange: (index: number, patch: Partial<ExpectedAction>) => void;
  onActionMove: (index: number, by: -1 | 1) => void;
  onActionRemove: (index: number) => void;
}) {
  const [draft, setDraft] = useState('');
  const addAction = () => {
    const label = draft.trim();
    if (!label) return;
    onAddAction(label);
    setDraft('');
  };
  const name = phase ? phase.label || `Phase ${number}` : 'No phase';

  return (
    <section
      id={phase ? `phase-${phase.id}` : undefined}
      className="card scroll-mt-40 space-y-4"
      aria-label={name}
    >
      {phase ? (
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <span
              aria-hidden
              className="mt-1.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand font-mono text-xs font-semibold text-on-brand"
            >
              {number}
            </span>
            <input
              className="input min-w-0 flex-1 text-base font-bold"
              value={phase.label}
              placeholder="Name this phase, for example Induction"
              aria-label={`Phase ${number} name`}
              onChange={(e) => onLabel(e.target.value)}
            />
            <ReorderButtons
              name={name}
              index={position}
              count={count}
              onMove={onMove}
              onRemove={count > 1 ? onRemove : undefined}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_11rem]">
            <Field label="What is going on" hint="Optional. A line for faculty on the run screen.">
              <input
                className="input"
                value={phase.description ?? ''}
                onChange={(e) => onChange({ description: e.target.value === '' ? undefined : e.target.value })}
              />
            </Field>
            <TimeField
              label="Should take"
              valueSec={phase.targetDurationSec}
              minSec={1}
              placeholder="No target"
              hint="The run screen flags the phase once it runs over."
              onChange={(targetDurationSec) => onChange({ targetDurationSec })}
            />
          </div>
        </div>
      ) : (
        <div>
          <h3 className="text-base font-bold text-ink">No phase</h3>
          <p className="mt-0.5 text-xs text-faint">
            Not tied to a phase: these can come up at any point. Open one and choose a phase to move it.
          </p>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <h4 className="label !mb-0">What happens</h4>
          {eventCards.length > 0 ? (
            <ul className="space-y-1.5">{eventCards}</ul>
          ) : (
            <p className="text-sm text-faint">Nothing yet. Add what changes in this phase.</p>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" className="btn-secondary btn-sm" onClick={() => onAddEvent('timed')}>
              <Icon name="plus" size={14} /> Timed change
            </button>
            <button type="button" className="btn-secondary btn-sm" onClick={() => onAddEvent('faculty')}>
              <Icon name="plus" size={14} /> Faculty-fired change
            </button>
            <Menu label="More kinds of event" align="left">
              <MenuItem icon="file" onSelect={() => onAddEvent('template')}>
                From a template or My events…
              </MenuItem>
              <MenuItem icon="reset" onSelect={() => onAddEvent('recovery')}>
                Return to the starting vitals
              </MenuItem>
              <MenuItem icon="edit" onSelect={() => onAddEvent('note')}>
                Note in the log (changes nothing)
              </MenuItem>
            </Menu>
          </div>
        </div>

        <div className="min-w-0 space-y-2">
          <h4 className="label !mb-0">Learners should</h4>
          {actions.length > 0 && (
            <ul className="space-y-2.5">
              {actions.map(({ index, action, linkedFrom }, at) => (
                <ActionRow
                  key={index}
                  action={action}
                  position={at}
                  count={actions.length}
                  phases={phases}
                  linkedFrom={linkedFrom}
                  onLabel={(label) => onActionLabel(index, label)}
                  onChange={(patch) => onActionChange(index, patch)}
                  onMove={(by) => onActionMove(index, by)}
                  onRemove={() => onActionRemove(index)}
                />
              ))}
            </ul>
          )}
          <div className="flex items-start gap-2">
            <GrowingText
              value={draft}
              ariaLabel={`Add an action to ${name}`}
              placeholder="Add an expected action…"
              onChange={setDraft}
              onEnter={addAction}
            />
            <button type="button" className="btn-secondary shrink-0" onClick={addAction} disabled={!draft.trim()}>
              Add
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
