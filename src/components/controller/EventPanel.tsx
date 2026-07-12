'use client';

import { useEffect, useRef, useState } from 'react';
import { CATEGORIES, CATEGORY_DOT, CATEGORY_STYLES } from '@/components/eventCategories';
import type { ScenarioEvent } from '@/lib/engine/types';
import { useControllerStore } from '@/lib/store/controllerStore';

/** Above this many events the flat grid gets hard to scan mid-crisis. */
const GROUP_THRESHOLD = 10;

/** One-tap prebuilt scenario events, grouped for fast lab use. */
export function EventPanel() {
  const { engine, snapshot, triggerEvent } = useControllerStore();
  const [filter, setFilter] = useState('');
  const [flashId, setFlashId] = useState<string | null>(null);
  // Explicit collapse state (default: everything open) so re-renders from
  // the tick loop never snap a section shut under the operator's finger.
  const [closedGroups, setClosedGroups] = useState<Set<string>>(new Set());
  const filterRef = useRef<HTMLInputElement | null>(null);

  // "/" jumps to the event filter from anywhere on the run screen.
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

  const fire = (id: string) => {
    triggerEvent(id);
    setFlashId(id);
    // Fallback clear: under reduced motion the animation (and its
    // animationend event) never runs.
    setTimeout(() => setFlashId((cur) => (cur === id ? null : cur)), 400);
  };

  const fired = new Set(snapshot.firedEventIds);
  const events = engine.scenario.events;
  const q = filter.trim().toLowerCase();
  const visible = q
    ? events.filter(
        (ev) =>
          ev.label.toLowerCase().includes(q) || ev.description?.toLowerCase().includes(q),
      )
    : events;

  // Small scenarios keep the flat grid; filtering always flattens so no
  // match hides inside a collapsed section.
  const grouped = q === '' && events.length > GROUP_THRESHOLD;
  const sections = grouped
    ? CATEGORIES.flatMap((c) => {
        const items = visible.filter((ev) => ev.category === c);
        return items.length > 0 ? [{ category: c, items }] : [];
      })
    : [];

  const toggleGroup = (c: string) =>
    setClosedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });

  const eventButton = (ev: ScenarioEvent) => (
    <button
      key={ev.id}
      onClick={() => fire(ev.id)}
      onAnimationEnd={() => setFlashId((cur) => (cur === ev.id ? null : cur))}
      title={ev.description}
      className={`rounded-md px-2.5 py-2 text-left text-xs font-semibold ring-1 transition ${
        CATEGORY_STYLES[ev.category]
      } ${fired.has(ev.id) ? 'bg-slate-800/80 text-slate-500' : 'bg-slate-900 text-slate-200'} ${
        flashId === ev.id ? 'motion-safe:animate-event-fire' : ''
      }`}
    >
      <span className="flex items-center justify-between gap-1">
        <span>{ev.label}</span>
        {fired.has(ev.id) && <span title="already fired">✓</span>}
      </span>
      {ev.autoAtSec !== undefined && !fired.has(ev.id) && (
        <span className="mt-0.5 block text-[10px] font-normal text-slate-500">
          auto at {Math.floor(ev.autoAtSec / 60)}:{String(ev.autoAtSec % 60).padStart(2, '0')}
        </span>
      )}
    </button>
  );

  return (
    <section className="card space-y-2">
      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Events</h2>
      {events.length > 8 && (
        <input
          ref={filterRef}
          className="input"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter events… ( / )"
          aria-label="Filter events"
        />
      )}
      {grouped ? (
        sections.map(({ category, items }) => {
          const open = !closedGroups.has(category);
          const firedCount = items.filter((ev) => fired.has(ev.id)).length;
          return (
            <div key={category}>
              <button
                className="flex w-full items-center gap-1.5 rounded px-1 py-1 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 hover:bg-slate-800/60"
                aria-expanded={open}
                onClick={() => toggleGroup(category)}
              >
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${CATEGORY_DOT[category]}`} />
                <span>{category}</span>
                <span className="font-normal normal-case text-slate-600">
                  {firedCount}/{items.length} fired
                </span>
                <span className="ml-auto text-slate-600">{open ? '▾' : '▸'}</span>
              </button>
              {open && (
                <div className="mt-1 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {items.map(eventButton)}
                </div>
              )}
            </div>
          );
        })
      ) : (
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {visible.map(eventButton)}
          {visible.length === 0 && (
            <p className="col-span-full text-xs text-slate-500">No events match “{filter}”.</p>
          )}
        </div>
      )}
      <p className="text-[10px] text-slate-500">
        Events can be re-fired. Hover/long-press for details; “auto” events fire themselves unless
        you fire them first.
      </p>
    </section>
  );
}
