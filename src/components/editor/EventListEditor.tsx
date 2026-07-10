'use client';

import { useRef, useState } from 'react';
import type {
  CapnoShape,
  EventCategory,
  NumericVitals,
  Phase,
  Rhythm,
  ScenarioEvent,
  VitalEffect,
  Vitals,
} from '@/lib/engine/types';
import { CAPNO_SHAPE_LABELS, NUMERIC_VITAL_KEYS, RHYTHM_LABELS } from '@/lib/engine/types';
import type { LintWarning } from '@/lib/engine/lint';
import { VITAL_META } from '@/lib/engine/vitals';
import { CATEGORIES, CATEGORY_DOT } from '@/components/eventCategories';
import { EventTimeline } from './EventTimeline';

/**
 * Form editor for scenario events and their vital effects.
 *
 * Correctness-critical convention: an empty vital input means "unchanged"
 * (the key is absent from effect.vitals) — it is never written as 0. A 0
 * systolic pressure is a very different scenario than "leave it alone".
 * No clinical values are pre-filled anywhere; faculty type every number.
 */

const fmtTime = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

/** One-line recap of what an effect does, so multi-effect events scan fast. */
function effectSummary(effect: VitalEffect): string {
  const parts: string[] = [];
  for (const key of NUMERIC_VITAL_KEYS) {
    const v = effect.vitals?.[key];
    if (v !== undefined) parts.push(`${VITAL_META[key].label}→${v}`);
  }
  if (effect.rhythm) parts.push(`rhythm→${RHYTHM_LABELS[effect.rhythm]}`);
  if (effect.capnoShape) parts.push(`CO₂→${CAPNO_SHAPE_LABELS[effect.capnoShape]}`);
  if (parts.length === 0) return 'no changes yet';
  const timing: string[] = [];
  if (effect.afterSec) timing.push(`after ${effect.afterSec}s`);
  if (effect.overSec) timing.push(`over ${effect.overSec}s`);
  return parts.join(' · ') + (timing.length > 0 ? ` · ${timing.join(', ')}` : '');
}

function EffectEditor({
  effect,
  onChange,
  onRemove,
}: {
  effect: VitalEffect;
  onChange: (effect: VitalEffect) => void;
  onRemove: () => void;
}) {
  const setVital = (key: keyof NumericVitals, raw: string) => {
    const vitals = { ...(effect.vitals ?? {}) };
    if (raw === '') {
      delete vitals[key]; // empty = "unchanged", never 0
    } else {
      vitals[key] = Number(raw);
    }
    onChange(
      Object.keys(vitals).length > 0
        ? { ...effect, vitals }
        : (({ vitals: _v, ...rest }) => rest)(effect),
    );
  };

  const setNum = (field: 'afterSec' | 'overSec', raw: string) => {
    const next = { ...effect };
    if (raw === '') delete next[field];
    else next[field] = Math.max(0, Number(raw));
    onChange(next);
  };

  return (
    <div className="space-y-2 rounded bg-slate-900/60 p-2 ring-1 ring-slate-800">
      <p className="font-mono text-[11px] text-slate-400">{effectSummary(effect)}</p>
      <p className="text-xs text-slate-500">
        When the event fires: wait the delay, then ramp the vitals below to their targets over the
        ramp duration (blank vital = unchanged).
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <span className="label">Delay before start (s)</span>
          <input
            className="input w-24"
            type="number"
            min={0}
            placeholder="0"
            value={effect.afterSec ?? ''}
            onChange={(e) => setNum('afterSec', e.target.value)}
          />
        </div>
        <div>
          <span className="label">Ramp duration (s)</span>
          <input
            className="input w-24"
            type="number"
            min={0}
            placeholder="0 = instant"
            value={effect.overSec ?? ''}
            onChange={(e) => setNum('overSec', e.target.value)}
          />
        </div>
        <div>
          <span className="label">Rhythm</span>
          <select
            className="input w-auto"
            value={effect.rhythm ?? ''}
            onChange={(e) => {
              const next = { ...effect };
              if (e.target.value === '') delete next.rhythm;
              else next.rhythm = e.target.value as Rhythm;
              onChange(next);
            }}
          >
            <option value="">— unchanged —</option>
            {(Object.keys(RHYTHM_LABELS) as Rhythm[]).map((r) => (
              <option key={r} value={r}>
                {RHYTHM_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className="label">CO₂ waveform</span>
          <select
            className="input w-auto"
            value={effect.capnoShape ?? ''}
            onChange={(e) => {
              const next = { ...effect };
              if (e.target.value === '') delete next.capnoShape;
              else next.capnoShape = e.target.value as CapnoShape;
              onChange(next);
            }}
          >
            <option value="">— unchanged —</option>
            {(Object.keys(CAPNO_SHAPE_LABELS) as CapnoShape[]).map((s) => (
              <option key={s} value={s}>
                {CAPNO_SHAPE_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <button
          className="btn-ghost ml-auto !px-2 !py-1 text-red-400"
          onClick={onRemove}
          aria-label="remove effect"
        >
          ✕
        </button>
      </div>
      <div>
        <span className="label">Vital targets (blank = unchanged)</span>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {NUMERIC_VITAL_KEYS.map((key) => {
            const meta = VITAL_META[key];
            return (
              <div key={key}>
                <span className="block text-[10px] uppercase tracking-wider text-slate-500">
                  {meta.label}
                  {meta.unit ? ` (${meta.unit})` : ''}
                </span>
                <input
                  className="input !px-2 !py-1 text-sm"
                  type="number"
                  min={meta.min}
                  max={meta.max}
                  step={meta.step}
                  value={effect.vitals?.[key] ?? ''}
                  onChange={(e) => setVital(key, e.target.value)}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function EventListEditor({
  events,
  phases,
  baselineVitals,
  estimatedMinutes,
  warnings = [],
  onChange,
}: {
  events: ScenarioEvent[];
  phases: Phase[];
  baselineVitals: Vitals;
  estimatedMinutes: number;
  warnings?: LintWarning[];
  onChange: (events: ScenarioEvent[]) => void;
}) {
  // Open/closed is explicit state: a plain `open` attribute would be
  // re-applied by React on every keystroke re-render, snapping cards shut.
  const [openCards, setOpenCards] = useState<Set<number>>(new Set());
  const setOpen = (i: number, isOpen: boolean) =>
    setOpenCards((prev) => {
      if (prev.has(i) === isOpen) return prev;
      const next = new Set(prev);
      if (isOpen) next.add(i);
      else next.delete(i);
      return next;
    });

  const patch = (i: number, p: Partial<ScenarioEvent>) =>
    onChange(events.map((ev, j) => (j === i ? { ...ev, ...p } : ev)));

  // Remembers each card's last auto-fire time across trigger-type toggles so
  // switching to faculty-fired and back doesn't lose it. Index-keyed UI
  // convenience only — never serialized, resets on remove/reorder.
  const autoStash = useRef<Map<number, number>>(new Map());

  const setTriggerType = (i: number, auto: boolean) => {
    const event = events[i];
    if (auto === (event.autoAtSec !== undefined)) return;
    const next = { ...event };
    if (auto) {
      next.autoAtSec = autoStash.current.get(i) ?? 0;
    } else {
      if (event.autoAtSec !== undefined) autoStash.current.set(i, event.autoAtSec);
      delete next.autoAtSec;
    }
    onChange(events.map((ev, j) => (j === i ? next : ev)));
  };

  // Presets are structural only — no clinical values are invented; the
  // recovery preset copies the author's own baseline.
  const addPreset = (preset: Pick<ScenarioEvent, 'category' | 'effects'> & Partial<ScenarioEvent>) => {
    setOpen(events.length, true); // new card starts expanded
    onChange([...events, { id: '', label: '', ...preset }]);
  };

  return (
    <div className="space-y-2">
      {events.length > 0 && (
        <EventTimeline
          events={events}
          estimatedMinutes={estimatedMinutes}
          onSelect={(i) => setOpen(i, true)}
        />
      )}
      {events.map((event, i) => (
        <details
          key={i}
          className="rounded bg-slate-800/60 p-2"
          open={openCards.has(i)}
          onToggle={(e) => setOpen(i, (e.target as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer text-sm">
            <span
              className={`mr-1.5 inline-block h-2 w-2 rounded-full align-middle ${CATEGORY_DOT[event.category]}`}
              title={event.category}
            />
            <span className="font-bold">{event.label || event.id || `Event ${i + 1}`}</span>{' '}
            {event.autoAtSec !== undefined ? (
              <span className="rounded bg-sky-950 px-1.5 py-0.5 align-middle text-[10px] font-semibold tracking-wider text-sky-300 ring-1 ring-sky-800">
                AUTO {fmtTime(event.autoAtSec)}
              </span>
            ) : (
              <span className="rounded bg-slate-900 px-1.5 py-0.5 align-middle text-[10px] font-semibold tracking-wider text-slate-400 ring-1 ring-slate-700">
                FACULTY-FIRED
              </span>
            )}{' '}
            <span className="text-xs text-slate-500">
              {event.category} · {event.effects.length} effect
              {event.effects.length === 1 ? '' : 's'}
            </span>
            {(() => {
              const n = warnings.filter((w) => w.path.startsWith(`events.${i}.`)).length;
              return n > 0 ? (
                <span className="ml-1.5 rounded bg-amber-950 px-1.5 py-0.5 align-middle text-[10px] font-semibold text-amber-400 ring-1 ring-amber-800">
                  ⚠ {n}
                </span>
              ) : null;
            })()}
          </summary>
          <div className="mt-2 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="label">Event id (kebab-case)</span>
                <input
                  className="input font-mono"
                  value={event.id}
                  onChange={(e) => patch(i, { id: e.target.value })}
                />
              </div>
              <div>
                <span className="label">Label</span>
                <input
                  className="input"
                  value={event.label}
                  onChange={(e) => patch(i, { label: e.target.value })}
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
                  patch(i, { description: e.target.value === '' ? undefined : e.target.value })
                }
              />
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <span className="label">Category</span>
                <select
                  className="input w-auto"
                  value={event.category}
                  onChange={(e) => patch(i, { category: e.target.value as EventCategory })}
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
                    patch(i, { phaseHint: e.target.value === '' ? undefined : e.target.value })
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
              <button
                className="btn-ghost ml-auto !px-2 !py-1 text-red-400"
                onClick={() => onChange(events.filter((_, j) => j !== i))}
                aria-label={`remove event ${event.label || i + 1}`}
              >
                ✕ Remove event
              </button>
            </div>
            <div className="space-y-1.5">
              <span className="label">Trigger</span>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex overflow-hidden rounded-md ring-1 ring-slate-700" role="group">
                  <button
                    className={`px-3 py-1.5 text-xs font-semibold ${
                      event.autoAtSec !== undefined
                        ? 'bg-sky-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                    aria-pressed={event.autoAtSec !== undefined}
                    onClick={() => setTriggerType(i, true)}
                  >
                    Automatic (scripted)
                  </button>
                  <button
                    className={`px-3 py-1.5 text-xs font-semibold ${
                      event.autoAtSec === undefined
                        ? 'bg-sky-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                    aria-pressed={event.autoAtSec === undefined}
                    onClick={() => setTriggerType(i, false)}
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
                          patch(i, { autoAtSec: Math.max(0, Number(e.target.value) || 0) })
                        }
                      />
                    </div>
                    <span className="pb-2 font-mono text-xs text-slate-400">
                      = {fmtTime(event.autoAtSec)}
                    </span>
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {event.autoAtSec !== undefined
                  ? 'Fires by itself at this elapsed time — use for scripted deterioration. Faculty can still fire it early, which cancels the timer.'
                  : 'No timer. Faculty taps it when learners act — use for treatment responses and improvised turns.'}
              </p>
            </div>
            <div className="space-y-2">
              <span className="label">Effects</span>
              {event.effects.map((effect, k) => (
                <EffectEditor
                  key={k}
                  effect={effect}
                  onChange={(next) =>
                    patch(i, { effects: event.effects.map((ef, m) => (m === k ? next : ef)) })
                  }
                  onRemove={() => patch(i, { effects: event.effects.filter((_, m) => m !== k) })}
                />
              ))}
              <button
                className="btn-secondary"
                onClick={() => patch(i, { effects: [...event.effects, {}] })}
              >
                + Add effect
              </button>
            </div>
          </div>
        </details>
      ))}
      {events.length === 0 && (
        <div className="space-y-1 rounded bg-slate-800/60 p-3 text-xs text-slate-400">
          <p className="font-semibold text-slate-300">No events yet — events are the script of the case.</p>
          <p>
            <span className="text-sky-300">Automatic</span> events fire on a timer and drive the
            scripted deterioration. <span className="text-slate-300">Faculty-fired</span> events are
            responses the instructor triggers when learners act (drug given, airway secured).{' '}
            <span className="text-slate-300">Marker</span> events change nothing — they just write a
            log line. Start with a preset below.
          </p>
        </div>
      )}
      <div className="space-y-1">
        <span className="label">Add event</span>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => addPreset({ category: 'physiology', autoAtSec: 0, effects: [{}] })}>
            + Deterioration (automatic)
          </button>
          <button className="btn-secondary" onClick={() => addPreset({ category: 'drug', effects: [{}] })}>
            + Treatment response (faculty-fired)
          </button>
          <button className="btn-secondary" onClick={() => addPreset({ category: 'other', effects: [] })}>
            + Marker / log-only
          </button>
          <button
            className="btn-secondary"
            onClick={() => {
              const vitals: Partial<NumericVitals> = {};
              for (const key of NUMERIC_VITAL_KEYS) vitals[key] = baselineVitals[key];
              addPreset({
                category: 'resolution',
                effects: [{ vitals, rhythm: baselineVitals.rhythm }],
              });
            }}
          >
            + Recovery to baseline (faculty-fired)
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Presets only set up structure — you type every clinical value. Recovery pre-fills your
          baseline vitals; edit or blank any you don’t want to change.
        </p>
      </div>
    </div>
  );
}
