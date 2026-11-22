'use client';

import { useState, type FormEvent } from 'react';
import { formatClock } from '@/lib/format';
import { useControllerStore } from '@/lib/store/controllerStore';

/**
 * Timestamped faculty notes captured during the scenario for the debrief.
 * `className` sets the card's display (the run dock hides it behind a tab on
 * narrower layouts without unmounting it — the draft text lives here).
 */
export function NotesPanel({ className = 'flex' }: { className?: string }) {
  const { snapshot, addNote } = useControllerStore();
  const [text, setText] = useState('');
  if (!snapshot) return null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    addNote(text);
    setText('');
  };

  return (
    <section className={`card min-w-0 flex-col gap-2 fit:min-h-0 ${className}`}>
      {/* Below `desk` the dock's tab already says "Notes". */}
      <h2 className="hidden text-sm font-bold uppercase tracking-wider text-muted desk:block">
        Faculty notes
      </h2>
      <form onSubmit={submit} className="flex gap-2">
        <input
          className="input"
          placeholder="e.g. asked for cricoid pressure without indication"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="New note"
        />
        <button type="submit" className="btn-secondary shrink-0" disabled={!text.trim()}>
          Add
        </button>
      </form>
      {snapshot.notes.length > 0 ? (
        <ul className="max-h-40 space-y-1 overflow-y-auto text-sm fit:max-h-none fit:min-h-0 fit:flex-1 fit:overscroll-contain">
          {[...snapshot.notes].reverse().map((n, i) => (
            <li key={i} className="rounded-ctl bg-panel-2 px-2 py-1">
              <span className="mr-2 font-mono text-xs tabular-nums text-faint">{formatClock(n.t)}</span>
              {n.text}
            </li>
          ))}
        </ul>
      ) : (
        // Clipped rather than overflowing when the dock is at its shortest.
        <p className="text-xs text-faint fit:min-h-0 fit:flex-1 fit:overflow-hidden">
          Notes are timestamped and appear in the debrief record.
        </p>
      )}
    </section>
  );
}
