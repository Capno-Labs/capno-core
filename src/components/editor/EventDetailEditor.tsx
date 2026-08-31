'use client';

import type { EventCategory, ExpectedAction, Phase, ScenarioEvent } from '@/lib/engine/types';
import type { LintWarning } from '@/lib/engine/lint';
import { CATEGORIES, CATEGORY_DOT } from '@/components/eventCategories';
import { EffectEditor, fmtTime } from './EffectEditor';

/**
 * The detail surface of the master-detail event editor: the full form for
 * ONE selected event. Purely presentational — selection, ordering, and the
 * autoStash for the trigger toggle live in EventListEditor (they are keyed
 * by array index, which only the list knows about).
 */
export function EventDetailEditor({
  event,
  index,
  phases,
  actions,
  warnings,
  onChange,
  onRemove,
  onSetAuto,
  onSaveToLibrary,
}: {
  event: ScenarioEvent;
  index: number;
  phases: Phase[];
  /** The scenario's expected actions, offered as link targets. */
  actions: ExpectedAction[];
  warnings: LintWarning[];
  onChange: (patch: Partial<ScenarioEvent>) => void;
  onRemove: () => void;
  /** Trigger-type toggle — kept upstream so the fires-at stash survives. */
  onSetAuto: (auto: boolean) => void;
  /** Save this event to the personal library; store + toasts live upstream. */
  onSaveToLibrary?: () => void;
}) {
  const title = event.label || event.id || `Event ${index + 1}`;
  const warningCount = warnings.filter((w) => w.path.startsWith(`events.${index}.`)).length;

  // Empty link list is written as undefined, matching the description-field
  // convention (absent, not []).
  const toggleLinked = (actionId: string) => {
    const cur = event.actionIds ?? [];
    const next = cur.includes(actionId)
      ? cur.filter((id) => id !== actionId)
      : [...cur, actionId];
    onChange({ actionIds: next.length > 0 ? next : undefined });
  };

  return (
    <section aria-label={`Editing event: ${title}`} className="space-y-2 rounded bg-panel-2 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-block h-2 w-2 rounded-full ${CATEGORY_DOT[event.category]}`}
          title={event.category}
        />
        <span className="text-sm font-bold">{title}</span>
        {event.autoAtSec !== undefined ? (
          <span className="rounded bg-blue-soft px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-amber-strong ring-1 ring-blue/30">
            AUTO {fmtTime(event.autoAtSec)}
          </span>
        ) : (
          <span className="rounded bg-panel px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-muted ring-1 ring-line">
            FACULTY-FIRED
          </span>
        )}
        {warningCount > 0 && (
          <span className="rounded bg-amber-soft px-1.5 py-0.5 text-[10px] font-semibold text-amber-strong ring-1 ring-amber/40">
            ⚠ {warningCount}
          </span>
        )}
        <div className="ml-auto flex gap-1">
          {onSaveToLibrary && (
            <button
              className="btn-ghost !px-2 !py-1"
              onClick={onSaveToLibrary}
              title="Save this event to your personal library for reuse in other scenarios"
            >
              ☆ Save to library
            </button>
          )}
          <button
            className="btn-ghost !px-2 !py-1 text-red"
            onClick={onRemove}
            aria-label={`remove event ${title}`}
          >
            ✕ Remove event
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className="label">Event id (kebab-case)</span>
          <input
            className="input font-mono"
            value={event.id}
            onChange={(e) => onChange({ id: e.target.value })}
          />
        </div>
        <div>
          <span className="label">Label</span>
          <input
            className="input"
            value={event.label}
            onChange={(e) => onChange({ label: e.target.value })}
          />
        </div>
      </div>
      <div>
        <span className="label">Description (optional)</span>
        <textarea
          className="input"
          rows={2}
          value={event.description ?? ''}
          onChange={(e) =>
            onChange({ description: e.target.value === '' ? undefined : e.target.value })
          }
        />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <span className="label">Category</span>
          <select
            className="input w-auto"
            value={event.category}
            onChange={(e) => onChange({ category: e.target.value as EventCategory })}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className="label">Usual phase (hint)</span>
          <select
            className="input w-auto"
            value={event.phaseHint ?? ''}
            onChange={(e) =>
              onChange({ phaseHint: e.target.value === '' ? undefined : e.target.value })
            }
          >
            <option value="">— none —</option>
            {phases.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label || p.id}
              </option>
            ))}
            {/* Preserve free-text hints from hand-edited JSON. */}
            {event.phaseHint && !phases.some((p) => p.id === event.phaseHint) && (
              <option value={event.phaseHint}>{event.phaseHint}</option>
            )}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <span className="label">Trigger</span>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex overflow-hidden rounded-md ring-1 ring-line" role="group">
            <button
              className={`px-3 py-1.5 text-xs font-semibold ${
                event.autoAtSec !== undefined
                  ? 'bg-amber text-[#1b1c17]'
                  : 'bg-panel-2 text-muted hover:bg-panel-3'
              }`}
              aria-pressed={event.autoAtSec !== undefined}
              onClick={() => onSetAuto(true)}
            >
              Automatic (scripted)
            </button>
            <button
              className={`px-3 py-1.5 text-xs font-semibold ${
                event.autoAtSec === undefined
                  ? 'bg-amber text-[#1b1c17]'
                  : 'bg-panel-2 text-muted hover:bg-panel-3'
              }`}
              aria-pressed={event.autoAtSec === undefined}
              onClick={() => onSetAuto(false)}
            >
              Faculty-fired
            </button>
          </div>
          {event.autoAtSec !== undefined && (
            <div className="flex items-end gap-2">
              <div>
                <span className="label">Fires at (s from start)</span>
                <input
                  className="input w-28"
                  type="number"
                  min={0}
                  value={event.autoAtSec}
                  onChange={(e) =>
                    onChange({ autoAtSec: Math.max(0, Number(e.target.value) || 0) })
                  }
                />
              </div>
              <span className="pb-2 font-mono text-xs text-muted">
                = {fmtTime(event.autoAtSec)}
              </span>
            </div>
          )}
        </div>
        <p className="text-xs text-faint">
          {event.autoAtSec !== undefined
            ? 'Fires by itself at this elapsed time — use for scripted deterioration. Faculty can still fire it early, which cancels the timer.'
            : 'No timer. Faculty taps it when learners act — use for treatment responses and improvised turns.'}
        </p>
      </div>
      {actions.length > 0 && (
        <div className="space-y-1">
          <span className="label">Linked learner actions</span>
          <div className="grid gap-1 sm:grid-cols-2">
            {actions.map((a) => (
              <label
                key={a.id}
                className="flex cursor-pointer items-center gap-2 rounded bg-panel/60 px-2 py-1 text-sm text-ink-2"
              >
                <input
                  type="checkbox"
                  checked={event.actionIds?.includes(a.id) ?? false}
                  onChange={() => toggleLinked(a.id)}
                />
                <span className="min-w-0 truncate" title={a.description ?? a.label}>
                  {a.critical && <span className="mr-1 text-red">●</span>}
                  {a.label || a.id || '(unnamed action)'}
                </span>
              </label>
            ))}
          </div>
          <p className="text-xs text-faint">
            The actions this event embodies or responds to — the run screen shows them under the
            event’s card so firing and marking happen in one place. Unlinked actions stay in the
            general checklist.
          </p>
        </div>
      )}
      <div className="space-y-2">
        <span className="label">Effects</span>
        {event.effects.map((effect, k) => (
          <EffectEditor
            key={k}
            effect={effect}
            onChange={(next) =>
              onChange({ effects: event.effects.map((ef, m) => (m === k ? next : ef)) })
            }
            onRemove={() => onChange({ effects: event.effects.filter((_, m) => m !== k) })}
          />
        ))}
        <button
          className="btn-secondary"
          onClick={() => onChange({ effects: [...event.effects, {}] })}
        >
          + Add effect
        </button>
      </div>
    </section>
  );
}
