'use client';

import { useEffect, useRef, useState } from 'react';
import { ACTION_LEGEND, ActionMarkRow } from '@/components/controller/ActionMarkRow';
import { CATEGORY_DOT, CATEGORY_STYLES } from '@/components/eventCategories';
import { nextUnfiredEvent } from '@/lib/engine/flow';
import type { ExpectedAction, ScenarioEvent } from '@/lib/engine/types';
import { useControllerStore } from '@/lib/store/controllerStore';

const IMMINENT_SEC = 30;

function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * The case flow: every scenario event as a card in author (narrative) order,
 * with the fire button and the expected learner actions linked to that event
 * (event.actionIds) marked right underneath — one place to run the sequence
 * instead of hunting between an event grid and a separate checklist. Actions
 * no event links appear in "Other learner actions" below, grouped by phase.
 *
 * The first unfired event is highlighted as "Next up". "Critical only" trims
 * actions (never events) to critical ones with larger, labelled tap targets;
 * it arms itself once when the scenario first starts running.
 */
export function FlowPanel() {
  const { engine, snapshot, triggerEvent, markAction } = useControllerStore();
  const [filter, setFilter] = useState('');
  const [flashId, setFlashId] = useState<string | null>(null);
  const [criticalOnly, setCriticalOnly] = useState(false);
  const autoArmed = useRef(false);
  const filterRef = useRef<HTMLInputElement | null>(null);
  const running = snapshot?.status === 'running';

  useEffect(() => {
    if (running && !autoArmed.current) {
      autoArmed.current = true;
      setCriticalOnly(true);
    }
  }, [running]);

  // "/" jumps to the flow filter from anywhere on the run screen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (target?.isContentEditable) return;
      e.preventDefault();
      filterRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!engine || !snapshot) return null;

  const scenario = engine.scenario;
  const fired = new Set(snapshot.firedEventIds);
  const actionsById = new Map(scenario.expectedActions.map((a) => [a.id, a]));
  const recordFor = (id: string) => snapshot.actions.find((a) => a.actionId === id);
  const next = nextUnfiredEvent(scenario.events, fired);

  const fire = (id: string) => {
    triggerEvent(id);
    setFlashId(id);
    // Fallback clear: under reduced motion the animation (and its
    // animationend event) never runs.
    setTimeout(() => setFlashId((cur) => (cur === id ? null : cur)), 400);
  };

  const q = filter.trim().toLowerCase();
  const eventMatches = (ev: ScenarioEvent) =>
    !q ||
    ev.label.toLowerCase().includes(q) ||
    ev.description?.toLowerCase().includes(q) ||
    (ev.actionIds ?? []).some((id) =>
      actionsById.get(id)?.label.toLowerCase().includes(q),
    );
  const visibleEvents = scenario.events.filter(eventMatches);

  const linkedActions = (ev: ScenarioEvent): ExpectedAction[] =>
    (ev.actionIds ?? [])
      .map((id) => actionsById.get(id))
      .filter((a): a is ExpectedAction => a !== undefined && (!criticalOnly || a.critical));

  // Actions no event claims: the general checklist, grouped by phase.
  const claimed = new Set(scenario.events.flatMap((e) => e.actionIds ?? []));
  const actionVisible = (a: ExpectedAction) =>
    !claimed.has(a.id) &&
    (!criticalOnly || a.critical) &&
    (!q || a.label.toLowerCase().includes(q));
  const otherGroups = scenario.phases
    .map((phase) => ({
      phase,
      actions: scenario.expectedActions.filter((a) => a.phase === phase.id && actionVisible(a)),
    }))
    .filter((g) => g.actions.length > 0);
  const otherUngrouped = scenario.expectedActions.filter((a) => !a.phase && actionVisible(a));
  if (otherUngrouped.length > 0) {
    otherGroups.push({ phase: { id: '_other', label: 'Any phase' }, actions: otherUngrouped });
  }
  const hiddenCount = criticalOnly
    ? scenario.expectedActions.filter((a) => !a.critical).length
    : 0;

  const timingHint = (ev: ScenarioEvent) => {
    if (fired.has(ev.id)) return null;
    if (ev.autoAtSec === undefined) {
      return (
        <span className="font-mono text-[10px] text-slate-500">
          {ev.phaseHint ? `when ready · ${ev.phaseHint}` : 'when ready'}
        </span>
      );
    }
    if (!snapshot.autoEventsEnabled) {
      return (
        <span className="font-mono text-[10px] text-slate-500">
          suggested ~{clock(ev.autoAtSec)}
        </span>
      );
    }
    const remaining = ev.autoAtSec - snapshot.elapsedSec;
    const imminent = running && remaining <= IMMINENT_SEC;
    return (
      <span className={`font-mono text-[10px] ${imminent ? 'text-amber-300' : 'text-sky-400'}`}>
        {running ? `auto in ${clock(remaining)}` : `auto at ${clock(ev.autoAtSec)}`}
      </span>
    );
  };

  const eventCard = (ev: ScenarioEvent) => {
    const isNext = next?.id === ev.id;
    const actions = linkedActions(ev);
    const imminent =
      snapshot.autoEventsEnabled &&
      running &&
      ev.autoAtSec !== undefined &&
      !fired.has(ev.id) &&
      ev.autoAtSec - snapshot.elapsedSec <= IMMINENT_SEC;
    return (
      <div
        key={ev.id}
        className={`space-y-1.5 rounded-md p-1.5 ring-1 ${
          isNext
            ? 'bg-slate-900 ring-2 ring-sky-500'
            : imminent
              ? 'bg-amber-950/40 ring-amber-600'
              : 'bg-slate-900/60 ring-slate-800'
        }`}
      >
        <button
          onClick={() => fire(ev.id)}
          onAnimationEnd={() => setFlashId((cur) => (cur === ev.id ? null : cur))}
          title={ev.description}
          className={`w-full rounded-md px-2.5 py-2 text-left text-xs font-semibold ring-1 transition ${
            CATEGORY_STYLES[ev.category]
          } ${fired.has(ev.id) ? 'bg-slate-800/80 text-slate-500' : 'bg-slate-900 text-slate-200'} ${
            flashId === ev.id ? 'motion-safe:animate-event-fire' : ''
          }`}
        >
          <span className="flex items-center justify-between gap-1">
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${CATEGORY_DOT[ev.category]}`}
              />
              <span className="truncate">{ev.label}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              {isNext && (
                <span className="rounded bg-sky-600 px-1 py-0.5 text-[9px] font-bold uppercase text-white">
                  Next up
                </span>
              )}
              {fired.has(ev.id) && <span title="already fired">✓</span>}
            </span>
          </span>
          {timingHint(ev) && <span className="mt-0.5 block">{timingHint(ev)}</span>}
        </button>
        {actions.length > 0 && (
          <ul className="space-y-1">
            {actions.map((a) => (
              <ActionMarkRow
                key={a.id}
                action={a}
                record={recordFor(a.id)}
                large={criticalOnly}
                onMark={(status) => markAction(a.id, status)}
              />
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <section className="card space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
          Flow
          <span className="ml-2 font-normal normal-case text-slate-600">
            {fired.size}/{scenario.events.length} fired
          </span>
        </h2>
        <button
          className={`rounded px-2 py-1 text-xs font-semibold transition ${
            criticalOnly
              ? 'bg-red-900/60 text-red-300 ring-1 ring-red-700'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
          onClick={() => setCriticalOnly(!criticalOnly)}
          aria-pressed={criticalOnly}
        >
          ● Critical only
        </button>
      </div>
      {scenario.events.length > 8 && (
        <input
          ref={filterRef}
          className="input"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter events and actions… ( / )"
          aria-label="Filter events and actions"
        />
      )}

      <div className="space-y-1.5">
        {visibleEvents.map(eventCard)}
        {visibleEvents.length === 0 && (
          <p className="text-xs text-slate-500">No events match “{filter}”.</p>
        )}
      </div>

      {otherGroups.length > 0 && (
        <div className="space-y-3 border-t border-slate-800 pt-2">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Other learner actions
          </h3>
          {otherGroups.map(({ phase, actions }) => (
            <div key={phase.id}>
              <h4
                className={`mb-1 text-[11px] font-bold uppercase tracking-wider ${
                  phase.id === snapshot.phaseId ? 'text-sky-400' : 'text-slate-500'
                }`}
              >
                {phase.label}
                {phase.id === snapshot.phaseId && ' · current'}
              </h4>
              <ul className="space-y-1">
                {actions.map((a) => (
                  <ActionMarkRow
                    key={a.id}
                    action={a}
                    record={recordFor(a.id)}
                    large={criticalOnly}
                    onMark={(status) => markAction(a.id, status)}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {hiddenCount > 0 && (
        <button
          className="text-xs text-sky-400 hover:text-sky-300"
          onClick={() => setCriticalOnly(false)}
        >
          {hiddenCount} non-critical action{hiddenCount === 1 ? '' : 's'} hidden — show all
        </button>
      )}
      <p className="text-[10px] text-slate-500">
        Events can be re-fired; hover/long-press for details. {ACTION_LEGEND}
      </p>
    </section>
  );
}
