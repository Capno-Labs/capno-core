'use client';

import type { ScenarioEvent } from '@/lib/engine/types';
import { CATEGORY_DOT } from '@/components/eventCategories';

/**
 * Read-only "run preview" for the events editor: shows events the way the
 * faculty script rail will order them at runtime — automatic events sorted
 * by fire time, faculty-fired events in author order. Clicking a chip opens
 * that event's card in the list below.
 */

const fmtTime = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

function Chip({
  event,
  onClick,
  className,
  sub,
}: {
  event: ScenarioEvent;
  onClick: () => void;
  className: string;
  sub?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={event.description}
      className={`shrink-0 rounded-md bg-slate-900 px-2 py-1 text-left text-xs ring-1 transition hover:bg-slate-800 ${className}`}
    >
      <span className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${CATEGORY_DOT[event.category]}`} />
        <span className="font-semibold text-slate-200">
          {event.label || event.id || 'untitled'}
        </span>
      </span>
      {sub && <span className="mt-0.5 block text-[10px] text-slate-500">{sub}</span>}
    </button>
  );
}

export function EventTimeline({
  events,
  estimatedMinutes,
  onSelect,
}: {
  events: ScenarioEvent[];
  estimatedMinutes: number;
  onSelect: (index: number) => void;
}) {
  const indexed = events.map((event, index) => ({ event, index }));
  const autos = indexed
    .filter(({ event }) => event.autoAtSec !== undefined)
    .sort((a, b) => (a.event.autoAtSec ?? 0) - (b.event.autoAtSec ?? 0));
  const manuals = indexed.filter(({ event }) => event.autoAtSec === undefined);
  const runEndSec = estimatedMinutes * 60;

  return (
    <div className="space-y-2 rounded bg-slate-900/60 p-2 ring-1 ring-slate-800">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">
        Run preview — how the faculty script rail will order these events
      </p>
      <div>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-400">
          Timed (automatic)
        </span>
        {autos.length === 0 ? (
          <p className="text-xs text-slate-500">No automatic events — nothing fires on a timer.</p>
        ) : (
          <div className="mt-1 flex items-center gap-1.5 overflow-x-auto pb-1">
            {autos.map(({ event, index }) => {
              const late = (event.autoAtSec ?? 0) > runEndSec;
              return (
                <Chip
                  key={index}
                  event={event}
                  onClick={() => onSelect(index)}
                  className={late ? 'ring-amber-500/60' : 'ring-sky-500/40'}
                  sub={`${fmtTime(event.autoAtSec ?? 0)}${late ? ' · after est. end' : ''}`}
                />
              );
            })}
            <span className="shrink-0 text-[10px] text-slate-600">
              est. end {fmtTime(runEndSec)}
            </span>
          </div>
        )}
      </div>
      <div>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Faculty-fired (when learners act)
        </span>
        {manuals.length === 0 ? (
          <p className="text-xs text-slate-500">
            No faculty-fired events — nothing to trigger in response to learner actions.
          </p>
        ) : (
          <div className="mt-1 flex items-center gap-1.5 overflow-x-auto pb-1">
            {manuals.map(({ event, index }) => (
              <Chip
                key={index}
                event={event}
                onClick={() => onSelect(index)}
                className="ring-slate-700"
                sub={`when ready${event.phaseHint ? ` · ${event.phaseHint}` : ''}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
