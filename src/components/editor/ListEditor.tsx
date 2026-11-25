'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ReorderButtons } from '@/components/ui/ReorderButtons';
import { moveItem } from '@/lib/formFields';

/** A text box that grows with its content, so a long teaching point is read
 *  in full where it is edited. */
function GrowingText({
  value,
  onChange,
  onBlur,
  onEnter,
  placeholder,
  ariaLabel,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onEnter?: () => void;
  placeholder?: string;
  ariaLabel?: string;
  id?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      id={id}
      rows={1}
      className="input min-w-0 flex-1 resize-none overflow-hidden"
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value.replace(/\n/g, ' '))}
      onBlur={onBlur}
      onKeyDown={(e) => {
        // One item per row: Enter moves on instead of adding a line break.
        if (e.key === 'Enter') {
          e.preventDefault();
          onEnter?.();
        }
      }}
    />
  );
}

/**
 * Editor for a string[] field — objectives, setup steps, allergies, teaching
 * points. Every item is edited in place, can be moved up or down, and is
 * removed with its own button; a last row adds a new one (Enter or "Add").
 * An item emptied and left is removed.
 */
export function ListEditor({
  label,
  items,
  onChange,
  placeholder,
  hint,
  ordered = true,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  hint?: string;
  /** False for sets with no meaningful order (topics, allergies): hides the move buttons. */
  ordered?: boolean;
}) {
  const [draft, setDraft] = useState('');
  const addId = useId();

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    onChange([...items, text]);
    setDraft('');
  };

  return (
    <div>
      <label className="label" htmlFor={addId}>
        {label}
      </label>
      {items.length > 0 && (
        <ul className="mb-1.5 space-y-1.5">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-1">
              <GrowingText
                value={item}
                ariaLabel={`${label} ${i + 1}`}
                onChange={(text) => onChange(items.map((it, j) => (j === i ? text : it)))}
                onBlur={() => {
                  const text = item.trim();
                  if (text === '') onChange(items.filter((_, j) => j !== i));
                  else if (text !== item) onChange(items.map((it, j) => (j === i ? text : it)));
                }}
              />
              <ReorderButtons
                name={item || `${label} ${i + 1}`}
                index={i}
                count={items.length}
                onMove={ordered ? (to) => onChange(moveItem(items, i, to)) : undefined}
                onRemove={() => onChange(items.filter((_, j) => j !== i))}
              />
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-start gap-2">
        <GrowingText
          id={addId}
          value={draft}
          placeholder={placeholder ?? 'Add item…'}
          onChange={setDraft}
          onEnter={add}
        />
        <button type="button" className="btn-secondary shrink-0" onClick={add} disabled={!draft.trim()}>
          Add
        </button>
      </div>
      {hint && <p className="mt-1 text-xs text-faint">{hint}</p>}
    </div>
  );
}
