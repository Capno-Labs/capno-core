'use client';

import { useEffect, useRef, useState } from 'react';
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
import { downloadJson } from '@/lib/download';
import { EVENT_TEMPLATES, TEMPLATE_KINDS, type EventTemplate } from '@/lib/engine/eventTemplates';
import {
  parseLibraryFile,
  payloadFromEvent,
  savedEventPayloadSchema,
  serializeLibraryFile,
  type SavedEvent,
} from '@/lib/scenarios/eventLibrary';
import {
  deleteSavedEvent,
  importSavedEvents,
  listSavedEvents,
  saveEventToLibrary,
} from '@/lib/scenarios/eventLibraryStore';
import { toast } from '@/lib/store/toastStore';
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

  // Personal event library. Read in an effect keyed on the panel opening
  // (never during render — the panel is closed at first paint, so SSR and
  // hydration never touch localStorage); refreshed after save/delete/import.
  const [savedEvents, setSavedEvents] = useState<SavedEvent[]>([]);
  useEffect(() => {
    if (showTemplates) setSavedEvents(listSavedEvents());
  }, [showTemplates]);
  const libraryFileInput = useRef<HTMLInputElement | null>(null);

  const saveToLibrary = (event: ScenarioEvent) => {
    const payload = payloadFromEvent(event);
    if (!savedEventPayloadSchema.safeParse(payload).success) {
      toast('Give the event a label and valid effects before saving.', 'error');
      return;
    }
    const result = saveEventToLibrary(payload);
    if (result.ok) {
      toast(`Saved “${payload.label}” to your event library`, 'success');
      setSavedEvents(listSavedEvents());
    } else {
      toast(result.error, result.duplicate ? 'info' : 'error');
    }
  };

  const removeFromLibrary = (entry: SavedEvent) => {
    deleteSavedEvent(entry.id);
    setSavedEvents(listSavedEvents());
    toast(`Removed “${entry.label}” from your library`, 'info');
  };

  const importLibraryFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseLibraryFile(String(reader.result));
      if (!parsed.ok) {
        toast(parsed.errors[0], 'error');
        return;
      }
      const result = importSavedEvents(parsed.file.events);
      if (!result.ok) {
        toast(result.error, 'error');
        return;
      }
      setSavedEvents(listSavedEvents());
      const parts = [`Imported ${result.added} event${result.added === 1 ? '' : 's'}`];
      if (result.skippedDuplicates > 0) parts.push(`${result.skippedDuplicates} duplicate${result.skippedDuplicates === 1 ? '' : 's'} skipped`);
      if (result.droppedOverCap > 0) parts.push(`${result.droppedOverCap} over the cap dropped`);
      toast(parts.join(' — '), result.added > 0 ? 'success' : 'info');
    };
    reader.readAsText(file);
  };

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
  const visibleSaved = savedEvents.filter(
    (e) =>
      tq === '' || `${e.label} ${e.description ?? ''} ${e.category}`.toLowerCase().includes(tq),
  );

  // Same insertion rule as templates: blank id, author picks the trigger.
  const insertSaved = (entry: SavedEvent) =>
    addPreset({
      label: entry.label,
      description: entry.description,
      category: entry.category,
      effects: structuredClone(entry.effects),
    });

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
      <p className="text-xs text-faint">
        Presets only set up structure — you type every clinical value. Recovery pre-fills your
        baseline vitals; edit or blank any you don’t want to change.
      </p>
    </div>
  );

  const templatePanel = showTemplates && (
    <div className="space-y-2 rounded bg-panel-2 p-3">
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
      <p className="text-xs text-faint">
        Templates copy reviewed vital values from the bundled scenarios (source shown per
        template) — verify them for your patient and baseline. The inserted event needs an id,
        and you choose its trigger.
      </p>
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-faint">
            My events
          </span>
          {savedEvents.length > 0 && (
            <button
              className="btn-ghost !px-2 !py-0.5 text-xs"
              onClick={() => downloadJson('capno-events.library.json', serializeLibraryFile(savedEvents))}
            >
              ⬇ Export
            </button>
          )}
          <button
            className="btn-ghost !px-2 !py-0.5 text-xs"
            onClick={() => libraryFileInput.current?.click()}
          >
            ⬆ Import
          </button>
          <input
            ref={libraryFileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importLibraryFile(f);
              e.target.value = '';
            }}
          />
        </div>
        {savedEvents.length === 0 ? (
          <p className="text-xs text-faint">
            No saved events yet — use ☆ Save to library on any event, or import a library file.
          </p>
        ) : (
          <ul className="space-y-1">
            {visibleSaved.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center gap-2 rounded bg-panel/60 px-2 py-1.5 ring-1 ring-line"
              >
                <span
                  className={`inline-block h-2 w-2 shrink-0 rounded-full ${CATEGORY_DOT[entry.category]}`}
                  title={entry.category}
                />
                <span className="text-sm font-semibold text-ink">{entry.label}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-faint" title={entry.description}>
                  {entry.effects.length === 0 ? 'log only' : entry.effects.map(effectSummary).join(' | ')}
                </span>
                <span className="text-[10px] text-faint">
                  saved {new Date(entry.savedAtIso).toLocaleDateString()}
                </span>
                <button className="btn-secondary !px-2 !py-1 text-xs" onClick={() => insertSaved(entry)}>
                  Insert
                </button>
                <button
                  className="btn-ghost !px-2 !py-1 text-xs text-red"
                  onClick={() => removeFromLibrary(entry)}
                  aria-label={`delete ${entry.label} from library`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {TEMPLATE_KINDS.map(({ kind, title }) => {
        const items = visibleTemplates.filter((t) => t.kind === kind);
        if (items.length === 0) return null;
        return (
          <div key={kind} className="space-y-1">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-faint">
              {title}
            </span>
            <ul className="space-y-1">
              {items.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center gap-2 rounded bg-panel/60 px-2 py-1.5 ring-1 ring-line"
                >
                  <span
                    className={`inline-block h-2 w-2 shrink-0 rounded-full ${CATEGORY_DOT[t.category]}`}
                    title={t.category}
                  />
                  <span className="text-sm font-semibold text-ink">{t.label}</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-faint" title={t.description}>
                    {t.effects.length === 0 ? 'log only' : t.effects.map(effectSummary).join(' | ')}
                  </span>
                  <span className="text-[10px] text-faint">{t.source}</span>
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
        <p className="text-xs text-faint">No templates match “{templateFilter}”.</p>
      )}
    </div>
  );

  if (events.length === 0) {
    return (
      <div className="space-y-2">
        <div className="space-y-1 rounded bg-panel-2 p-3 text-xs text-muted">
          <p className="font-semibold text-ink-2">No events yet — events are the script of the case.</p>
          <p>
            <span className="text-amber-strong">Automatic</span> events fire on a timer and drive the
            scripted deterioration. <span className="text-ink-2">Faculty-fired</span> events are
            responses the instructor triggers when learners act (drug given, airway secured).{' '}
            <span className="text-ink-2">Marker</span> events change nothing — they just write a
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
              ? 'bg-panel-2 text-ink'
              : 'text-ink-2 hover:bg-panel-2'
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
              <span className="rounded bg-blue-soft px-1 py-px font-semibold tracking-wider text-blue ring-1 ring-blue/30">
                AUTO {fmtTime(event.autoAtSec)}
              </span>
            ) : (
              <span className="rounded bg-panel px-1 py-px font-semibold tracking-wider text-muted ring-1 ring-line">
                FACULTY
              </span>
            )}
            <span className="text-faint">
              {event.effects.length} effect{event.effects.length === 1 ? '' : 's'}
            </span>
            {warningCount > 0 && (
              <span className="rounded bg-amber-soft px-1 py-px font-semibold text-amber-strong ring-1 ring-amber/40">
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
            className="divide-y divide-line overflow-hidden rounded bg-panel/40 ring-1 ring-line"
          >
            {phaseGrouped
              ? groups.map((g) => (
                  <li key={g.key}>
                    <div className="label !mb-0 px-2 pb-1 pt-2">
                      {g.title}{' '}
                      <span className="font-normal normal-case text-faint">
                        ({g.indices.length} · {g.indices.filter((i) => events[i].autoAtSec !== undefined).length} auto)
                      </span>
                    </div>
                    <ul role="list" className="divide-y divide-line">
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
              onSaveToLibrary={() => saveToLibrary(events[selected])}
            />
          )}
        </div>
      </div>
      {templatePanel}
    </div>
  );
}
