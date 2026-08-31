'use client';

import type { ActionRecord, ActionStatus, ExpectedAction } from '@/lib/engine/types';
import { formatClock } from '@/lib/format';

// Display words are faculty-facing; the underlying ActionStatus values are
// load-bearing (engine, scoring, schema, archives) and must not change.
const STATUS_META: { status: ActionStatus; glyph: string; word: string; cls: string }[] = [
  { status: 'done', glyph: '✓', word: 'Observed', cls: 'bg-green text-[#0d1a10]' },
  { status: 'delayed', glyph: '◐', word: 'Delayed', cls: 'bg-amber text-[#1b1c17]' },
  { status: 'incorrect', glyph: '✗', word: 'Incorrect', cls: 'bg-red-solid text-white' },
  { status: 'missed', glyph: '—', word: 'Missed', cls: 'bg-panel-3 text-ink' },
];

const STATUS_BADGE: Record<ActionStatus, string> = {
  pending: '',
  done: 'text-green',
  delayed: 'text-amber-strong',
  incorrect: 'text-red',
  missed: 'text-muted',
};

/** Legend line for panels that render ActionMarkRows. */
export const ACTION_LEGEND =
  '● = critical action · ✓ observed · ◐ delayed (half credit) · ✗ incorrect · — missed';

/**
 * One expected learner action with its four status buttons. Taps are
 * reversible — tapping the active status clears back to pending. `large`
 * renders bigger, labelled tap targets for live use.
 */
export function ActionMarkRow({
  action,
  record,
  large = false,
  onMark,
}: {
  action: ExpectedAction;
  record: ActionRecord | undefined;
  large?: boolean;
  onMark: (status: ActionStatus) => void;
}) {
  const current = record?.status ?? 'pending';
  const btnSize = large ? 'h-10 min-w-10 px-1.5' : 'h-7 w-7';

  return (
    <li className="flex items-center justify-between gap-2 rounded-md bg-panel-2 px-2 py-1.5">
      <div className="min-w-0">
        <p className="text-sm text-ink" title={action.description ?? action.label}>
          {action.critical && (
            <span className="mr-1 text-red" title="critical action">
              ●
            </span>
          )}
          {action.label}
        </p>
        <p className="text-[10px] text-faint">
          {action.points} pts
          {current !== 'pending' && (
            <span className={`ml-2 font-semibold uppercase ${STATUS_BADGE[current]}`}>
              {current}
              {record?.markedAtSec !== undefined && ` @ ${formatClock(record.markedAtSec)}`}
            </span>
          )}
        </p>
      </div>
      <div className="flex shrink-0 gap-1">
        {STATUS_META.map((s) => (
          <button
            key={s.status}
            title={s.word}
            aria-label={`${action.label}: ${s.word}`}
            onClick={() => onMark(current === s.status ? 'pending' : s.status)}
            className={`${btnSize} rounded text-sm font-bold transition ${
              current === s.status ? s.cls : 'bg-panel-3 text-muted hover:bg-panel-3'
            }`}
          >
            <span className="flex flex-col items-center leading-none">
              <span>{s.glyph}</span>
              {large && <span className="mt-0.5 text-[8px] font-semibold uppercase">{s.word}</span>}
            </span>
          </button>
        ))}
      </div>
    </li>
  );
}
