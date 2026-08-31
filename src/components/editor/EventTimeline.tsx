'use client';

import type { ScenarioEvent } from '@/lib/engine/types';
import { CATEGORY_DOT } from '@/components/eventCategories';

/**
 * Read-only "run preview" for the events editor: timed events sorted by fire
 * time, faculty-fired events in author order — the order the run screen's
 * Flow panel presents when auto events are on. Clicking a chip opens that
 * event's card in the list below.
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
      className={`shrink-0 rounded-md bg-panel px-2 py-1 text-left text-xs ring-1 transition hover:bg-panel-2 ${className}`}
    >
      <span className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${CATEGORY_DOT[event.category]}`} />
        <span className="font-semibold text-ink">
          {event.label || event.id || 'untitled'}
        </span>
      </span>
      {sub && <span className="mt-0.5 block text-[10px] text-faint">{sub}</span>}
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
    <div className="space-y-2 rounded bg-panel/60 p-2 ring-1 ring-line">
      <p className="text-[10px] uppercase tracking-wider text-faint">
        Run preview — the timed schedule and the faculty-fired sequence
      </p>
      <div>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-strong">
          Timed (automatic)
        </span>
        {autos.length === 0 ? (
          <p className="text-xs text-faint">No automatic events — nothing fires on a timer.</p>
        ) : (
          <div className="mt-1 flex items-center gap-1.5 overflow-x-auto pb-1">
            {autos.map(({ event, index }) => {
              const late = (event.autoAtSec ?? 0) > runEndSec;
              return (
                <Chip
                  key={index}
                  event={event}
                  onClick={() => onSelect(index)}
                  className={late ? 'ring-amber/50' : 'ring-amber/40'}
                  sub={`${fmtTime(event.autoAtSec ?? 0)}${late ? ' · after est. end' : ''}`}
                />
              );
            })}
            <span className="shrink-0 text-[10px] text-faint">
              est. end {fmtTime(runEndSec)}
            </span>
          </div>
        )}
      </div>
      <div>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
          Faculty-fired (when learners act)
        </span>
        {manuals.length === 0 ? (
          <p className="text-xs text-faint">
            No faculty-fired events — nothing to trigger in response to learner actions.
          </p>
        ) : (
          <div className="mt-1 flex items-center gap-1.5 overflow-x-auto pb-1">
            {manuals.map(({ event, index }) => (
              <Chip
                key={index}
                event={event}
                onClick={() => onSelect(index)}
                className="ring-line"
                sub={`when ready${event.phaseHint ? ` · ${event.phaseHint}` : ''}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
