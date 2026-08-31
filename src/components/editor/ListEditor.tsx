'use client';

import { useState } from 'react';

/** Chip-style editor for a string[] field: existing items with remove
 *  buttons, plus an add row (Enter or button). Used across the editor's
 *  sections for topics, allergies, teaching content, etc. */
export function ListEditor({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');
  return (
    <div>
      <span className="label">{label}</span>
      <ul className="mb-1 space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-2 rounded bg-panel-2 px-2 py-1 text-sm">
            <span className="flex-1">{item}</span>
            <button
              className="text-faint hover:text-red"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              aria-label={`remove ${item}`}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input
          className="input"
          value={draft}
          placeholder={placeholder ?? 'Add item…'}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && draft.trim()) {
              e.preventDefault();
              onChange([...items, draft.trim()]);
              setDraft('');
            }
          }}
        />
        <button
          className="btn-secondary shrink-0"
          onClick={() => {
            if (draft.trim()) {
              onChange([...items, draft.trim()]);
              setDraft('');
            }
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}
