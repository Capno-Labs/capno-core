'use client';

import { useState } from 'react';
import { CATEGORY_STYLES } from '@/components/eventCategories';
import { useControllerStore } from '@/lib/store/controllerStore';

/** One-tap prebuilt scenario events, grouped for fast lab use. */
export function EventPanel() {
  const { engine, snapshot, triggerEvent } = useControllerStore();
  const [filter, setFilter] = useState('');
  const [flashId, setFlashId] = useState<string | null>(null);
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

  return (
    <section className="card space-y-2">
      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Events</h2>
      {events.length > 8 && (
        <input
          className="input"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter events…"
          aria-label="Filter events"
        />
      )}
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {visible.map((ev) => (
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
        ))}
        {visible.length === 0 && (
          <p className="col-span-full text-xs text-slate-500">No events match “{filter}”.</p>
        )}
      </div>
      <p className="text-[10px] text-slate-500">
        Events can be re-fired. Hover/long-press for details; “auto” events fire themselves unless
        you fire them first.
      </p>
    </section>
  );
}
