'use client';

import { useState } from 'react';
import { CATEGORY_LABELS } from '@/components/eventCategories';
import { plainMessage } from '@/components/editor/readiness';
import { Icon } from '@/components/ui/Icon';
import { Pill } from '@/components/ui/Pill';
import { eventSchema } from '@/lib/engine/schema';
import type { ExpectedAction, Phase, RubricCategory, ScenarioEvent } from '@/lib/engine/types';
import { formatTime } from '@/lib/formFields';
import type { DraftField } from '@/lib/import';
import { draftActionValueSchema, draftPhaseValueSchema, draftRubricValueSchema } from '@/lib/import';
import { describeEvent, describeTrigger, idFromLabel } from '@/lib/scenarios/progression';
import { STATUS_LABEL, STATUS_TONE } from './FieldRow';
import type { ItemListKey } from './fieldRegistry';
import { BLANK_ITEM, ID_STEM, ItemForm, type ItemContext, type ItemValue } from './ItemForms';

const ITEM_SCHEMA = {
  phases: draftPhaseValueSchema,
  events: eventSchema,
  expectedActions: draftActionValueSchema,
  rubric: draftRubricValueSchema,
} as const;

const SINGULAR: Record<ItemListKey, string> = {
  phases: 'phase',
  events: 'event',
  expectedActions: 'action',
  rubric: 'category',
};

/** One line under an item's name saying what it holds. */
function summaryOf(listKey: ItemListKey, value: ItemValue, context: ItemContext): string {
  switch (listKey) {
    case 'phases': {
      const phase = value as Phase;
      const pace = phase.targetDurationSec !== undefined ? `Should take ${formatTime(phase.targetDurationSec)}` : '';
      return [phase.description, pace].filter(Boolean).join(' · ');
    }
    case 'events': {
      const event = value as ScenarioEvent;
      return [CATEGORY_LABELS[event.category], describeTrigger(event), describeEvent(event), event.description]
        .filter(Boolean)
        .join(' · ');
    }
    case 'expectedActions': {
      const action = value as ExpectedAction;
      const phase = context.phases.find((p) => p.id === action.phase)?.label;
      const points = `${action.points} point${action.points === 1 ? '' : 's'}`;
      return [phase, points, action.description].filter(Boolean).join(' · ');
    }
    case 'rubric': {
      const ids = (value as RubricCategory).actionIds;
      if (ids.length === 0) return 'No actions yet';
      return ids.map((id) => context.actions.find((a) => a.id === id)?.label ?? `${id} (not in the list)`).join(' · ');
    }
  }
}

/**
 * Phases, events, expected actions and rubric categories: each item is a
 * draft field of its own (accept / edit / remove), so a run sheet with
 * twelve rubric rows needs twelve decisions, not one blanket approval.
 * Editing opens the case editor's form for that kind of item.
 */
export function ItemList({
  listKey,
  label,
  items,
  context,
  onChange,
  onFocusBlock,
}: {
  listKey: ItemListKey;
  label: string;
  items: DraftField<unknown>[];
  /** The draft's phases and actions, for the pickers inside the forms. */
  context: ItemContext;
  onChange: (next: DraftField<unknown>[]) => void;
  onFocusBlock: (blockId: string | null) => void;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const [value, setValue] = useState<ItemValue | null>(null);
  const [problems, setProblems] = useState<string[]>([]);

  const update = (i: number, next: DraftField<unknown>) =>
    onChange(items.map((it, j) => (j === i ? next : it)));
  const confirm = (i: number, v: unknown) =>
    update(i, { value: v, status: 'confirmed', provenance: { method: 'faculty' } });

  const startEdit = (i: number) => {
    setValue((items[i].value as ItemValue | null) ?? BLANK_ITEM[listKey]());
    setProblems([]);
    setEditing(i);
  };
  const cancel = () => {
    // A row added and never saved leaves nothing behind.
    if (editing !== null && items[editing]?.value === null && items[editing].provenance === null) {
      onChange(items.filter((_, j) => j !== editing));
    }
    setEditing(null);
  };
  const save = () => {
    if (editing === null || !value) return;
    if (!value.label.trim()) {
      setProblems([`Give the ${SINGULAR[listKey]} a name.`]);
      return;
    }
    // Authors never type ids: one without an id yet gets it from its name.
    const taken = items.flatMap((it, j) => (j !== editing && it.value ? [(it.value as ItemValue).id] : []));
    const withId = value.id ? value : { ...value, id: idFromLabel(value.label, taken, ID_STEM[listKey]) };
    const check = ITEM_SCHEMA[listKey].safeParse(withId);
    if (!check.success) {
      setProblems([...new Set(check.error.issues.map((issue) => plainMessage(issue.message)))].slice(0, 3));
      return;
    }
    confirm(editing, check.data);
    setEditing(null);
  };
  const add = () => {
    onChange([...items, { value: null, status: 'unresolved', provenance: null }]);
    setValue(BLANK_ITEM[listKey]());
    setProblems([]);
    setEditing(items.length);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-ink">
          {label} <span className="font-normal text-faint">({items.length})</span>
        </span>
        <button type="button" className="btn-ghost btn-sm" onClick={add} disabled={editing !== null}>
          <Icon name="plus" size={14} /> Add
        </button>
      </div>
      {items.length === 0 && (
        <p className="text-xs text-faint">None found in the source. Add at least one if the scenario needs it.</p>
      )}
      {items.map((item, i) => {
        const v = item.value as ItemValue | null;
        const needsAttention = item.status === 'unresolved' || item.status === 'proposed';
        const blockId = item.provenance?.blockId ?? null;
        const summary = v ? summaryOf(listKey, v, context) : '';
        return (
          <div
            key={i}
            id={`field-${listKey}[${i}]`}
            className={`rounded-ctl px-2 py-1.5 ${needsAttention || editing === i ? 'bg-panel-2' : ''}`}
            onMouseEnter={() => blockId && onFocusBlock(blockId)}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-ink">{v?.label || `New ${SINGULAR[listKey]}`}</span>
              <Pill tone={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</Pill>
              {listKey === 'expectedActions' && (v as ExpectedAction | null)?.critical && (
                <Pill tone="red">Critical</Pill>
              )}
              {blockId && (
                <button
                  type="button"
                  className="text-[10px] text-faint hover:text-ink-2"
                  onClick={() => onFocusBlock(blockId)}
                >
                  source {blockId}
                </button>
              )}
            </div>
            {editing !== i && (
              <>
                {summary && <p className="mt-0.5 whitespace-pre-wrap text-xs text-ink-2">{summary}</p>}
                {item.note && <p className="mt-0.5 text-xs text-faint">{item.note}</p>}
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {(item.status === 'extracted' || item.status === 'proposed' || item.status === 'unresolved') &&
                    item.value !== null && (
                      <button type="button" className="btn-secondary btn-sm" onClick={() => confirm(i, item.value)}>
                        Accept
                      </button>
                    )}
                  <button type="button" className="btn-ghost btn-sm" onClick={() => startEdit(i)} disabled={editing !== null}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    disabled={editing !== null}
                    onClick={() => onChange(items.filter((_, j) => j !== i))}
                  >
                    Remove
                  </button>
                </div>
              </>
            )}
            {editing === i && value && (
              <div className="mt-2 space-y-3" data-item-form>
                <ItemForm listKey={listKey} value={value} context={context} onChange={setValue} />
                {problems.length > 0 && (
                  <ul className="space-y-0.5 text-xs font-medium text-red" role="alert">
                    {problems.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-2 border-t border-line pt-2">
                  <button type="button" className="btn-primary btn-sm" onClick={save}>
                    Save
                  </button>
                  <button type="button" className="btn-ghost btn-sm" onClick={cancel}>
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
