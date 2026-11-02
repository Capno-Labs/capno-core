'use client';

import { useState } from 'react';
import { Pill, type PillTone } from '@/components/ui/Pill';
import type { DraftField, FieldStatus } from '@/lib/import';
import type { FieldSpec } from './fieldRegistry';

export const STATUS_TONE: Record<FieldStatus, PillTone> = {
  extracted: 'green',
  proposed: 'amber',
  unresolved: 'red',
  confirmed: 'blue',
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
  if (kind === 'json') return JSON.stringify(value, null, 2);
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
    case 'json':
      try {
        return { ok: true, value: JSON.parse(t) };
      } catch {
        return { ok: false, error: 'Invalid JSON.' };
      }
  }
}

function Display({ kind, value }: { kind: FieldSpec['kind']; value: unknown }) {
  if (value === null || value === undefined) return <span className="text-faint">—</span>;
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
  if (kind === 'json') return <pre className="whitespace-pre-wrap font-mono text-xs">{JSON.stringify(value)}</pre>;
  return <span>{String(value)}</span>;
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
        <span className="text-xs font-semibold text-ink">{spec.label}</span>
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
          <Display kind={spec.kind} value={field.value} />
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
                  {String(o)}
                </option>
              ))}
            </select>
          ) : spec.kind === 'stringList' || spec.kind === 'json' ? (
            <textarea
              className="input font-mono text-xs"
              rows={Math.min(10, Math.max(3, text.split('\n').length + 1))}
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-label={spec.label}
              placeholder={spec.kind === 'stringList' ? 'One item per line' : spec.hint}
            />
          ) : (
            <input
              className="input"
              type={spec.kind === 'number' ? 'number' : 'text'}
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-label={spec.label}
              placeholder={spec.hint}
            />
          )}
          {spec.hint && <p className="text-[10px] text-faint">{spec.hint}</p>}
          {error && <p className="text-xs text-red">{error}</p>}
          <div className="flex gap-2">
            <button className="btn-primary !px-2 !py-1 text-xs" onClick={save}>
              Save
            </button>
            <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {!editing && (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {(field.status === 'extracted' || field.status === 'proposed') && (
            <button className="btn-secondary !px-2 !py-0.5 text-xs" onClick={() => confirm(field.value)}>
              Accept
            </button>
          )}
          <button className="btn-ghost !px-2 !py-0.5 text-xs" onClick={startEdit}>
            {field.status === 'unresolved' ? 'Enter value' : 'Edit'}
          </button>
          {field.status === 'unresolved' && spec.kind === 'stringList' && (
            <button className="btn-ghost !px-2 !py-0.5 text-xs" onClick={() => confirm([])}>
              Confirm none
            </button>
          )}
          {field.status === 'unresolved' && spec.optional && (
            <button className="btn-ghost !px-2 !py-0.5 text-xs" onClick={() => confirm(null)}>
              Not applicable
            </button>
          )}
        </div>
      )}
    </div>
  );
}
