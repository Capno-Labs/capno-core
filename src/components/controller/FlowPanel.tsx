'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ACTION_LEGEND,
  ActionMarkRow,
  STATUS_GLYPH,
  STATUS_TEXT,
} from '@/components/controller/ActionMarkRow';
import { AddEventForm } from '@/components/controller/AddEventForm';
import { CATEGORY_DOT } from '@/components/eventCategories';
import { Icon } from '@/components/ui/Icon';
import {
  flowCardState,
  flowProgressPhaseIndex,
  nextUnfiredEvent,
  phaseHintLabel,
  type FlowCardState,
} from '@/lib/engine/flow';
import type { ActionStatus, ExpectedAction, ScenarioEvent } from '@/lib/engine/types';
import { formatClock } from '@/lib/format';
import { useKeyboardShortcuts } from '@/lib/hooks/useKeyboardShortcuts';
import { payloadFromEvent } from '@/lib/scenarios/eventLibrary';
import { saveEventToLibrary } from '@/lib/scenarios/eventLibraryStore';
import { useControllerStore } from '@/lib/store/controllerStore';
import { toast } from '@/lib/store/toastStore';

const IMMINENT_SEC = 30;
/** A card that was just fired or marked keeps its size this long. */
const HOLD_MS = 2000;
/** Pointer fires closer together than this are one tap landing twice. */
const FIRE_LOCKOUT_MS = 400;

const HEADER_TOGGLE = (on: boolean, tone: 'brand' | 'red' = 'brand') =>
  `rounded-ctl px-2 py-1 text-xs font-semibold transition ${
    on
      ? tone === 'red'
        ? 'bg-red-soft text-red ring-1 ring-red/40'
        : 'bg-brand-soft text-brand-strong ring-1 ring-brand/30'
      : 'bg-panel-2 text-muted hover:bg-panel-3'
  }`;

const SMALL_LINK = 'text-[10px] font-semibold text-faint hover:text-brand-strong';

/** Disclosure chevron: points down when open, right when closed. */
function Chevron({ open }: { open: boolean }) {
  return (
    <Icon
      name="chevron-down"
      size={13}
      className={`text-faint transition-transform duration-150 ${open ? '' : '-rotate-90'}`}
    />
  );
}

/**
 * The case flow: the scenario's events in author (narrative) order, each
 * with the expected learner actions linked to it (event.actionIds) — one
 * place to run the sequence and mark the response.
 *
 * The rail reads as done / now / later (see flowCardState):
 * - a fired event whose actions are all marked folds to one line — tap it to
 *   reopen (its actions, and "Fire again");
 * - a fired event with actions still to mark stays open;
 * - the next event is the large card, and the one the N key fires. A
 *   per-card "make next" points it at a different unfired event;
 * - every other event is a one-line row that still fires on a tap, so the
 *   case can be run out of order.
 * "Show all" opens every card (it is on until the session first runs, for
 * reading the case through); a filter opens whatever it matches. When an
 * event fires — by tap, the N key or its auto timer — the rail scrolls to
 * keep it and the new next event in view.
 *
 * Actions no event links sit in "Also watch for", grouped by phase; a group
 * opens once the case has reached its phase. "Critical only" trims actions
 * (never events) to critical ones with larger, labelled tap targets; it arms
 * itself once when the scenario first starts running. "+ Add event"
 * improvises a session-only event (see AddEventForm).
 *
 * In the viewport-fit cockpit the header and legend stay put and the list
 * between them scrolls; otherwise the panel is as tall as its content.
 */
export function FlowPanel() {
  const { engine, snapshot, triggerEvent, markAction, pinNextEvent } = useControllerStore();
  const [filter, setFilter] = useState('');
  const [flashId, setFlashId] = useState<string | null>(null);
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [showAll, setShowAll] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  // Instructor's own open/closed choice per card or group; wins over the default.
  const [openOverride, setOpenOverride] = useState<Record<string, boolean>>({});
  // Cards held open after a fire or a mark: id → expiry (ms).
  const [held, setHeld] = useState<Record<string, number>>({});
  const autoArmed = useRef(false);
  const filterRef = useRef<HTMLInputElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const prevFired = useRef<Set<string> | null>(null);
  const lastFireAt = useRef(0);
  const addFormOpen = useRef(false);
  addFormOpen.current = showAddForm;
  const running = snapshot?.status === 'running';

  // First run: trim to the critical actions and fold the read-through view.
  useEffect(() => {
    if (running && !autoArmed.current) {
      autoArmed.current = true;
      setCriticalOnly(true);
      setShowAll(false);
    }
  }, [running]);

  // "/" jumps to the flow filter from anywhere on the run screen, with the
  // same guards as every other shortcut.
  useKeyboardShortcuts({ '/': () => filterRef.current?.focus() });

  const hold = useCallback((id: string) => {
    const until = Date.now() + HOLD_MS;
    setHeld((h) => ({ ...h, [id]: until }));
    window.setTimeout(() => {
      setHeld((h) => {
        if (h[id] !== until) return h;
        const rest = { ...h };
        delete rest[id];
        return rest;
      });
    }, HOLD_MS);
  }, []);

  // Keep the just-fired card and the new next-up card in view. Scrolls the
  // rail's own box only (never the page), and stays out of the way while the
  // instructor is typing in the rail or adding an event.
  const follow = useCallback((firedId: string) => {
    requestAnimationFrame(() => {
      const box = bodyRef.current;
      if (!box || box.scrollHeight <= box.clientHeight + 1) return;
      if (addFormOpen.current) return;
      const active = document.activeElement;
      if (active instanceof HTMLInputElement && box.closest('section')?.contains(active)) return;
      const firedCard = box.querySelector<HTMLElement>(`[data-flow-card="${CSS.escape(firedId)}"]`);
      if (!firedCard) return;
      const nextCard = box.querySelector<HTMLElement>('[data-flow-state="next"]');
      const boxTop = box.getBoundingClientRect().top;
      // Positions in the scroll content's own coordinates.
      const span = (el: HTMLElement) => {
        const r = el.getBoundingClientRect();
        const top = r.top - boxTop + box.scrollTop;
        return { top, bottom: top + r.height };
      };
      const a = span(firedCard);
      const b = nextCard ? span(nextCard) : a;
      const pad = 8;
      let top = Math.min(a.top, b.top) - pad;
      let bottom = Math.max(a.bottom, b.bottom) + pad;
      if (bottom - top > box.clientHeight) {
        // Both don't fit: the fired card (whose actions need marking) wins.
        top = a.top - pad;
        bottom = top + box.clientHeight;
      }
      let target = box.scrollTop;
      if (top < target) target = top;
      else if (bottom > target + box.clientHeight) target = bottom - box.clientHeight;
      if (Math.abs(target - box.scrollTop) < 1) return;
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      box.scrollTo({ top: Math.max(0, target), behavior: reduced ? 'auto' : 'smooth' });
    });
  }, []);

  // Every way an event fires (a tap, the N key, an auto timer) lands in
  // snapshot.firedEventIds, so the flash, the hold and the follow-along key
  // off that rather than off the tap handler.
  const firedKey = snapshot?.firedEventIds.join('\n') ?? '';
  useEffect(() => {
    const now = new Set(firedKey ? firedKey.split('\n') : []);
    const prev = prevFired.current;
    prevFired.current = now;
    if (!prev) return;
    if (now.size < prev.size) {
      // Reset: start the next run from the default view.
      setOpenOverride({});
      return;
    }
    const fresh = [...now].filter((id) => !prev.has(id));
    const id = fresh[fresh.length - 1];
    if (id === undefined) return;
    setFlashId(id);
    // Fallback clear: under reduced motion the animation (and its
    // animationend event) never runs.
    window.setTimeout(() => setFlashId((cur) => (cur === id ? null : cur)), 400);
    hold(id);
    follow(id);
  }, [firedKey, hold, follow]);

  if (!engine || !snapshot) return null;

  const scenario = engine.scenario;
  // The working event list (authored + live-added); the authored set marks
  // which cards get the "added live" chip.
  const events = engine.getEvents();
  const authoredIds = new Set(scenario.events.map((e) => e.id));
  const pinned = engine.getPinnedNextEventId();
  const fired = new Set(snapshot.firedEventIds);
  const actionsById = new Map(scenario.expectedActions.map((a) => [a.id, a]));
  const recordFor = (id: string) => snapshot.actions.find((a) => a.actionId === id);
  const statusOf = (id: string): ActionStatus => recordFor(id)?.status ?? 'pending';
  const next = nextUnfiredEvent(events, fired, pinned);

  const fire = (id: string) => {
    // A second tap arriving as the list re-flows must not fire whatever card
    // slid under the pointer.
    const now = performance.now();
    if (now - lastFireAt.current < FIRE_LOCKOUT_MS) return;
    lastFireAt.current = now;
    triggerEvent(id);
  };

  const q = filter.trim().toLowerCase();
  const eventMatches = (ev: ScenarioEvent) =>
    !q ||
    ev.label.toLowerCase().includes(q) ||
    ev.description?.toLowerCase().includes(q) ||
    (ev.actionIds ?? []).some((id) => actionsById.get(id)?.label.toLowerCase().includes(q));
  const visibleEvents = events.filter(eventMatches);
  // The "Next up" card is pinned even when the filter would hide it — the N
  // hotkey fires it, so it must never be invisible.
  const listed =
    next && !visibleEvents.some((ev) => ev.id === next.id) ? [next, ...visibleEvents] : visibleEvents;

  const linkedActions = (ev: ScenarioEvent): ExpectedAction[] =>
    (ev.actionIds ?? [])
      .map((id) => actionsById.get(id))
      .filter((a): a is ExpectedAction => a !== undefined && (!criticalOnly || a.critical));

  // Actions no event claims: the general checklist, grouped by phase.
  const claimed = new Set(events.flatMap((e) => e.actionIds ?? []));
  const actionVisible = (a: ExpectedAction) =>
    !claimed.has(a.id) && (!criticalOnly || a.critical) && (!q || a.label.toLowerCase().includes(q));
  const otherGroups = scenario.phases
    .map((phase, index) => ({
      phase,
      index,
      actions: scenario.expectedActions.filter((a) => a.phase === phase.id && actionVisible(a)),
    }))
    .filter((g) => g.actions.length > 0);
  const otherUngrouped = scenario.expectedActions.filter((a) => !a.phase && actionVisible(a));
  if (otherUngrouped.length > 0) {
    otherGroups.push({ phase: { id: '_other', label: 'Any phase' }, index: -1, actions: otherUngrouped });
  }
  const hiddenCount = criticalOnly ? scenario.expectedActions.filter((a) => !a.critical).length : 0;
  const progressIndex = flowProgressPhaseIndex(scenario.phases, snapshot.phaseId, events, fired, next);

  const isOpen = (id: string, byDefault: boolean) =>
    showAll || q !== '' || (openOverride[id] ?? ((held[id] ?? 0) > 0 || byDefault));
  const toggle = (id: string, currentlyOpen: boolean) =>
    setOpenOverride((o) => ({ ...o, [id]: !currentlyOpen }));

  // One computation per card feeds both the timing text and the orange
  // "about to fire" treatment, so they can never disagree. A past-due unfired
  // auto will never auto-fire (the engine schedules only future events when
  // the toggle flips on mid-run), so it shows as a suggestion, not a countdown.
  const timing = (ev: ScenarioEvent): { long: string; short: string | null; imminent: boolean } => {
    if (ev.autoAtSec === undefined) return { long: 'when ready', short: null, imminent: false };
    const remaining = ev.autoAtSec - snapshot.elapsedSec;
    if (!snapshot.autoEventsEnabled || remaining <= 0) {
      const at = formatClock(ev.autoAtSec);
      return { long: `suggested ~${at}`, short: `~${at}`, imminent: false };
    }
    if (!running) {
      const at = formatClock(ev.autoAtSec);
      return { long: `auto at ${at}`, short: `auto ${at}`, imminent: false };
    }
    const left = formatClock(remaining);
    return { long: `auto in ${left}`, short: `auto ${left}`, imminent: remaining <= IMMINENT_SEC };
  };

  const actionList = (cardId: string, actions: ExpectedAction[]) => (
    <ul className="space-y-1">
      {actions.map((a) => (
        <ActionMarkRow
          key={a.id}
          action={a}
          record={recordFor(a.id)}
          large={criticalOnly}
          onMark={(status) => {
            markAction(a.id, status);
            // Marking the last pending action would fold the card at once;
            // hold it so the row stays under the finger.
            hold(cardId);
          }}
        />
      ))}
    </ul>
  );

  const addedLive = (
    <span
      className="shrink-0 rounded-ctl bg-violet-soft px-1 py-0.5 text-[9px] font-bold uppercase text-violet ring-1 ring-violet/40"
      title="Improvised during this session — not part of the authored scenario"
    >
      added live
    </span>
  );

  const dot = (ev: ScenarioEvent) => (
    <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${CATEGORY_DOT[ev.category]}`} />
  );

  const eventCard = (ev: ScenarioEvent) => {
    const isFired = fired.has(ev.id);
    const isPinned = pinned === ev.id;
    const adhoc = !authoredIds.has(ev.id);
    const actions = linkedActions(ev);
    const pending = actions.filter((a) => statusOf(a.id) === 'pending').length;
    const state: FlowCardState = flowCardState({
      fired: isFired,
      isNext: next?.id === ev.id,
      pendingActions: pending,
    });
    const t = timing(ev);
    const imminent = !isFired && t.imminent;
    const open = isOpen(ev.id, state === 'watching' || state === 'next');
    const flash = flashId === ev.id ? 'motion-safe:animate-event-fire' : '';

    // Improvised events that worked well can be kept for reuse in other
    // scenarios. Authored events are saved from the case editor instead.
    const saveControl = adhoc && (
      <button
        className={SMALL_LINK}
        title="Save this improvised event to your personal library"
        onClick={() => {
          const result = saveEventToLibrary(payloadFromEvent(ev));
          toast(
            result.ok ? `Saved “${ev.label}” to your event library` : result.error,
            result.ok ? 'success' : result.duplicate ? 'info' : 'error',
          );
        }}
      >
        ☆ save
      </button>
    );

    const frame =
      state === 'next'
        ? imminent
          ? 'bg-warn-soft ring-2 ring-warn'
          : 'bg-panel-2 ring-2 ring-brand'
        : imminent
          ? 'bg-warn-soft ring-1 ring-warn/40'
          : state === 'done' && !open
            ? ''
            : 'bg-panel-2/50 ring-1 ring-line';

    let header: ReactNode;
    if (isFired) {
      // Fired: the header opens and closes the card. Firing again is a
      // separate button inside, so a tap on a small row can't repeat a
      // deterioration.
      header = (
        <button
          type="button"
          className={`flex w-full items-center gap-2 rounded-ctl px-2.5 py-1.5 text-left text-xs font-semibold hover:bg-panel-2 ${
            state === 'watching' ? 'text-ink' : 'text-muted'
          }`}
          aria-expanded={open}
          onClick={() => toggle(ev.id, open)}
        >
          <span className="w-3 shrink-0 text-center text-faint" title="fired">
            ✓
          </span>
          <span className="min-w-0 flex-1 truncate">{ev.label}</span>
          {adhoc && addedLive}
          {actions.length > 0 && (
            <span className="flex shrink-0 gap-1 text-[11px]" aria-hidden>
              {actions.map((a) => (
                <span key={a.id} className={STATUS_TEXT[statusOf(a.id)]}>
                  {STATUS_GLYPH[statusOf(a.id)]}
                </span>
              ))}
            </span>
          )}
          <Chevron open={open} />
        </button>
      );
    } else if (state === 'next') {
      header = (
        <button
          type="button"
          onClick={() => fire(ev.id)}
          title={ev.description}
          className="w-full rounded-ctl px-2.5 py-2 text-left hover:bg-panel-3/60"
        >
          <span className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.11em] text-brand-strong">
              Next up
            </span>
            <span className="flex items-center gap-1.5">
              {adhoc && addedLive}
              <kbd
                className="rounded-ctl bg-brand px-1.5 py-0.5 font-mono text-[10px] font-bold text-on-brand"
                title="Press N to fire this event"
              >
                N
              </kbd>
            </span>
          </span>
          <span className="mt-1 flex items-start gap-2">
            <span className="mt-[7px] flex">{dot(ev)}</span>
            <span className="min-w-0 text-sm font-bold leading-snug text-ink">{ev.label}</span>
          </span>
          {/* iOS never shows the hover title, so the one event faculty need
              context for right now carries its description. No `block` on
              the span: line-clamp needs its display:-webkit-box to survive
              the cascade or the clamp is inert. */}
          {ev.description && (
            <span className="line-clamp-3 mt-1 text-xs font-normal leading-snug text-muted">
              {ev.description}
            </span>
          )}
          <span
            className={`mt-1 block font-mono text-[10px] ${imminent ? 'font-bold text-warn-strong' : 'text-faint'}`}
          >
            {t.long}
          </span>
        </button>
      );
    } else {
      header = (
        <div className="flex items-center gap-1 pr-1.5">
          <button
            type="button"
            onClick={() => fire(ev.id)}
            title={ev.description}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-ctl px-2.5 py-2 text-left text-xs font-semibold text-ink hover:bg-panel-3/60"
          >
            {dot(ev)}
            <span className="min-w-0 flex-1 truncate">{ev.label}</span>
            {adhoc && addedLive}
            {t.short && (
              <span
                className={`shrink-0 font-mono text-[10px] font-normal ${imminent ? 'font-bold text-warn-strong' : 'text-faint'}`}
              >
                {t.short}
              </span>
            )}
          </button>
          {(actions.length > 0 || ev.description) && (
            <button
              type="button"
              className="flex shrink-0 items-center gap-0.5 rounded-ctl px-1.5 py-1 text-[10px] font-semibold text-faint hover:bg-panel-3 hover:text-ink-2"
              aria-expanded={open}
              aria-label={`${open ? 'Hide' : 'Show'} details for ${ev.label}`}
              title={open ? 'Hide details' : 'Show the description and expected actions'}
              onClick={() => toggle(ev.id, open)}
            >
              {actions.length > 0 && <span className="tabular-nums">{actions.length}</span>}
              <Chevron open={open} />
            </button>
          )}
          <button
            type="button"
            className="shrink-0 rounded-ctl px-1.5 py-1 text-xs text-faint hover:bg-panel-3 hover:text-brand-strong"
            aria-label={`Make ${ev.label} the next event`}
            title="Make next — the N key will fire this event"
            onClick={() => pinNextEvent(ev.id)}
          >
            ⤒
          </button>
        </div>
      );
    }

    const controls: ReactNode[] = [];
    if (saveControl) controls.push(<span key="save">{saveControl}</span>);
    if (state === 'next' && isPinned) {
      controls.push(
        <button key="unpin" className={SMALL_LINK} onClick={() => pinNextEvent(null)}>
          ⤫ unpin
        </button>,
      );
    }
    if (isFired) {
      controls.push(
        <button
          key="refire"
          type="button"
          className="rounded-ctl bg-panel-3 px-2 py-1 text-[11px] font-semibold text-ink-2 hover:bg-line-2 hover:text-ink"
          title={`Fire “${ev.label}” again`}
          onClick={() => fire(ev.id)}
        >
          ↻ Fire again
        </button>,
      );
    }

    // The next card's description is already in its header.
    const hasBody =
      actions.length > 0 || controls.length > 0 || (state !== 'next' && !!ev.description);

    return (
      <div
        key={ev.id}
        data-flow-card={ev.id}
        data-flow-state={state}
        onAnimationEnd={() => setFlashId((cur) => (cur === ev.id ? null : cur))}
        className={`rounded-ctl ${frame} ${flash}`}
      >
        {header}
        {open && hasBody && (
          <div className="space-y-1.5 px-1.5 pb-1.5">
            {state === 'upcoming' && ev.description && (
              <p className="px-1 text-xs leading-snug text-muted">{ev.description}</p>
            )}
            {isFired && ev.description && actions.length === 0 && (
              <p className="px-1 text-xs leading-snug text-faint">{ev.description}</p>
            )}
            {actions.length > 0 && actionList(ev.id, actions)}
            {controls.length > 0 && (
              <div className="flex items-center justify-end gap-3 px-1">{controls}</div>
            )}
          </div>
        )}
      </div>
    );
  };

  // A phase caption wherever the events move into a different phase — a
  // reading aid only: the cards stay in author order.
  const rows: ReactNode[] = [];
  let lastPhase: string | undefined;
  for (const ev of listed) {
    const label = phaseHintLabel(scenario.phases, ev.phaseHint);
    if (label !== undefined && label !== lastPhase) {
      const current = ev.phaseHint === snapshot.phaseId;
      rows.push(
        <p
          key={`phase-${ev.id}`}
          className={`px-1 pt-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] ${
            current ? 'text-brand-strong' : 'text-faint'
          }`}
        >
          {label}
          {current && ' · current'}
        </p>,
      );
    }
    lastPhase = label ?? lastPhase;
    rows.push(eventCard(ev));
  }

  return (
    <section className="card flex flex-col gap-2 fit:h-full fit:min-h-0" data-tour="flow">
      <div className="flex items-center justify-between gap-2">
        <h2 className="whitespace-nowrap text-sm font-bold uppercase tracking-wider text-muted">
          Flow
          <span
            className="ml-2 font-normal normal-case tabular-nums text-faint"
            title={`${fired.size} of ${events.length} events fired`}
          >
            {fired.size}/{events.length}
            <span className="hidden min-[1560px]:inline"> fired</span>
          </span>
        </h2>
        <div className="flex items-center gap-2 whitespace-nowrap">
          <button
            className={HEADER_TOGGLE(showAddForm)}
            onClick={() => {
              setShowAddForm(!showAddForm);
              bodyRef.current?.scrollTo({ top: 0 });
            }}
            aria-pressed={showAddForm}
            aria-expanded={showAddForm}
          >
            + Add event
          </button>
          <button
            className={HEADER_TOGGLE(criticalOnly, 'red')}
            onClick={() => setCriticalOnly(!criticalOnly)}
            aria-pressed={criticalOnly}
          >
            ● Critical only
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {events.length > 8 && (
          <input
            ref={filterRef}
            className="input"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter events and actions… ( / )"
            aria-label="Filter events and actions"
          />
        )}
        {events.length > 0 && (
          <button
            className={`ml-auto shrink-0 ${HEADER_TOGGLE(showAll)}`}
            onClick={() => setShowAll(!showAll)}
            aria-pressed={showAll}
            title="Open every event to read its description and expected actions"
          >
            Show all
          </button>
        )}
      </div>

      {/* The scrolling list. The padding/negative margin pair keeps the
          cards' rings from being clipped by the scroll box. */}
      <div
        ref={bodyRef}
        className="space-y-1.5 fit:-m-0.5 fit:min-h-0 fit:flex-1 fit:overflow-y-auto fit:overscroll-contain fit:p-0.5"
      >
        {/* Inside the scrolling list, so its buttons are always reachable. */}
        {showAddForm && <AddEventForm onDone={() => setShowAddForm(false)} />}
        {rows}
        {events.length === 0 && (
          <p className="text-xs text-faint">
            This case has no scripted events. Drive it from the vitals, or improvise one with
            “+ Add event”.
          </p>
        )}
        {events.length > 0 && visibleEvents.length === 0 && !next && (
          <p className="text-xs text-faint">No events match “{filter}”.</p>
        )}

        {otherGroups.length > 0 && (
          <div className="space-y-1.5 border-t border-line pt-2">
            <h3 className="px-1 text-[11px] font-bold uppercase tracking-wider text-muted">
              Also watch for
            </h3>
            {otherGroups.map(({ phase, index, actions }) => {
              const groupId = `group:${phase.id}`;
              const pending = actions.filter((a) => statusOf(a.id) === 'pending').length;
              const reached = index < 0 || index <= progressIndex;
              const open = isOpen(groupId, criticalOnly || (reached && pending > 0));
              const current = phase.id === snapshot.phaseId;
              return (
                <div key={phase.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-ctl px-1 py-1 text-left hover:bg-panel-2"
                    aria-expanded={open}
                    onClick={() => toggle(groupId, open)}
                  >
                    <span
                      className={`min-w-0 flex-1 truncate font-mono text-[10px] font-semibold uppercase tracking-[0.14em] ${
                        current ? 'text-brand-strong' : 'text-faint'
                      }`}
                    >
                      {phase.label}
                      {current && ' · current'}
                    </span>
                    <span className="shrink-0 text-[10px] tabular-nums text-faint">
                      {pending > 0 ? `${pending} to mark` : 'marked'}
                    </span>
                    <Chevron open={open} />
                  </button>
                  {open && actionList(groupId, actions)}
                </div>
              );
            })}
          </div>
        )}

        {hiddenCount > 0 && (
          <button
            className="px-1 text-xs text-brand-strong hover:underline"
            onClick={() => setCriticalOnly(false)}
          >
            {hiddenCount} non-critical action{hiddenCount === 1 ? '' : 's'} hidden — show{' '}
            {hiddenCount === 1 ? 'it' : 'them'}
          </button>
        )}
      </div>

      <p
        className="truncate text-[10px] text-faint"
        title={`Tap an event to fire it; tap a fired event to reopen it. ${ACTION_LEGEND}`}
      >
        <kbd className="font-mono font-bold text-muted">N</kbd> fires next ·{' '}
        <span className="text-muted">⤒</span> make next ·{' '}
        {/* The labelled marks need no key. */}
        {criticalOnly ? '● critical action' : ACTION_LEGEND}
      </p>
    </section>
  );
}
