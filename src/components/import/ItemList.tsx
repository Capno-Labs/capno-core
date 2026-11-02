'use client';

import { useState } from 'react';
import { Pill } from '@/components/ui/Pill';
import { eventSchema } from '@/lib/engine/schema';
import type { DraftField } from '@/lib/import';
import { draftActionValueSchema, draftPhaseValueSchema, draftRubricValueSchema } from '@/lib/import';
import { formatZodIssues } from '@/lib/zodIssues';
import { STATUS_LABEL, STATUS_TONE } from './FieldRow';
import type { ItemListKey } from './fieldRegistry';

const ITEM_SCHEMA = {
  phases: draftPhaseValueSchema,
  events: eventSchema,
  expectedActions: draftActionValueSchema,
  rubric: draftRubricValueSchema,
} as const;

const TEMPLATE: Record<ItemListKey, object> = {
  phases: { id: 'new-phase', label: 'New phase', description: '' },
  events: { id: 'new-event', label: 'New event', category: 'other', effects: [] },
  expectedActions: { id: 'new-action', label: 'New action', critical: false, points: 0 },
  rubric: { id: 'new-category', label: 'New category', actionIds: [] },
};

interface Labelled {
  id?: string;
  label?: string;
  description?: string;
  phase?: string;
  phaseHint?: string;
  category?: string;
  actionIds?: string[];
}

/**
 * Phases, events, expected actions and rubric categories: each item is a
 * draft field of its own (accept / edit as JSON / remove), so a run sheet
 * with twelve rubric rows needs twelve decisions, not one blanket approval.
 */
export function ItemList({
  listKey,
  label,
  items,
  onChange,
  onFocusBlock,
}: {
  listKey: ItemListKey;
  label: string;
  items: DraftField<unknown>[];
  onChange: (next: DraftField<unknown>[]) => void;
  onFocusBlock: (blockId: string | null) => void;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const update = (i: number, next: DraftField<unknown>) =>
    onChange(items.map((it, j) => (j === i ? next : it)));
  const confirm = (i: number, value: unknown) =>
    update(i, { value, status: 'confirmed', provenance: { method: 'faculty' } });
  const startEdit = (i: number) => {
    setText(JSON.stringify(items[i].value ?? TEMPLATE[listKey], null, 2));
    setError(null);
    setEditing(i);
  };
  const save = () => {
    if (editing === null) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      setError('Invalid JSON.');
      return;
    }
    const check = ITEM_SCHEMA[listKey].safeParse(parsed);
    if (!check.success) {
      setError(formatZodIssues(check.error, 3).join(' · '));
      return;
    }
    confirm(editing, check.data);
    setEditing(null);
  };
  const add = () => {
    onChange([...items, { value: null, status: 'unresolved', provenance: null }]);
    setText(JSON.stringify(TEMPLATE[listKey], null, 2));
    setError(null);
    setEditing(items.length);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-ink">
          {label} <span className="font-normal text-faint">({items.length})</span>
        </span>
        <button className="btn-ghost !px-2 !py-0.5 text-xs" onClick={add}>
          + Add
        </button>
      </div>
      {items.length === 0 && (
        <p className="text-xs text-faint">None found in the source. Add at least one if the scenario needs it.</p>
      )}
      {items.map((item, i) => {
        const v = (item.value ?? {}) as Labelled;
        const needsAttention = item.status === 'unresolved' || item.status === 'proposed';
        const blockId = item.provenance?.blockId ?? null;
        return (
          <div
            key={i}
            id={`field-${listKey}[${i}]`}
            className={`rounded-ctl px-2 py-1.5 ${needsAttention ? 'bg-panel-2' : ''}`}
            onMouseEnter={() => blockId && onFocusBlock(blockId)}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-ink">{v.label ?? '(untitled)'}</span>
              <Pill tone={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</Pill>
              {v.id && <span className="font-mono text-[10px] text-faint">{v.id}</span>}
              {blockId && (
                <button className="text-[10px] text-faint hover:text-ink-2" onClick={() => onFocusBlock(blockId)}>
                  source {blockId}
                </button>
              )}
            </div>
            {editing !== i && (
              <>
                {(v.description || v.category || v.actionIds) && (
                  <p className="mt-0.5 whitespace-pre-wrap text-xs text-ink-2">
                    {v.category && <span className="mr-2 text-faint">{v.category}</span>}
                    {v.description}
                    {v.actionIds && <span className="text-faint">{v.actionIds.join(', ') || 'no actions'}</span>}
                  </p>
                )}
                {item.note && <p className="mt-0.5 text-xs text-faint">{item.note}</p>}
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {(item.status === 'extracted' || item.status === 'proposed' || item.status === 'unresolved') &&
                    item.value !== null && (
                      <button className="btn-secondary !px-2 !py-0.5 text-xs" onClick={() => confirm(i, item.value)}>
                        Accept
                      </button>
                    )}
                  <button className="btn-ghost !px-2 !py-0.5 text-xs" onClick={() => startEdit(i)}>
                    Edit
                  </button>
                  <button
                    className="btn-ghost !px-2 !py-0.5 text-xs"
                    onClick={() => onChange(items.filter((_, j) => j !== i))}
                  >
                    Remove
                  </button>
                </div>
              </>
            )}
            {editing === i && (
              <div className="mt-1 space-y-1">
                <textarea
                  className="input font-mono text-xs"
                  rows={Math.min(14, text.split('\n').length + 1)}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  aria-label={`${label} ${i + 1} JSON`}
                />
                {error && <p className="text-xs text-red">{error}</p>}
                <div className="flex gap-2">
                  <button className="btn-primary !px-2 !py-1 text-xs" onClick={save}>
                    Save
                  </button>
                  <button
                    className="btn-ghost !px-2 !py-1 text-xs"
                    onClick={() => {
                      if (items[i].value === null) onChange(items.filter((_, j) => j !== i));
                      setEditing(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
