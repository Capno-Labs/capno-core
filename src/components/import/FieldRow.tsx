'use client';

import { useState } from 'react';
import { Pill, type PillTone } from '@/components/ui/Pill';
import { TimeField } from '@/components/ui/TimeField';
import { formatTime } from '@/lib/formFields';
import type { DraftField, FieldStatus } from '@/lib/import';
import type { FieldSpec } from './fieldRegistry';

export const STATUS_TONE: Record<FieldStatus, PillTone> = {
  extracted: 'green',
  proposed: 'warn',
  unresolved: 'red',
  confirmed: 'brand',
};

export const STATUS_LABEL: Record<FieldStatus, string> = {
  extracted: 'from source',
  proposed: 'suggested',
  unresolved: 'not in source',
  confirmed: 'confirmed',
};

function toEditorText(kind: FieldSpec['kind'], value: unknown): string {
  if (value === null || value === undefined) return '';
  if (kind === 'stringList') return (value as string[]).join('\n');
  if (kind === 'enumList' || kind === 'monitoring') return JSON.stringify(value);
  return String(value);
}

function fromEditorText(spec: FieldSpec, text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  const t = text.trim();
  switch (spec.kind) {
    case 'string':
      return t ? { ok: true, value: t } : { ok: false, error: 'Enter a value.' };
    case 'number': {
      const n = Number(t);
      return t && Number.isFinite(n) ? { ok: true, value: n } : { ok: false, error: 'Enter a number.' };
    }
    case 'enum': {
      const opt = spec.options?.find((o) => String(o) === t);
      return opt !== undefined ? { ok: true, value: opt } : { ok: false, error: 'Choose an option.' };
    }
    case 'stringList':
      return {
        ok: true,
        value: t
          .split('\n')
          .map((s) => s.replace(/^[-*•]\s*/, '').trim())
          .filter(Boolean),
      };
    case 'enumList': {
      const chosen = parseJson<string[]>(t, []);
      return chosen.length > 0 ? { ok: true, value: chosen } : { ok: false, error: 'Pick at least one.' };
    }
    case 'monitoring':
      return { ok: true, value: parseJson<MonitoringValue>(t, {}) };
  }
}

/** The part of a case's monitoring a run sheet can state: an arterial line, or how often the cuff cycles. */
interface MonitoringValue {
  artLine?: boolean;
  nibpIntervalSec?: number;
}

function parseJson<T>(text: string, fallback: T): T {
  try {
    return (JSON.parse(text) as T) ?? fallback;
  } catch {
    return fallback;
  }
}

const optionLabel = (spec: FieldSpec, option: unknown) => spec.optionLabels?.[String(option)] ?? String(option);

function Display({ spec, value }: { spec: FieldSpec; value: unknown }) {
  const { kind } = spec;
  if (value === null || value === undefined) return <span className="text-faint">—</span>;
  if (kind === 'enum') return <span>{optionLabel(spec, value)}</span>;
  if (kind === 'enumList') return <span>{(value as unknown[]).map((v) => optionLabel(spec, v)).join(', ')}</span>;
  if (kind === 'monitoring') {
    const m = value as MonitoringValue;
    if (m.artLine) return <span>Arterial line: blood pressure displays continuously</span>;
    if (m.nibpIntervalSec !== undefined) return <span>Cuff cycles every {formatTime(m.nibpIntervalSec)}</span>;
    return <span>Cuff at the standard interval, no arterial line</span>;
  }
  if (kind === 'stringList') {
    const items = value as string[];
    if (items.length === 0) return <span className="text-faint">none</span>;
    return (
      <ul className="list-disc space-y-0.5 pl-4">
        {items.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    );
  }
  return (
    <span>
      {String(value)}
      {spec.unit && <span className="ml-1 text-faint">{spec.unit}</span>}
    </span>
  );
}

/** Same two choices, in the same words, as the editor's Starting state page. */
function MonitoringEditor({ value, onChange }: { value: MonitoringValue; onChange: (next: MonitoringValue) => void }) {
  return (
    <div className="space-y-2">
      <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-2">
        <input
          type="checkbox"
          checked={value.artLine === true}
          onChange={(e) => onChange(e.target.checked ? { artLine: true } : {})}
        />
        Arterial line: blood pressure displays continuously
      </label>
      {!value.artLine && (
        <TimeField
          className="max-w-[14rem]"
          label="Cuff cycles every"
          valueSec={value.nibpIntervalSec}
          minSec={15}
          maxSec={1800}
          placeholder="3:00"
          hint="Blank uses 3:00."
          onChange={(nibpIntervalSec) => onChange(nibpIntervalSec === undefined ? {} : { nibpIntervalSec })}
        />
      )}
    </div>
  );
}

/**
 * One draft field in the review: label, status pill, value, provenance
 * link and the decisions faculty can make about it. Accepting keeps the
 * extracted value; editing records the faculty member as the source.
 */
export function FieldRow({
  spec,
  field,
  onChange,
  onFocusBlock,
}: {
  spec: FieldSpec;
  field: DraftField<unknown>;
  onChange: (next: DraftField<unknown>) => void;
  onFocusBlock: (blockId: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const startEdit = () => {
    setText(toEditorText(spec.kind, field.value));
    setError(null);
    setEditing(true);
  };
  const confirm = (value: unknown) =>
    onChange({ value, status: 'confirmed', provenance: { method: 'faculty' } });
  const save = () => {
    const parsed = fromEditorText(spec, text);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    confirm(parsed.value);
    setEditing(false);
  };
  const needsAttention = field.status === 'unresolved' || field.status === 'proposed';
  const blockId = field.provenance?.blockId ?? null;

  return (
    <div
      id={`field-${spec.path}`}
      className={`rounded-ctl px-2 py-1.5 ${needsAttention ? 'bg-panel-2' : ''}`}
      onMouseEnter={() => blockId && onFocusBlock(blockId)}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-ink">
          {spec.label}
          {spec.unit && <span className="ml-1 font-normal text-faint">{spec.unit}</span>}
        </span>
        <Pill tone={STATUS_TONE[field.status]}>{STATUS_LABEL[field.status]}</Pill>
        {spec.optional && <span className="text-[10px] text-faint">optional</span>}
        {blockId && (
          <button
            className="text-[10px] text-faint hover:text-ink-2"
            onClick={() => onFocusBlock(blockId)}
            title={field.provenance?.quote}
          >
            source {blockId}
          </button>
        )}
      </div>
      {!editing && (
        <div className="mt-1 text-sm text-ink-2">
          <Display spec={spec} value={field.value} />
          {field.note && <p className="mt-0.5 text-xs text-faint">{field.note}</p>}
        </div>
      )}
      {editing && (
        <div className="mt-1 space-y-1">
          {spec.kind === 'enum' ? (
            <select className="input" value={text} onChange={(e) => setText(e.target.value)} aria-label={spec.label}>
              <option value="">—</option>
              {spec.options?.map((o) => (
                <option key={String(o)} value={String(o)}>
                  {optionLabel(spec, o)}
                </option>
              ))}
            </select>
          ) : spec.kind === 'enumList' ? (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={spec.label}>
              {spec.options?.map((o) => {
                const chosen = parseJson<string[]>(text, []);
                const on = chosen.includes(String(o));
                return (
                  <button
                    key={String(o)}
                    type="button"
                    className="chip"
                    aria-pressed={on}
                    onClick={() =>
                      setText(JSON.stringify(on ? chosen.filter((c) => c !== String(o)) : [...chosen, String(o)]))
                    }
                  >
                    {optionLabel(spec, o)}
                  </button>
                );
              })}
            </div>
          ) : spec.kind === 'monitoring' ? (
            <MonitoringEditor value={parseJson<MonitoringValue>(text, {})} onChange={(m) => setText(JSON.stringify(m))} />
          ) : spec.kind === 'stringList' ? (
            <textarea
              className="input text-sm"
              rows={Math.min(10, Math.max(3, text.split('\n').length + 1))}
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-label={spec.label}
              placeholder="One item per line"
            />
          ) : (
            <input
              className="input"
              type="text"
              inputMode={spec.kind === 'number' ? 'decimal' : undefined}
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-label={spec.label}
              placeholder={spec.hint}
            />
          )}
          {spec.hint && <p className="text-[10px] text-faint">{spec.hint}</p>}
          {error && <p className="text-xs text-red">{error}</p>}
          <div className="flex gap-2">
            <button className="btn-primary btn-sm" onClick={save}>
              Save
            </button>
            <button className="btn-ghost btn-sm" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {!editing && (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {(field.status === 'extracted' || field.status === 'proposed') && (
            <button className="btn-secondary btn-sm" onClick={() => confirm(field.value)}>
              Accept
            </button>
          )}
          <button className="btn-ghost btn-sm" onClick={startEdit}>
            {field.status === 'unresolved' ? 'Enter value' : 'Edit'}
          </button>
          {field.status === 'unresolved' && spec.kind === 'stringList' && (
            <button className="btn-ghost btn-sm" onClick={() => confirm([])}>
              Confirm none
            </button>
          )}
          {field.status === 'unresolved' && spec.optional && (
            <button className="btn-ghost btn-sm" onClick={() => confirm(null)}>
              Not applicable
            </button>
          )}
        </div>
      )}
    </div>
  );
}
