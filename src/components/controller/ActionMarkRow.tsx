'use client';

import { useEffect, useRef, useState } from 'react';
import type { ActionRecord, ActionStatus, ExpectedAction } from '@/lib/engine/types';
import { formatClock } from '@/lib/format';

// Display words are faculty-facing; the underlying ActionStatus values are
// load-bearing (engine, scoring, schema, archives) and must not change.
const STATUS_META: { status: ActionStatus; glyph: string; word: string; cls: string }[] = [
  { status: 'done', glyph: '✓', word: 'Observed', cls: 'bg-green text-on-green' },
  { status: 'delayed', glyph: '◐', word: 'Delayed', cls: 'bg-warn text-on-warn' },
  { status: 'incorrect', glyph: '✗', word: 'Incorrect', cls: 'bg-red-solid text-white' },
  { status: 'missed', glyph: '—', word: 'Missed', cls: 'bg-faint text-surface' },
];

/** Text colour for a status glyph or word outside its filled button. */
export const STATUS_TEXT: Record<ActionStatus, string> = {
  pending: 'text-faint',
  done: 'text-green',
  delayed: 'text-warn-strong',
  incorrect: 'text-red',
  missed: 'text-muted',
};

/** Glyph for a status in one-line summaries (○ = still to mark). */
export const STATUS_GLYPH: Record<ActionStatus, string> = {
  pending: '○',
  done: '✓',
  delayed: '◐',
  incorrect: '✗',
  missed: '—',
};

const STATUS_WORD: Record<ActionStatus, string> = {
  pending: 'To mark',
  done: 'Observed',
  delayed: 'Delayed',
  incorrect: 'Incorrect',
  missed: 'Missed',
};

/** Legend line for panels that render ActionMarkRows. */
export const ACTION_LEGEND = '● critical action · ✓ observed · ◐ delayed · ✗ incorrect · — missed';

/** How long a just-marked row keeps its buttons before folding to one line. */
const HOLD_MS = 2000;

/**
 * One expected learner action with its four status buttons. Taps are
 * reversible — tapping the active status clears back to pending. `large`
 * renders bigger, labelled tap targets for live use.
 *
 * A marked action folds to one line (label, status, time) so the rail keeps
 * its length down; tapping the line brings the buttons back. The fold waits a
 * moment after the mark so a mis-tap can be corrected in place and nothing
 * moves under the finger.
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
  // Marked rows start folded; a mark made here keeps the row open for a beat.
  const [open, setOpen] = useState(false);
  const foldTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(foldTimer.current), []);

  const mark = (status: ActionStatus) => {
    onMark(current === status ? 'pending' : status);
    setOpen(true);
    window.clearTimeout(foldTimer.current);
    foldTimer.current = window.setTimeout(() => setOpen(false), HOLD_MS);
  };

  const critical = action.critical && (
    <span className="mr-1 text-red" title="critical action">
      ●
    </span>
  );

  if (current !== 'pending' && !open) {
    return (
      <li>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-ctl bg-panel-2 px-2 py-1.5 text-left hover:bg-panel-3"
          aria-expanded={false}
          aria-label={`Change mark — ${action.label}`}
          title={action.description ?? action.label}
          onClick={() => setOpen(true)}
        >
          <span className={`w-3 shrink-0 text-center text-xs font-bold ${STATUS_TEXT[current]}`}>
            {STATUS_GLYPH[current]}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs text-ink-2">
            {critical}
            {action.label}
          </span>
          <span className={`shrink-0 text-[10px] font-semibold uppercase ${STATUS_TEXT[current]}`}>
            {STATUS_WORD[current]}
            {record?.markedAtSec !== undefined && (
              <span className="ml-1 font-mono font-normal tabular-nums text-faint">
                {formatClock(record.markedAtSec)}
              </span>
            )}
          </span>
        </button>
      </li>
    );
  }

  return (
    // Large: label over a full-width row of four equal marks. Compact: the
    // marks sit beside the label and drop below it in a narrow column instead
    // of squeezing it to one word per line (the label keeps at least 9rem).
    <li
      className={`rounded-ctl bg-panel-2 px-2 py-1.5 ${
        large ? 'space-y-1.5' : 'flex flex-wrap items-center justify-between gap-2'
      }`}
    >
      <p
        className={`text-[13px] leading-snug text-ink ${large ? '' : 'min-w-0 flex-1 basis-36'}`}
        title={action.description ?? action.label}
      >
        {critical}
        {action.label}
      </p>
      <div className={large ? 'grid grid-cols-4 gap-1' : 'flex shrink-0 gap-1'}>
        {STATUS_META.map((s) => (
          <button
            key={s.status}
            type="button"
            title={s.word}
            aria-label={`${action.label}: ${s.word}`}
            aria-pressed={current === s.status}
            onClick={() => mark(s.status)}
            className={`${large ? 'h-10' : 'h-7 w-7'} rounded-ctl text-sm font-bold transition ${
              current === s.status ? s.cls : 'bg-panel-3 text-muted hover:bg-line-2 hover:text-ink'
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
