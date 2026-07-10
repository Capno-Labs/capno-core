'use client';

import { useState, type FormEvent } from 'react';
import { useControllerStore } from '@/lib/store/controllerStore';

/** Timestamped faculty notes captured during the scenario for the debrief. */
export function NotesPanel() {
  const { snapshot, addNote } = useControllerStore();
  const [text, setText] = useState('');
  if (!snapshot) return null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    addNote(text);
    setText('');
  };

  return (
    <section className="card space-y-2">
      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Faculty notes</h2>
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
      {snapshot.notes.length > 0 && (
        <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
          {[...snapshot.notes].reverse().map((n, i) => (
            <li key={i} className="rounded bg-slate-800/60 px-2 py-1">
              <span className="mr-2 font-mono text-xs text-slate-500">
                {Math.floor(n.t / 60)}:{String(Math.floor(n.t % 60)).padStart(2, '0')}
              </span>
              {n.text}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
