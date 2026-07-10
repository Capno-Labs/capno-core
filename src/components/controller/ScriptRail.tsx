'use client';

import type { ScenarioEvent } from '@/lib/engine/types';
import { useControllerStore } from '@/lib/store/controllerStore';

/**
 * Operator script rail — a glanceable "what's next" strip so faculty can run
 * the room (voice the patient, watch learners) without re-reading the event
 * grid mid-crisis.
 *
 * Shows the next few unfired events: automatic ones first with a live
 * countdown (amber when imminent), then upcoming manual events in the order
 * the scenario author wrote them (authors write events in narrative order).
 * Tapping a chip fires the event now — firing an auto event early cancels
 * its scheduled copy.
 */

const MAX_ITEMS = 4;
const IMMINENT_SEC = 30;

function countdown(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function ScriptRail() {
  const { engine, snapshot, triggerEvent } = useControllerStore();
  if (!engine || !snapshot) return null;

  const events = engine.scenario.events;
  const fired = new Set(snapshot.firedEventIds);
  const running = snapshot.status === 'running';

  const autos = events
    .filter((e) => e.autoAtSec !== undefined && !fired.has(e.id))
    .sort((a, b) => a.autoAtSec! - b.autoAtSec!);
  const manuals = events.filter((e) => e.autoAtSec === undefined && !fired.has(e.id));
  const upcoming: ScenarioEvent[] = [...autos, ...manuals].slice(0, MAX_ITEMS);

  return (
    <section className="card !py-2.5">
      <div className="flex items-center gap-3 overflow-x-auto">
        <div className="shrink-0">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Script</h2>
          <p className="whitespace-nowrap text-[10px] text-slate-500">
            {fired.size}/{events.length} events
          </p>
        </div>

        {upcoming.length === 0 ? (
          <p className="text-sm text-slate-400">
            Script complete — improvise from the vitals panel or end the session.
          </p>
        ) : (
          upcoming.map((ev) => {
            const isAuto = ev.autoAtSec !== undefined;
            const remaining = isAuto ? ev.autoAtSec! - snapshot.elapsedSec : 0;
            const imminent = isAuto && running && remaining <= IMMINENT_SEC;
            return (
              <button
                key={ev.id}
                onClick={() => triggerEvent(ev.id)}
                title={`${ev.description ?? ev.label} — tap to fire now`}
                className={`flex shrink-0 flex-col items-start rounded-md px-2.5 py-1.5 text-left ring-1 transition hover:bg-slate-800 ${
                  imminent
                    ? 'bg-amber-950/60 ring-amber-500 animate-alarm-flash'
                    : isAuto
                      ? 'bg-slate-900 ring-sky-700/60'
                      : 'bg-slate-900 ring-slate-700'
                }`}
              >
                <span className="max-w-[16rem] truncate text-xs font-semibold text-slate-200">
                  {ev.label}
                </span>
                <span
                  className={`font-mono text-[10px] ${
                    imminent ? 'text-amber-300' : isAuto ? 'text-sky-400' : 'text-slate-500'
                  }`}
                >
                  {isAuto
                    ? running
                      ? `auto in ${countdown(remaining)}`
                      : `auto at ${countdown(ev.autoAtSec!)}`
                    : ev.phaseHint
                      ? `when ready · ${ev.phaseHint}`
                      : 'when ready'}
                </span>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
