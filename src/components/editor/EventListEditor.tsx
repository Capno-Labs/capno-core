'use client';

import { useRef, useState } from 'react';
import type {
  ExpectedAction,
  NumericVitals,
  Phase,
  ScenarioEvent,
  Vitals,
} from '@/lib/engine/types';
import { NUMERIC_VITAL_KEYS } from '@/lib/engine/types';
import type { LintWarning } from '@/lib/engine/lint';
import { CATEGORY_DOT } from '@/components/eventCategories';
import { EVENT_TEMPLATES, TEMPLATE_KINDS, type EventTemplate } from '@/lib/engine/eventTemplates';
import { effectSummary, fmtTime } from './EffectEditor';
import { EventDetailEditor } from './EventDetailEditor';
import { EventTimeline } from './EventTimeline';

/**
 * Master-detail editor for scenario events: a compact list of every event
 * (grouped by phase hint when phases are in play) beside a full-width form
 * for the ONE selected event (EventDetailEditor). Selection is local UI
 * state — it resets when the Timeline section remounts, and the first event
 * is auto-selected so the pane is never empty while events exist.
 *
 * Presets and templates are structural only — no clinical values are
 * invented; the recovery preset copies the author's own baseline.
 */
export function EventListEditor({
  events,
  phases,
  actions,
  baselineVitals,
  estimatedMinutes,
  warnings = [],
  onChange,
}: {
  events: ScenarioEvent[];
  phases: Phase[];
  /** The scenario's expected actions, offered as link targets per event. */
  actions: ExpectedAction[];
  baselineVitals: Vitals;
  estimatedMinutes: number;
  warnings?: LintWarning[];
  onChange: (events: ScenarioEvent[]) => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  // Clamp so the selection can never dangle after removals or remounts.
  const selected =
    selectedIndex !== null && selectedIndex < events.length
      ? selectedIndex
      : events.length > 0
        ? 0
        : null;
  const detailRef = useRef<HTMLDivElement | null>(null);

  const selectRow = (i: number) => {
    setSelectedIndex(i);
    // On stacked (sub-lg) layouts, bring the form to the tapped row's reader.
    detailRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  const patch = (i: number, p: Partial<ScenarioEvent>) =>
    onChange(events.map((ev, j) => (j === i ? { ...ev, ...p } : ev)));

  const removeEvent = (i: number) => {
    const next = events.filter((_, j) => j !== i);
    setSelectedIndex(next.length === 0 ? null : Math.min(i, next.length - 1));
    onChange(next);
  };

  // Remembers each event's last auto-fire time across trigger-type toggles so
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

  const addPreset = (preset: Pick<ScenarioEvent, 'category' | 'effects'> & Partial<ScenarioEvent>) => {
    setSelectedIndex(events.length); // the new event opens in the detail pane
    onChange([...events, { id: '', label: '', ...preset }]);
  };

  const [showTemplates, setShowTemplates] = useState(false);
  const [templateFilter, setTemplateFilter] = useState('');

  // Templates stamp an ordinary inline event: effects are deep-copied so
  // later edits never touch the registry, and the id stays blank — the
  // author must name it, same rule as the presets.
  const insertTemplate = (t: EventTemplate) => {
    addPreset({
      label: t.label,
      description: t.description,
      category: t.category,
      effects: structuredClone(t.effects),
    });
  };

  // Grouping is display-order only: rows always carry their original array
  // index (autoStash and the JSON document mirror array order); grouping
  // just changes which heading they sit under.
  const phaseGrouped = phases.length > 1 && events.some((e) => e.phaseHint !== undefined);
  const groups: Array<{ key: string; title: string; indices: number[] }> = [];
  if (phaseGrouped) {
    for (const p of phases) {
      const indices = events.flatMap((e, i) => (e.phaseHint === p.id ? [i] : []));
      if (indices.length > 0) groups.push({ key: p.id, title: p.label || p.id, indices });
    }
    const phaseIds = new Set(phases.map((p) => p.id));
    const unassigned = events.flatMap((e, i) =>
      e.phaseHint === undefined || !phaseIds.has(e.phaseHint) ? [i] : [],
    );
    if (unassigned.length > 0) groups.push({ key: '·unassigned', title: 'No phase hint', indices: unassigned });
  }

  const tq = templateFilter.trim().toLowerCase();
  const visibleTemplates = EVENT_TEMPLATES.filter(
    (t) =>
      tq === '' ||
      `${t.label} ${t.description} ${t.domain} ${t.category} ${t.source}`.toLowerCase().includes(tq),
  );

  const addButtons = (
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
        <button
          className="btn-secondary"
          aria-expanded={showTemplates}
          onClick={() => setShowTemplates((v) => !v)}
        >
          {showTemplates ? '− From template…' : '+ From template…'}
        </button>
      </div>
      <p className="text-xs text-slate-500">
        Presets only set up structure — you type every clinical value. Recovery pre-fills your
        baseline vitals; edit or blank any you don’t want to change.
      </p>
    </div>
  );

  const templatePanel = showTemplates && (
    <div className="space-y-2 rounded bg-slate-800/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="label !mb-0">Event templates</span>
        <input
          className="input w-56 !px-2 !py-1 text-sm"
          value={templateFilter}
          onChange={(e) => setTemplateFilter(e.target.value)}
          placeholder="Filter templates…"
          aria-label="Filter templates"
        />
      </div>
      <p className="text-xs text-slate-500">
        Templates copy reviewed vital values from the bundled scenarios (source shown per
        template) — verify them for your patient and baseline. The inserted event needs an id,
        and you choose its trigger.
      </p>
      {TEMPLATE_KINDS.map(({ kind, title }) => {
        const items = visibleTemplates.filter((t) => t.kind === kind);
        if (items.length === 0) return null;
        return (
          <div key={kind} className="space-y-1">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {title}
            </span>
            <ul className="space-y-1">
              {items.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center gap-2 rounded bg-slate-900/60 px-2 py-1.5 ring-1 ring-slate-800"
                >
                  <span
                    className={`inline-block h-2 w-2 shrink-0 rounded-full ${CATEGORY_DOT[t.category]}`}
                    title={t.category}
                  />
                  <span className="text-sm font-semibold text-slate-200">{t.label}</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-500" title={t.description}>
                    {t.effects.length === 0 ? 'log only' : t.effects.map(effectSummary).join(' | ')}
                  </span>
                  <span className="text-[10px] text-slate-600">{t.source}</span>
                  <button className="btn-secondary !px-2 !py-1 text-xs" onClick={() => insertTemplate(t)}>
                    Insert
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {visibleTemplates.length === 0 && (
        <p className="text-xs text-slate-500">No templates match “{templateFilter}”.</p>
      )}
    </div>
  );

  if (events.length === 0) {
    return (
      <div className="space-y-2">
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
        {addButtons}
        {templatePanel}
      </div>
    );
  }

  const row = (event: ScenarioEvent, i: number) => {
    const warningCount = warnings.filter((w) => w.path.startsWith(`events.${i}.`)).length;
    return (
      <li key={i}>
        <button
          className={`w-full px-2 py-1.5 text-left text-sm transition duration-150 ${
            i === selected
              ? 'bg-slate-800 text-slate-100'
              : 'text-slate-300 hover:bg-slate-800/50'
          }`}
          aria-current={i === selected ? 'true' : undefined}
          aria-label={`edit event ${event.label || event.id || i + 1}`}
          onClick={() => selectRow(i)}
        >
          <span className="flex items-center gap-1.5">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${CATEGORY_DOT[event.category]}`}
              title={event.category}
            />
            <span className="min-w-0 truncate font-semibold">
              {event.label || event.id || `Event ${i + 1}`}
            </span>
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px]">
            {event.autoAtSec !== undefined ? (
              <span className="rounded bg-sky-950 px-1 py-px font-semibold tracking-wider text-sky-300 ring-1 ring-sky-800">
                AUTO {fmtTime(event.autoAtSec)}
              </span>
            ) : (
              <span className="rounded bg-slate-900 px-1 py-px font-semibold tracking-wider text-slate-400 ring-1 ring-slate-700">
                FACULTY
              </span>
            )}
            <span className="text-slate-500">
              {event.effects.length} effect{event.effects.length === 1 ? '' : 's'}
            </span>
            {warningCount > 0 && (
              <span className="rounded bg-amber-950 px-1 py-px font-semibold text-amber-400 ring-1 ring-amber-800">
                ⚠ {warningCount}
              </span>
            )}
          </span>
        </button>
      </li>
    );
  };

  return (
    <div className="space-y-3">
      <EventTimeline events={events} estimatedMinutes={estimatedMinutes} onSelect={selectRow} />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <div className="space-y-3 lg:w-72 lg:shrink-0">
          <ul
            role="list"
            className="divide-y divide-slate-800 overflow-hidden rounded bg-slate-900/40 ring-1 ring-slate-800"
          >
            {phaseGrouped
              ? groups.map((g) => (
                  <li key={g.key}>
                    <div className="label !mb-0 px-2 pb-1 pt-2">
                      {g.title}{' '}
                      <span className="font-normal normal-case text-slate-600">
                        ({g.indices.length} · {g.indices.filter((i) => events[i].autoAtSec !== undefined).length} auto)
                      </span>
                    </div>
                    <ul role="list" className="divide-y divide-slate-800/60">
                      {g.indices.map((i) => row(events[i], i))}
                    </ul>
                  </li>
                ))
              : events.map((event, i) => row(event, i))}
          </ul>
          {addButtons}
        </div>
        <div className="min-w-0 flex-1" ref={detailRef}>
          {selected !== null && (
            <EventDetailEditor
              key={selected}
              event={events[selected]}
              index={selected}
              phases={phases}
              actions={actions}
              warnings={warnings}
              onChange={(p) => patch(selected, p)}
              onRemove={() => removeEvent(selected)}
              onSetAuto={(auto) => setTriggerType(selected, auto)}
            />
          )}
        </div>
      </div>
      {templatePanel}
    </div>
  );
}
